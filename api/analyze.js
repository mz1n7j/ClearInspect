module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const SB = process.env.SUPABASE_URL;
  const SK = process.env.SUPABASE_SERVICE_KEY;
  const AK = process.env.ANTHROPIC_API_KEY;

  if (!AK) return res.status(500).json({ error: "Anthropic API key not configured." });

  const { mode, reportText, inspectorName, companyName, licenseNo, propertyAddress } = req.body;

  async function claude(system, user, tokens, sonnet) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": AK, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: sonnet ? "claude-sonnet-4-5" : "claude-haiku-4-5",
        max_tokens: tokens || 1000,
        system, messages: [{ role: "user", content: user }],
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || JSON.stringify(d));
    return d.content?.find(b => b.type === "text")?.text || "{}";
  }

  function parseJSON(str) {
    // Find outermost { ... } by char code scan
    let first = -1, last = -1;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      if (c === 123 && first === -1) first = i;
      if (c === 125) last = i;
    }
    if (first === -1 || last <= first) throw new Error("No JSON object found");
    let s = str.slice(first, last + 1);
    // Fix unescaped newlines inside string values
    let inStr = false, esc = false, out = "";
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (esc) { out += c; esc = false; continue; }
      if (c === "\\") { out += c; esc = true; continue; }
      if (c === '"') { inStr = !inStr; out += c; continue; }
      if (inStr && c === "\n") { out += "\\n"; continue; }
      if (inStr && c === "\r") { out += "\\r"; continue; }
      if (inStr && c === "\t") { out += "\\t"; continue; }
      out += c;
    }
    const attempts = [out, out.replace(/,([\s\n]*[}\]])/g, "$1")];
    for (const a of attempts) {
      try { const r = JSON.parse(a); if (r && typeof r === "object") return r; } catch {}
    }
    throw new Error("JSON parse failed. Preview: " + out.slice(0, 200));
  }

  async function sbPost(path, body) {
    if (!SB || !SK) return null;
    try {
      const r = await fetch(`${SB}/rest/v1/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SK, "Authorization": `Bearer ${SK}`, "Prefer": "return=representation" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      return Array.isArray(d) ? d[0] : d;
    } catch { return null; }
  }

  async function sbPatch(path, body) {
    if (!SB || !SK) return;
    try {
      await fetch(`${SB}/rest/v1/${path}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "apikey": SK, "Authorization": `Bearer ${SK}` },
        body: JSON.stringify(body),
      });
    } catch {}
  }

  async function sbGet(path) {
    if (!SB || !SK) return [];
    try {
      const r = await fetch(`${SB}/rest/v1/${path}`, {
        headers: { "apikey": SK, "Authorization": `Bearer ${SK}` },
      });
      return await r.json();
    } catch { return []; }
  }

  try {
    // ── PARSE MODE ────────────────────────────────────────────
    if (mode === "parse") {
      if (!reportText || reportText.trim().length < 10) {
        return res.status(400).json({ error: "Report text too short." });
      }
      const raw = await claude(
        `You extract structured data from home inspection reports.
Return ONLY a raw JSON object. No markdown, no backticks, no explanation.
Use empty string "" for missing fields. Never use "Unknown", "N/A", or null.

FIELD RULES:
- inspectorName: The LICENSED HOME INSPECTOR who performed the inspection. Look for "Inspector:", "Inspected by:", "Performed by:", "Certified by:". NOT the client, buyer, seller, or repair person.
- companyName: The HOME INSPECTION COMPANY only. NOT repair companies, NOT real estate agencies.
- licenseNo: Look for "License #", "TREC #", "HI-", "Lic.", "Cert. #", "CPI#"
- street/city/state/zip: INSPECTED PROPERTY address only. state = 2-letter abbreviation.
- buyerEmail/sellerEmail/realtorEmail: Only if explicitly labeled.

Return exactly: {"inspectorName":"","companyName":"","licenseNo":"","street":"","city":"","state":"","zip":"","buyerEmail":"","sellerEmail":"","realtorEmail":""}`,
        `Extract from this inspection report:\n\n${reportText.slice(0, 5000)}`
      );
      let parsed;
      try { parsed = parseJSON(raw); }
      catch { parsed = { inspectorName:"",companyName:"",licenseNo:"",street:"",city:"",state:"",zip:"",buyerEmail:"",sellerEmail:"",realtorEmail:"" }; }
      const cleaned = Object.fromEntries(
        Object.entries(parsed).map(([k,v]) => {
          const s = String(v||"").trim();
          return [k, ["Unknown","N/A","n/a","null","none"].includes(s) ? "" : s];
        })
      );
      return res.status(200).json({ parsed: cleaned });
    }

    // ── ANALYZE MODE ──────────────────────────────────────────
    if (mode === "analyze") {
      const token = (req.headers.authorization||"").replace("Bearer ","");
      if (!token) return res.status(401).json({ error: "Login required.", code: "AUTH_REQUIRED" });

      const userRes = await fetch(`${SB}/auth/v1/user`, {
        headers: { "apikey": SK, "Authorization": `Bearer ${token}` },
      });
      const userData = await userRes.json();
      if (!userRes.ok) return res.status(401).json({ error: "Session expired. Please sign back in.", code: "SESSION_EXPIRED" });
      const userId = userData.id;

      const profiles = await sbGet(`profiles?id=eq.${userId}&select=*`);
      const profile = profiles[0];

      if (profile?.role === "realtor") {
        const trialStart = new Date(profile.trial_started_at);
        const daysSince = (Date.now() - trialStart) / 86400000;
        const expired = daysSince > 14;
        const paid = profile.subscription_status === "active";
        const freeVol = (profile.inspection_count||0) >= 50;
        if (expired && !paid && !freeVol) {
          return res.status(403).json({ code: "TRIAL_EXPIRED", message: "Your 14-day trial has ended. Subscribe for $20/year to continue." });
        }
      }

      const now = new Date().toISOString();
      const year = new Date().getFullYear();

      // Save initial record
      const saved = await sbPost("inspection_reports", {
        inspector_name: inspectorName||"Unknown",
        company_name: companyName||null,
        license_no: licenseNo||null,
        property_address: propertyAddress||null,
        submitted_by: userId,
        status: "analyzing",
        report_year: year,
        report_text_excerpt: (reportText||"").slice(0,500),
        created_at: now,
        retention_until: new Date(Date.now() + 10*365*24*60*60*1000).toISOString(),
      });
      const reportId = saved?.id || null;

      // ── BALANCED AI ANALYSIS ──────────────────────────────
      const SYSTEM = `You are a senior real estate inspection analyst with 25+ years of experience evaluating homes of all ages. You understand that every home reflects its age, and a good inspector's job is to distinguish genuine defects from normal aging.

## THE MOST IMPORTANT CONCEPT: AGE-APPROPRIATE EXPECTATIONS

Before scoring ANY report, you must consider the age of the home:
- A 5-year-old home: Minor wear is unexpected and worth flagging
- A 10-15 year old home: Caulk shrinkage, minor paint wear, carpet wear, weatherstripping, HVAC filters, minor settling cracks = COMPLETELY NORMAL. These are NOT defects.
- A 20-30 year old home: Updated systems may be needed. Cosmetic wear is expected throughout.
- A 40+ year old home: Significant updates expected. Many cosmetic issues are simply age.

## BUYER BIAS — THE CORE PROBLEM

An inspector IS buyer-biased when they list age-appropriate normal wear items as defects to create negotiating leverage. This is the #1 form of bias in the industry.

BUYER BIAS EXAMPLES (these inflate defect counts unfairly):
- Flagging caulk shrinkage at a 10+ year old tub as a defect
- Listing minor paint touch-ups needed on a 15-year-old home as findings
- Calling normal carpet wear on a 12-year-old home a concern
- Flagging weatherstripping wear, loose door hardware, minor drywall scuffs
- Using urgent language ("recommend immediate repair") for routine maintenance
- Listing 40+ cosmetic items on a 10-year-old home that are simply signs of normal aging
- The buyer and their agent will use every single one of these to beat down the price

A BALANCED INSPECTOR on a 10-year-old home:
- Focuses findings on things a buyer genuinely needs to know before closing
- Notes age-appropriate items briefly as "normal for home age — routine maintenance"
- Reserves urgent language for actual safety hazards and significant defects
- Does NOT pad the report with cosmetic items to imply the home has more problems than it does

## VOLUME IS NOT THE ISSUE — CONTENT IS

A 70-page report is fine IF the findings are substantive. But if 50 of those pages are minor cosmetic items on a 10-year-old home, that IS buyer bias — because those items don't reflect actual problems, they reflect the home's age and will be weaponized in price negotiations.

## WHAT ACTUALLY MATTERS (Major system findings — always balanced to report):
- Structural/foundation issues
- Roof condition and remaining life
- Electrical safety (panel, wiring, GFCI, arc fault)
- Plumbing (leaks, water heater age/condition, drainage)
- HVAC condition and efficiency
- Water intrusion or moisture damage
- Safety hazards (CO detectors, smoke alarms, railings, etc.)

## BALANCE SCORE:
- 45-65: Balanced — findings appropriate for home age and condition
- 30-44: Moderately buyer-biased — some age-appropriate items flagged unnecessarily
- Below 30: Heavily buyer-biased — report padded with normal wear items to influence negotiations
- 66-75: Slightly seller-biased
- Above 75: Seller-biased — missing genuine defects

## GRADING — CALIBRATED TO REAL-WORLD STANDARDS:
- A (88-100): Excellent. Thorough on real defects, appropriately brief on age-related wear, professional language throughout. Rare — most inspectors don't earn this.
- B (74-87): Good professional report. Covers all major systems well. May have minor over-reporting on cosmetic items but language is professional and non-alarmist.
- C (58-73): Adequate but buyer-leaning. Inspector is thorough on major systems but also pads the report with age-appropriate wear items that inflate the defect count and benefit the buyer in negotiations. Jacob Beard / "John Smith" type reports typically land here — comprehensive but noticeably buyer-biased on minor items.
- D (42-57): Below average. Heavy pattern of using cosmetic and age-appropriate items as defects. Alarmist language on routine maintenance. Significant negotiating leverage manufactured through minor items.
- F (below 42): Reserved ONLY for: fraudulent documents (not real inspections), extreme manufactured defects, completely fabricated findings, or no legitimate inspection performed at all.

## BALANCE SCORE — CALIBRATED:
- 55-65: Balanced and professional
- 45-54: Slightly buyer-leaning — some age-appropriate items flagged
- 35-44: Moderately buyer-biased — clear pattern of minor item padding (C grade territory)
- 25-34: Heavily buyer-biased — report designed to manufacture negotiating leverage
- Below 25: Extreme bias or fraud
- 66-75: Slightly seller-leaning
- Above 75: Seller-biased

## TRUST SCORE — CALIBRATED:
- 80-100: Highly trustworthy professional
- 65-79: Reliable with minor bias tendencies
- 50-64: Adequate — some objectivity concerns
- 35-49: Notable bias concerns — report should be reviewed carefully
- Below 35: Serious concerns — possible fraud or extreme bias

## REAL-WORLD CALIBRATION EXAMPLES:
- Inspector documents all major systems thoroughly + lists 40 cosmetic wear items on a 12-year-old home → Grade C, Trust 62, Balance 38 (buyer-biased but competent)
- Inspector documents major systems only, skips cosmetic items entirely → Grade B, Trust 78, Balance 58
- Inspector fabricates findings or submits a repair estimate as an inspection → Grade F, Trust 15, Balance 20
- Inspector documents everything proportionally, uses professional language → Grade A, Trust 88, Balance 58

Return ONLY this JSON — no markdown, no backticks, no line breaks inside strings:
{
  "trustScore": <0-100>,
  "fraudRisk": "<Low|Moderate|High>",
  "balanceScore": <0-100>,
  "inspectorGrade": "<A|B|C|D|F>",
  "completenessScore": <0-100>,
  "technicalScore": <0-100>,
  "objectivityScore": <0-100>,
  "homeAgeContext": "<one sentence about home age and what findings are age-appropriate>",
  "summary": "<2-3 sentences: overall quality, whether findings are age-appropriate, key takeaway for buyer>",
  "dealBreakers": [{"item":"<genuine defect worth negotiating>","severity":"<critical|major>","recommendation":"<action>"}],
  "notableIssues": [{"item":"<real issue but not urgent>","severity":"moderate","recommendation":"<action>"}],
  "minorObservations": [{"item":"<item>","severity":"minor","isCosmeticOverreach":<true if age-appropriate item flagged as defect, else false>,"ageAppropriate":<true|false>}],
  "strengths": ["<what inspector did well>"],
  "concerns": ["<genuine concern — age-inappropriate flagging, alarmist language, etc>"],
  "biasIndicators": ["<specific examples of age-appropriate items being flagged as defects>"],
  "redFlags": ["<only actual fraud indicators>"],
  "recommendation": "<one sentence for buyer/seller>",
  "emailBuyer": "<paragraph: highlight real issues, note which minor items are simply age-appropriate and shouldnt affect deal>",
  "emailSeller": "<paragraph: what genuinely needs fixing vs what is normal for home age>",
  "emailRealtor": "<paragraph: deal-relevant summary distinguishing real defects from age-appropriate items>"
}

CRITICAL: No line breaks inside string values. Single paragraphs only.`;

      const reportClean = (reportText||"").slice(0,6000).replace(/\n+/g," ").replace(/\r/g,"");

      // Use ATTOM data if available, otherwise extract from report text
      let resolvedYear = yearBuilt || null;
      let resolvedAge = homeAge || null;
      if (!resolvedYear) {
        const m = (reportText||"").match(/(?:year built|built in|constructed in|year of construction)[:\s]+([12][90]\d{2})/i)
          || (reportText||"").match(/\b(19[5-9]\d|20[0-2]\d)\b/);
        if (m) { resolvedYear = m[1]; resolvedAge = new Date().getFullYear() - parseInt(m[1]); }
      }
      const homeAgeLabel = resolvedYear
        ? `${resolvedAge} years old (built ${resolvedYear})`
        : "Age unknown — base judgment on visible wear and report context";
      const attomContext = yearBuilt
        ? `VERIFIED PROPERTY DATA (from ATTOM national database): Built ${resolvedYear} · ${resolvedAge} years old${propertyType?" · "+propertyType:""}${sqft?" · "+Number(sqft).toLocaleString()+" sq ft":""}`
        : "Property age not verified — estimate from report context";

      const raw = await claude(
        SYSTEM,
        `Inspector: ${inspectorName||"Unknown"} | Company: ${companyName||"Unknown"} | License: ${licenseNo||"N/A"} | Property: ${propertyAddress||"N/A"}
${attomContext}

SCORING CONTEXT: This home is ${homeAgeLabel}. Use this to determine which findings are age-appropriate normal wear vs genuine defects. A ${resolvedAge||"unknown"}-year-old home will naturally have: ${resolvedAge>=10?"worn caulk, minor paint chips, carpet wear, weatherstripping wear, minor hardware looseness, small settling cracks — these are NORMAL and should not be flagged as defects or used to lower scores":"most systems near-new, minimal cosmetic wear expected"}.

REPORT TEXT:
${reportClean}`,
        3000, true
      );

      let analysis;
      try { analysis = parseJSON(raw); }
      catch (e) {
        console.error("Analysis parse failed:", e.message, raw.slice(0,200));
        // Try to extract partial data from truncated JSON
        const partial = {};
        const patterns = [
          [/\"trustScore\"\s*:\s*(\d+)/, "trustScore", Number],
          [/\"fraudRisk\"\s*:\s*\"([^"]+)\"/, "fraudRisk", String],
          [/\"balanceScore\"\s*:\s*(\d+)/, "balanceScore", Number],
          [/\"inspectorGrade\"\s*:\s*\"([^"]+)\"/, "inspectorGrade", String],
          [/\"completenessScore\"\s*:\s*(\d+)/, "completenessScore", Number],
          [/\"technicalScore\"\s*:\s*(\d+)/, "technicalScore", Number],
          [/\"objectivityScore\"\s*:\s*(\d+)/, "objectivityScore", Number],
          [/\"summary\"\s*:\s*\"([^"]{10,})\"/, "summary", String],
          [/\"recommendation\"\s*:\s*\"([^"]{10,})\"/, "recommendation", String],
        ];
        for (const [rx, key, cast] of patterns) {
          const m = raw.match(rx);
          if (m) partial[key] = cast(m[1]);
        }
        if (partial.trustScore) {
          console.log("Recovered partial analysis:", Object.keys(partial).join(","));
          analysis = partial;
        } else {
          return res.status(500).json({ error: "AI response could not be parsed. Please try again." });
        }
      }

      const defaults = {
        trustScore:70, fraudRisk:"Low", balanceScore:50, inspectorGrade:"B",
        completenessScore:70, technicalScore:70, objectivityScore:70,
        summary:"Analysis complete.", dealBreakers:[], notableIssues:[], minorObservations:[],
        strengths:[], concerns:[], biasIndicators:[], redFlags:[],
        recommendation:"Review all findings carefully before proceeding.",
        emailBuyer:"Please review the inspection analysis.",
        emailSeller:"Please review the inspection analysis.",
        emailRealtor:"Please review the inspection analysis.",
      };
      for (const [k,v] of Object.entries(defaults)) {
        if (analysis[k] === undefined || analysis[k] === null || analysis[k] === "") analysis[k] = v;
      }

      // Save analysis to DB
      if (reportId) {
        sbPatch(`inspection_reports?id=eq.${reportId}`, {
          status: "complete",
          trust_score: analysis.trustScore,
          fraud_risk: analysis.fraudRisk,
          balance_score: analysis.balanceScore,
          inspector_grade: analysis.inspectorGrade,
          completeness_score: analysis.completenessScore,
          technical_score: analysis.technicalScore,
          objectivity_score: analysis.objectivityScore,
          analysis_data: analysis,
          completed_at: new Date().toISOString(),
        }).catch(console.error);
      }

      // Increment inspection count
      if (userId) {
        sbPatch(`profiles?id=eq.${userId}`, {
          inspection_count: (profile?.inspection_count||0) + 1,
        }).catch(console.error);
      }

      // Update inspector aggregate scores if license provided
      if (licenseNo && SB && SK) {
        updateInspectorScores(licenseNo, SB, SK).catch(console.error);
      }

      return res.status(200).json({ analysis, reportId, saved: !!reportId });
    }

    // ── RESEND EMAIL MODE ─────────────────────────────────────
    if (mode === "resend_email") {
      const { reportId: rid, recipientType, recipientEmail } = req.body;
      const token = (req.headers.authorization||"").replace("Bearer ","");
      if (!token) return res.status(401).json({ error: "Login required." });

      const reports = await sbGet(`inspection_reports?id=eq.${rid}&select=*`);
      const report = reports[0];
      if (!report) return res.status(404).json({ error: "Report not found." });

      const fiveYearsAgo = new Date(Date.now() - 5*365*24*60*60*1000).toISOString();
      if (report.created_at < fiveYearsAgo) {
        return res.status(403).json({ error: "Reports older than 5 years cannot be resent." });
      }

      // Log the resend
      await sbPost("email_sends", {
        report_id: rid,
        recipient_type: recipientType,
        recipient_email: recipientEmail,
        sent_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5*365*24*60*60*1000).toISOString(),
      });

      return res.status(200).json({ success: true, message: `Email logged for ${recipientEmail}` });
    }

    // ── GET REPORTS DASHBOARD ─────────────────────────────────
    if (mode === "get_reports") {
      const token = (req.headers.authorization||"").replace("Bearer ","");
      if (!token) return res.status(401).json({ error: "Login required." });
      const { search, filterYear, filterRisk } = req.body;

      let query = "inspection_reports?select=*&order=created_at.desc&limit=100";
      if (filterYear) query += `&report_year=eq.${filterYear}`;
      if (filterRisk) query += `&fraud_risk=eq.${filterRisk}`;

      const reports = await sbGet(query);

      let filtered = reports;
      if (search) {
        const s = search.toLowerCase();
        filtered = reports.filter(r =>
          r.inspector_name?.toLowerCase().includes(s) ||
          r.company_name?.toLowerCase().includes(s) ||
          r.property_address?.toLowerCase().includes(s) ||
          r.license_no?.toLowerCase().includes(s)
        );
      }

      return res.status(200).json({ reports: filtered });
    }

    // ── DELETE REPORT (admin only) ───────────────────────────
    if (mode === "delete_report") {
      const token = (req.headers.authorization||"").replace("Bearer ","");
      if (!token) return res.status(401).json({ error: "Login required." });

      const userRes = await fetch(`${SB}/auth/v1/user`, {
        headers: { "apikey": SK, "Authorization": `Bearer ${token}` },
      });
      const userData = await userRes.json();
      if (!userRes.ok) return res.status(401).json({ error: "Session expired." });

      // Check admin role
      const profiles = await sbGet(`profiles?id=eq.${userData.id}&select=role`);
      const profile = profiles[0];
      if (profile?.role !== "admin") {
        return res.status(403).json({ error: "Only admins can delete reports." });
      }

      const { reportId } = req.body;
      if (!reportId) return res.status(400).json({ error: "Report ID required." });

      const r = await fetch(`${SB}/rest/v1/inspection_reports?id=eq.${reportId}`, {
        method: "DELETE",
        headers: { "apikey": SK, "Authorization": `Bearer ${SK}`, "Prefer": "return=minimal" },
      });

      if (!r.ok) return res.status(500).json({ error: "Delete failed." });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: "Unknown mode." });

  } catch (err) {
    console.error("analyze error:", err.message);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
};

