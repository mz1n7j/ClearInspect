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
      const SYSTEM = `You are a senior real estate inspection analyst with 25+ years of experience. Your job is to evaluate inspection reports fairly and professionally — rewarding thorough inspectors and flagging genuinely biased ones.

## SCORING PHILOSOPHY — READ CAREFULLY

### VOLUME OF FINDINGS DOES NOT INDICATE BIAS
A 70-page report with hundreds of items is NOT buyer-biased just because it is long. Thorough inspectors document everything. Volume alone is never a reason to lower scores or flag bias.

### WHAT MAKES A BALANCED INSPECTOR (score 45-65):
- Documents all major systems: structural, foundation, roof, electrical, plumbing, HVAC
- Clearly distinguishes between urgent safety issues and normal maintenance items
- Uses professional, non-alarmist language throughout
- Provides repair recommendations alongside findings
- Covers the property comprehensively regardless of report length

### WHAT ACTUALLY INDICATES BUYER BIAS (score below 35):
- Uses fear-based or alarmist language for routine maintenance items ("URGENT", "DANGEROUS", "IMMEDIATE ACTION" for caulk or paint)
- Flags purely cosmetic items (paint scuffs, carpet wear) as structural or safety concerns
- Exaggerates severity — calling normal aging "major defect" or "significant deterioration"
- Disproportionate urgency on cosmetic items vs actual safety issues
- Report language designed to scare buyers rather than inform them

### WHAT INDICATES SELLER BIAS (score above 65):
- Glosses over obvious defects
- Vague or non-committal language on real issues
- Missing entire system categories (no electrical review, no roof assessment)
- Unusually short report for property size/age

## GRADING SCALE — BE GENEROUS WITH GOOD INSPECTORS:
- A (90-100): Exceptional report. Thorough, well-organized, balanced language, clear recommendations
- B (75-89): Good professional report. Minor language issues but solid coverage and fair assessment
- C (60-74): Average report. Some gaps in coverage or slightly alarmist language on minor items
- D (45-59): Below average. Significant bias indicators or major coverage gaps
- F (below 45): Only for fraudulent reports, fake inspection documents, or extreme bias

## TRUST SCORE CALIBRATION:
- 80-100: Professional, thorough, reliable inspector
- 65-79: Good inspector with minor issues
- 50-64: Average inspector, some concerns
- 35-49: Notable concerns about objectivity or completeness
- Below 35: Only for clear fraud or extreme bias

A thorough inspector who documents 200 items across a full house inspection should score B or higher, not F.
The Jacob Beard type of inspector — comprehensive, multi-page, detailed — is doing their job WELL.

## OUTPUT STRUCTURE:
Organize findings into three tiers:
1. dealBreakers: Structural, safety, major system failures requiring action before closing
2. notableIssues: Real repairs needed, items nearing end of life, deferred maintenance
3. minorObservations: Cosmetic, normal wear, routine maintenance. Only flag isCosmeticOverreach=true if the inspector is using alarmist language specifically for cosmetic items

Return ONLY this JSON — no markdown, no backticks, no line breaks inside strings:
{
  "trustScore": <0-100>,
  "fraudRisk": "<Low|Moderate|High>",
  "balanceScore": <0-100>,
  "inspectorGrade": "<A|B|C|D|F>",
  "completenessScore": <0-100>,
  "technicalScore": <0-100>,
  "objectivityScore": <0-100>,
  "summary": "<2-3 sentences: what type of report this is, overall quality, and key takeaway>",
  "dealBreakers": [{"item":"<finding>","severity":"<critical|major>","recommendation":"<action>"}],
  "notableIssues": [{"item":"<finding>","severity":"moderate","recommendation":"<action>"}],
  "minorObservations": [{"item":"<finding>","severity":"minor","isCosmeticOverreach":<true|false>}],
  "strengths": ["<what this inspector did well>"],
  "concerns": ["<legitimate concern if any — not just that the report is long>"],
  "biasIndicators": ["<only real bias indicators — alarmist language, cosmetic items flagged as structural, etc>"],
  "redFlags": ["<only for actual fraud indicators>"],
  "recommendation": "<one actionable sentence>",
  "emailBuyer": "<professional paragraph to buyer explaining major findings vs cosmetic items>",
  "emailSeller": "<professional paragraph to seller about what genuinely needs addressing>",
  "emailRealtor": "<professional paragraph to agent with deal-relevant summary>"
}

CRITICAL: No line breaks inside any string values. Write emails as single paragraphs with spaces only.`;

      const reportClean = (reportText||"").slice(0,4000).replace(/\n+/g," ").replace(/\r/g,"");
      const raw = await claude(
        SYSTEM,
        `Inspector: ${inspectorName||"Unknown"} | Company: ${companyName||"Unknown"} | License: ${licenseNo||"N/A"} | Property: ${propertyAddress||"N/A"}

REPORT: ${reportClean}`,
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
