export default async function handler(req, res) {
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
    // Strip common markdown wrappers
    const strip = s => s
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "")
      .trim();

    // Extract the first complete {...} block
    const extract = s => {
      const start = s.indexOf("{");
      const end = s.lastIndexOf("}");
      if (start >= 0 && end > start) return s.slice(start, end + 1);
      return s;
    };

    const clean = strip(str);
    const extracted = extract(str);
    const cleanExtracted = extract(clean);

    const tries = [
      () => JSON.parse(str),
      () => JSON.parse(clean),
      () => JSON.parse(extracted),
      () => JSON.parse(cleanExtracted),
      () => JSON.parse(str.replace(/```json|```/g, "").replace(/,\s*([}\]])/g, "$1").trim()),
      () => JSON.parse(clean.replace(/,\s*([}\]])/g, "$1")),
    ];
    for (const t of tries) {
      try { const r = t(); if (r && typeof r === "object") return r; } catch {}
    }
    throw new Error("JSON parse failed. Raw: " + str.slice(0, 150));
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

      // Search multiple sections: cover page (top), middle, and end
      const fullLen = reportText.length;
      const top = reportText.slice(0, 3000);
      const mid = fullLen > 8000 ? reportText.slice(Math.floor(fullLen / 2) - 1000, Math.floor(fullLen / 2) + 1000) : "";
      const bottom = fullLen > 4000 ? reportText.slice(-1500) : "";
      const combined = [top, mid, bottom].filter(Boolean).join("\n\n[...]\n\n").slice(0, 6000);

      const PARSE_PROMPT = `You are a data extraction expert for property inspection and repair documents.

YOUR RESPONSE MUST START WITH { AND END WITH }. No backticks. No markdown. No explanation before or after.

IMPORTANT: The text may begin with "FILE NAME HINT:" — use the filename to extract the address.
Example: If filename is "2309 Lyla Ln_Repair Estimate.pdf" then street="2309 Lyla Ln"

Search ALL sections of the text carefully.

FIELD DEFINITIONS:
- inspectorName: Person who performed the inspection or estimate. Look for "Inspector:", "Inspected By:", "Technician:", "Estimator:", "Prepared By:", "Report By:". Empty string if not found.
- companyName: The company that produced this document. Look in the header, footer, letterhead. Include ANY company name — repair companies, inspection companies, etc.
- licenseNo: License number. Look for "License #", "TREC #", "Lic #", "Cert #", "HI-". Empty if not found.
- street: Street number + street name of the SUBJECT PROPERTY. Check in this order:
  1. "FILE NAME HINT" line at very top — extract address from filename first
  2. "Property Address:", "Subject Property:", "Address:", "Property:", "Location:"
  3. Any standalone address like "2309 Lyla Ln" anywhere in the text
- city: City of the subject property.
- state: 2-letter state code (TX, CA, FL, etc).
- zip: 5-digit ZIP code.
- buyerEmail: Email labeled buyer/client. Empty string if not found.
- sellerEmail: Email labeled seller. Empty string if not found.
- realtorEmail: Email labeled agent/realtor. Empty string if not found.

Return ONLY this JSON with all 10 fields, nothing else:
{"inspectorName":"","companyName":"","licenseNo":"","street":"","city":"","state":"","zip":"","buyerEmail":"","sellerEmail":"","realtorEmail":""}`;

      const raw = await claude(PARSE_PROMPT, `Extract all fields from this document:\n\n${combined}`, 500, false);

      let parsed;
      try { parsed = parseJSON(raw); }
      catch {
        console.error("Parse failed, raw:", raw.slice(0, 200));
        parsed = {};
      }

      // Clean and normalize
      const empty = { inspectorName:"",companyName:"",licenseNo:"",street:"",city:"",state:"",zip:"",buyerEmail:"",sellerEmail:"",realtorEmail:"" };
      const cleaned = { ...empty };
      const junk = new Set(["unknown","n/a","na","null","none","not found","not listed","not provided","not available","-","—"]);
      for (const k of Object.keys(empty)) {
        const v = String(parsed[k] || "").trim();
        cleaned[k] = junk.has(v.toLowerCase()) ? "" : v;
      }

      // Regex fallbacks if AI missed the address
      if (!cleaned.street) {
        const m = reportText.match(/(\d{2,5})\s+([A-Za-z0-9][A-Za-z0-9\s\.]{2,30}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Road|Rd|Way|Court|Ct|Place|Pl|Loop|Trail|Parkway|Pkwy|Highway|Hwy|Circle|Cir|Terrace|Terr|Pass|Run|Cove|Cv)\.?)/i);
        if (m) cleaned.street = m[0].trim();
      }
      if (!cleaned.city || !cleaned.state || !cleaned.zip) {
        const m = reportText.match(/([A-Z][a-zA-Z\s]{2,20}),\s*([A-Z]{2})\s+(\d{5})/);
        if (m) {
          if (!cleaned.city) cleaned.city = m[1].trim();
          if (!cleaned.state) cleaned.state = m[2].trim();
          if (!cleaned.zip) cleaned.zip = m[3].trim();
        }
      }
      // Try to extract state from 2-letter state code near zip
      if (!cleaned.state) {
        const m = reportText.match(/\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s+\d{5}/);
        if (m) cleaned.state = m[1];
      }

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
      const SYSTEM = `You are a neutral, experienced real estate inspection analyst with 20+ years of experience evaluating inspection reports professionally and fairly.

## CRITICAL SCORING PHILOSOPHY

### MAJOR ITEMS — Low bias impact (inspectors SHOULD find these):
Finding these items is EXPECTED and BALANCED behavior. Do NOT inflate the buyer-bias score for these:
- Structural issues (foundation, framing, load-bearing elements)
- Roof condition (leaks, missing shingles, deterioration, age)
- Electrical (panel issues, wiring, code violations, GFCI)
- Plumbing (leaks, supply/drain, water heater, pressure)
- HVAC (age, condition, efficiency, needed repairs)
- Water intrusion and moisture damage
- Safety hazards (CO, smoke detectors, stair safety, etc.)
→ An inspector flagging MANY of these = THOROUGH, not biased

### COSMETIC/MINOR ITEMS — HIGH buyer-bias impact when over-reported:
These significantly increase the buyer-bias score when an inspector over-reports them:
- Small paint chips, touch-up needed, scuffs
- Normal wear on flooring, carpet, countertops
- Minor landscaping concerns
- Aging/weathering that is cosmetic only
- Light fixture aesthetics
- Caulking at sinks/tubs (normal maintenance)
- Screen tears, minor hardware issues
→ Inspector padding report with 10+ cosmetic items = BUYER BIAS

## BALANCE SCORE RULES:
- 50 = perfectly balanced and professional
- Under 35 = buyer-biased (too many cosmetic items flagged urgently, alarmist language, excessive minor issues relative to major ones)
- Over 65 = seller-biased (misses obvious defects, vague throughout, underreports issues)
- A report with 20 major findings is NOT biased — it is thorough
- A report with 3 major findings and 25 cosmetic items IS buyer-biased

## OUTPUT STRUCTURE:
Organize ALL findings into exactly three tiers:
1. dealBreakers: Structural, safety, major system failures — things that affect deal negotiation significantly
2. notableIssues: Real repairs needed but not urgent, items nearing end of life, deferred maintenance with cost impact
3. minorObservations: Cosmetic, normal wear, monitor-only items. Flag isCosmeticOverreach=true if an inspector treats cosmetic items as major concerns.

CRITICAL: Return ONLY the raw JSON object. Your response must start with { and end with }. NO backticks, NO ```json, NO markdown, NO explanation before or after:
{
  "trustScore": <0-100>,
  "fraudRisk": "<Low|Moderate|High>",
  "balanceScore": <0-100>,
  "inspectorGrade": "<A|B|C|D|F>",
  "completenessScore": <0-100>,
  "technicalScore": <0-100>,
  "objectivityScore": <0-100>,
  "summary": "<2-3 professional sentences distinguishing major vs minor findings, not alarmist>",
  "dealBreakers": [{"item":"<finding>","severity":"<critical|major>","recommendation":"<action>"}],
  "notableIssues": [{"item":"<finding>","severity":"moderate","recommendation":"<action>"}],
  "minorObservations": [{"item":"<finding>","severity":"minor","isCosmeticOverreach":<true|false>}],
  "strengths": ["<specific strength>"],
  "concerns": ["<specific concern about report quality>"],
  "biasIndicators": ["<specific pattern indicating buyer bias, if any>"],
  "redFlags": ["<fraud indicator if any>"],
  "recommendation": "<one professional actionable sentence>",
  "emailBuyer": "<4-sentence professional email that clearly separates major findings from cosmetic ones>",
  "emailSeller": "<4-sentence professional email helping seller understand what genuinely needs addressing>",
  "emailRealtor": "<4-sentence professional email with deal-relevant summary and recommended next steps>"
}`;

      const raw = await claude(
        SYSTEM,
        `Inspector: ${inspectorName||"Unknown"}
Company: ${companyName||"Unknown"}
License: ${licenseNo||"Not provided"}
Property: ${propertyAddress||"Not provided"}

INSPECTION REPORT (${(reportText||"").length} characters):
${(reportText||"").slice(0,5000)}`,
        2000, true
      );

      let analysis;
      try { analysis = parseJSON(raw); }
      catch (e) {
        console.error("Analysis parse failed:", e.message, raw.slice(0,200));
        return res.status(500).json({ error: "AI response could not be parsed. Please try again." });
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
