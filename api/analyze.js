module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const SB = process.env.SUPABASE_URL;
  const SK = process.env.SUPABASE_SERVICE_KEY;
  const AK = process.env.ANTHROPIC_API_KEY;
  const ATTOM = process.env.ATTOM_API_KEY;

  if (!AK) return res.status(500).json({ error: "Anthropic API key not configured." });

  // FIX: yearBuilt, homeAge, propertyType, and sqft are now destructured from
  // req.body. They were referenced in the analyze block below but never declared,
  // which threw "ReferenceError: yearBuilt is not defined" and 500'd the request.
  const { mode, reportText, inspectorName, companyName, licenseNo, propertyAddress, yearBuilt, homeAge, propertyType, sqft } = req.body;

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
    if (!SB || !SK) { console.error("sbPost skipped: SUPABASE_URL or SUPABASE_SERVICE_KEY is missing"); return null; }
    try {
      const r = await fetch(`${SB}/rest/v1/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SK, "Authorization": `Bearer ${SK}`, "Prefer": "return=representation" },
        body: JSON.stringify(body),
      });
      const text = await r.text();
      if (!r.ok) { console.error(`sbPost ${path} FAILED ${r.status}: ${text}`); return null; }
      const d = text ? JSON.parse(text) : null;
      return Array.isArray(d) ? d[0] : d;
    } catch (e) { console.error(`sbPost ${path} threw: ${e.message}`); return null; }
  }

  async function sbPatch(path, body) {
    if (!SB || !SK) { console.error("sbPatch skipped: SUPABASE_URL or SUPABASE_SERVICE_KEY is missing"); return; }
    try {
      const r = await fetch(`${SB}/rest/v1/${path}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "apikey": SK, "Authorization": `Bearer ${SK}`, "Prefer": "return=representation" },
        body: JSON.stringify(body),
      });
      const text = await r.text();
      if (!r.ok) { console.error(`sbPatch ${path} FAILED ${r.status}: ${text}`); return; }
      // With return=representation, a PATCH that matched nothing comes back as "[]".
      if (text === "[]") console.error(`sbPatch ${path} matched 0 rows — nothing was updated. Does the target row exist?`);
    } catch (e) { console.error(`sbPatch ${path} threw: ${e.message}`); }
  }

  async function sbGet(path) {
    if (!SB || !SK) { console.error("sbGet skipped: SUPABASE_URL or SUPABASE_SERVICE_KEY is missing"); return []; }
    try {
      const r = await fetch(`${SB}/rest/v1/${path}`, {
        headers: { "apikey": SK, "Authorization": `Bearer ${SK}` },
      });
      const text = await r.text();
      if (!r.ok) { console.error(`sbGet ${path} FAILED ${r.status}: ${text}`); return []; }
      const d = text ? JSON.parse(text) : [];
      return Array.isArray(d) ? d : [];
    } catch (e) { console.error(`sbGet ${path} threw: ${e.message}`); return []; }
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
      const SYSTEM = `You are an expert home inspection report analyst operating under the x402 Protocol — a letter-grade system (A/B/C/F) that scores a report on balance, thoroughness, and bias level. You bring 25+ years of experience and you know every home reflects its age, so part of the job is distinguishing genuine defects from normal aging.

## x402 PROTOCOL — GRADE DEFINITIONS
- A (Balanced / Ideal): Highly thorough AND completely balanced. Explicitly confirms each major system was checked (HVAC, roof, electrical, plumbing, foundation, structure, water heater, etc.) and states its actual condition. Legitimate issues flagged honestly — not exaggerated, not minimized. Cosmetic items appear only when relevant. Fair, professional, useful to both buyer and seller. (Rare.)
- B: Very thorough but with a noticeable lean toward buyer OR seller bias. Covers most major systems, slightly over- or under-emphasizes some areas. Reasonably professional, not perfectly neutral.
- C: Strong bias toward buyer OR seller and only moderately thorough. Major systems poorly documented or selectively reported. Bias is obvious — nitpicking everything, or dismissing real issues.
- F: Not thorough AND extremely biased. Major systems barely touched or ignored — either almost empty on critical items (strong seller bias) or stuffed with minor complaints and alarmist language (strong buyer bias). Also F: anything that is not a genuine inspection (a repair-pricing estimate, a blank/template-only TREC form, fabricated or empty findings, no real inspection performed).

## THE TWO BIASES — BOTH UNACCEPTABLE IN A/B REPORTS
- SELLER BIAS: Vague or missing validation of major systems; lots of "no issues noted" with no evidence the system was actually inspected; downplays or ignores real problems.
- BUYER BIAS: Excessive focus on minor cosmetic issues; aggressive cost estimates for small items; flagging normal wear-and-tear (especially in newer homes) as major defects; alarmist recommendations for routine maintenance.

Award A-grade only when a report genuinely earns it. Directly calling out real defects in major systems is NOT bias — it is exactly what a good inspection does.

## THE MOST IMPORTANT CONCEPT: AGE-APPROPRIATE EXPECTATIONS

Before scoring ANY report, you must consider the age of the home:
- A 5-year-old home: Minor wear is unexpected and worth flagging
- A 10-15 year old home: Caulk shrinkage, minor paint wear, carpet wear, weatherstripping, HVAC filters, minor settling cracks = COMPLETELY NORMAL. These are NOT defects.
- A 20-30 year old home: Updated systems may be needed. Cosmetic wear is expected throughout.
- A 40+ year old home: Significant updates expected. Many cosmetic issues are simply age.

## BUYER BIAS — DEEP DIVE (seller bias is the mirror failure; weigh both equally)

An inspector IS buyer-biased when they list age-appropriate normal wear items as defects to create negotiating leverage. It is the most common bias in the industry — but a report that rubber-stamps a home with "no issues noted" and no supporting evidence is just as far from A-grade. That is seller bias, and it is equally disqualifying.

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

## GRADE -> TRUST SCORE BANDS (x402 uses A/B/C/F ONLY — there is no D):
- A -> trustScore 88-100: thorough on real defects, appropriately brief on age-related wear, professional and balanced throughout. Rare.
- B -> trustScore 72-87: covers all major systems well, with a slight buyer OR seller lean; professional, non-alarmist language.
- C -> trustScore 50-71: obvious bias in either direction AND only moderately thorough; major systems selectively or poorly documented.
- F -> trustScore below 50: not thorough AND extremely biased (either direction), OR not a genuine inspection (repair estimate, blank/template-only form, fabricated or empty findings, no real inspection performed).

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

## CALIBRATION EXAMPLES (x402):
- Confirms every major system with its actual condition, flags real defects honestly, minimal age-appropriate noise, professional -> Grade A, Trust 90, Balance 52
- Covers all major systems well but leans slightly buyer (a few age-appropriate items flagged) -> Grade B, Trust 78, Balance 44
- Thorough on majors but pads with many cosmetic/age-appropriate items to manufacture negotiating leverage -> Grade C, Trust 60, Balance 33 (buyer bias)
- Mostly "no issues noted" with little evidence the majors were actually inspected; real problems downplayed -> Grade C, Trust 58, Balance 70 (seller bias)
- Barely addresses major systems AND stuffed with alarmist minor complaints on a newer home -> Grade F, Trust 28, Balance 16 (extreme buyer bias)
- Repair-pricing estimate or blank TREC template submitted as an inspection; no genuine inspection performed -> Grade F, Trust 12, Balance 50 (not an inspection)

Return ONLY this JSON — no markdown, no backticks, no line breaks inside strings:
{
  "trustScore": <0-100>,
  "fraudRisk": "<Low|Moderate|High>",
  "balanceScore": <0-100>,
  "inspectorGrade": "<A|B|C|F>",
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

      // ── RESOLVE PROPERTY FACTS ────────────────────────────
      // Priority: (1) values passed in the request body, (2) live ATTOM lookup
      // by address, (3) regex extraction from the report text.
      let resolvedYear = yearBuilt ? Number(yearBuilt) : null;
      let resolvedAge = homeAge ? Number(homeAge) : null;
      let resolvedType = propertyType || null;
      let resolvedSqft = sqft ? Number(sqft) : null;
      let yearSource = resolvedYear ? "provided" : null;

      if (!resolvedYear && propertyAddress && ATTOM) {
        const attom = await attomLookup(propertyAddress, ATTOM);
        if (attom && attom.yearBuilt) {
          resolvedYear = attom.yearBuilt;
          resolvedAge = attom.homeAge;
          resolvedType = resolvedType || attom.propertyType;
          resolvedSqft = resolvedSqft || attom.sqft;
          yearSource = "attom";
        }
      }

      if (!resolvedYear) {
        const m = (reportText||"").match(/(?:year built|built in|constructed in|year of construction)[:\s]+([12][90]\d{2})/i)
          || (reportText||"").match(/\b(19[5-9]\d|20[0-2]\d)\b/);
        if (m) { resolvedYear = parseInt(m[1]); resolvedAge = new Date().getFullYear() - resolvedYear; yearSource = "report"; }
      }
      if (resolvedYear && resolvedAge == null) resolvedAge = new Date().getFullYear() - resolvedYear;

      const homeAgeLabel = resolvedYear
        ? `${resolvedAge} years old (built ${resolvedYear})`
        : "Age unknown — base judgment on visible wear and report context";
      const attomContext = (resolvedYear && yearSource === "attom")
        ? `VERIFIED PROPERTY DATA (from ATTOM national database): Built ${resolvedYear} · ${resolvedAge} years old${resolvedType?" · "+resolvedType:""}${resolvedSqft?" · "+Number(resolvedSqft).toLocaleString()+" sq ft":""}`
        : resolvedYear
          ? `Property built ${resolvedYear} (${resolvedAge} years old)${resolvedType?" · "+resolvedType:""}${resolvedSqft?" · "+Number(resolvedSqft).toLocaleString()+" sq ft":""} — ${yearSource === "provided" ? "provided with request" : "estimated from report text"}`
          : "Property age not verified — estimate from report context";

      // Data sent back to the UI so it can show the build year / age
      const propertyData = {
        yearBuilt: resolvedYear || null,
        homeAge: resolvedAge != null ? resolvedAge : null,
        propertyType: resolvedType || null,
        sqft: resolvedSqft || null,
        source: resolvedYear ? yearSource : "unknown",
      };

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

      return res.status(200).json({ analysis, reportId, saved: !!reportId, propertyData });
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

// Look up a property's build year / type / size from ATTOM by address.
// Returns null on any failure so analysis still proceeds (falls back to report text).
async function attomLookup(address, attomKey) {
  if (!attomKey || !address) return null;

  // ATTOM wants address1 = street, address2 = "City, ST ZIP".
  // Split on the first comma; everything after it becomes address2.
  const parts = String(address).split(",").map(s => s.trim()).filter(Boolean);
  const address1 = parts[0] || String(address);
  const address2 = parts.length > 1 ? parts.slice(1).join(", ") : "";

  const url = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail`
    + `?address1=${encodeURIComponent(address1)}`
    + `&address2=${encodeURIComponent(address2)}`;

  try {
    const r = await fetch(url, {
      headers: { "Accept": "application/json", "apikey": attomKey },
    });
    const d = await r.json();

    // status.code === 0 means a match was found; property[] holds the records.
    if (!r.ok || d?.status?.code !== 0 || !Array.isArray(d.property) || d.property.length === 0) {
      return null;
    }

    const p = d.property[0];
    const yearBuilt = p?.summary?.yearbuilt ? Number(p.summary.yearbuilt) : null;
    const propertyType = p?.summary?.propclass || p?.summary?.proptype || null;
    const sqft = p?.building?.size?.universalsize || p?.building?.size?.livingsize || null;

    return {
      yearBuilt,
      homeAge: yearBuilt ? new Date().getFullYear() - yearBuilt : null,
      propertyType,
      sqft: sqft ? Number(sqft) : null,
      matchedAddress: p?.address?.oneLine || address,
    };
  } catch {
    return null;
  }
}