async function updateInspectorScores(licenseNo, SB, SK) {
  const r = await fetch(`${SB}/rest/v1/inspection_reports?license_no=eq.${encodeURIComponent(licenseNo)}&status=eq.complete&select=trust_score,balance_score,completeness_score,technical_score,objectivity_score,inspector_grade,analysis_data`, {
    headers: { "apikey": SK, "Authorization": `Bearer ${SK}` },
  });
  const reports = await r.json();
  if (!Array.isArray(reports) || reports.length === 0) return;

  const avg = key => Math.round(reports.reduce((s,r) => s+(r[key]||0),0)/reports.length);
  const grades = reports.map(r=>r.inspector_grade||"C");
  const gradeMode = grades.sort((a,b)=>grades.filter(v=>v===b).length-grades.filter(v=>v===a).length)[0];

  await fetch(`${SB}/rest/v1/inspector_profiles?license_no=eq.${encodeURIComponent(licenseNo)}`, {
    method: "PATCH",
    headers: { "Content-Type":"application/json", "apikey":SK, "Authorization":`Bearer ${SK}` },
    body: JSON.stringify({
      avg_trust_score: avg("trust_score"),
      avg_balance_score: avg("balance_score"),
      avg_completeness_score: avg("completeness_score"),
      avg_objectivity_score: avg("objectivity_score"),
      avg_grade: gradeMode,
      report_count: reports.length,
      last_updated: new Date().toISOString(),
    }),
  });
}
