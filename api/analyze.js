// api/analyze.js — Phase 1: Balanced AI scoring + permanent Supabase storage
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_KEY) return res.status(500).json({ error: "Anthropic API key not configured." });

  const { mode, reportText, inspectorName, companyName, licenseNo, propertyAddress, reportId, userId } = req.body;

  async function callClaude(system, userMsg, maxTokens, useHaiku = true) {
    const model = useHaiku ? "claude-haiku-4-5" : "claude-sonnet-4-5";
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens || 1000,
        system,
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error?.message || `Anthropic error: ${JSON.stringify(data)}`);
    return data.content?.find(b => b.type === "text")?.text || "{}";
  }

  function safeParseJSON(str) {
    const attempts = [
      () => JSON.parse(str),
      () => JSON.parse(str.match(/\{[\s\S]*\}/)?.[0]),
      () => JSON.parse(str.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim()),
      () => JSON.parse(str.replace(/```json|```/g, "").replace(/,\s*([}\]])/g, "$1").trim()),
    ];
    for (const attempt of attempts) {
      try { const r = attempt(); if (r) return r; } catch {}
    }
    throw new Error("JSON parse failed. Raw: " + str.slice(0, 200));
  }

  // ── Save report to Supabase ──────────────────────────────────
  async function saveReport(reportData) {
    if (!SUPABASE_URL || !SUPABASE_KEY) return null;
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/inspection_reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Prefer": "return=representation",
        },
        body: JSON.stringify(reportData),
      });
      const data = await r.json();
      return Array.isArray(data) ? data[0] : data;
    } catch (e) {
      console.error("saveReport failed:", e.message);
      return null;
    }
  }

  // ── Update report with analysis ──────────────────────────────
  async function updateReport(id, analysisData) {
    if (!SUPABASE_URL || !SUPABASE_KEY || !id) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/inspection_reports?id=eq.${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify(analysisData),
      });
    } catch (e) {
      console.error("updateReport failed:", e.message);
    }
  }

  // ── Increment inspection count ───────────────────────────────
  async function incrementCount(userId, currentCount) {
    if (!SUPABASE_URL || !SUPABASE_KEY || !userId) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({ inspection_count: (currentCount || 0) + 1 }),
      });
    } catch (e) {
      console.error("incrementCount failed:", e.message);
    }
  }

  try {
    // ── MODE: PARSE ──────────────────────────────────────────────
    if (mode === "parse") {
      if (!reportText || reportText.trim().length < 10) {
        return res.status(400).json({ error: "Report text is too short or empty." });
      }

      const raw = await callClaude(
        `You are an expert at extracting structured data from home inspection reports.

RULES:
- Return ONLY a raw JSON object. No markdown, no backticks, no explanation.
- Use empty string "" for any field not found. Never use "Unknown", "N/A", or null.
- inspectorName: The licensed inspector who performed the inspection. Look for "Inspector:", "Inspected by:", "Performed by:", "Inspector Name:", "Certified by:". NOT the client, buyer, seller, or repair person.
- companyName: The home inspection company ONLY. NOT repair companies, NOT real estate agencies. Look for the company name near the inspector's name or in the report header.
- licenseNo: Inspector's license. Look for "License #", "TREC #", "HI-", "Lic.", "Cert. #", "CPI#".
- street/city/state/zip: Address of the INSPECTED PROPERTY only. state = 2-letter abbreviation.
- buyerEmail/sellerEmail/realtorEmail: Only if explicitly labeled as such.

Return exactly:
{"inspectorName":"","companyName":"","licenseNo":"","street":"","city":"","state":"","zip":"","buyerEmail":"","sellerEmail":"","realtorEmail":""}`,
        `Extract fields from this inspection report:\n\n${reportText.slice(0, 5000)}`
      );

      let parsed;
      try { parsed = safeParseJSON(raw); }
      catch { parsed = { inspectorName:"", companyName:"", licenseNo:"", street:"", city:"", state:"", zip:"", buyerEmail:"", sellerEmail:"", realtorEmail:"" }; }

      // Clean placeholder values
      const cleaned = Object.fromEntries(
        Object.entries(parsed).map(([k, v]) => {
          const s = String(v || "").trim();
          return [k, ["Unknown","N/A","n/a","null","undefined","none","N/A"].includes(s) ? "" : s];
        })
      );

      return res.status(200).json({ parsed: cleaned });
    }

    // ── MODE: ANALYZE ────────────────────────────────────────────
    if (mode === "analyze") {
      const token = (req.headers.authorization || "").replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Login required to analyze reports." });

      // Verify token
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` },
      });
      const userData = await userRes.json();
      if (!userRes.ok) return res.status(401).json({ error: "Session expired. Please sign out and sign back in.", code: "SESSION_EXPIRED" });

      const authUserId = userData.id;

      // Get profile
      const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${authUserId}&select=*`,
        { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
      );
      const profiles = await profileRes.json();
      const profile = profiles[0];

      // Check realtor trial/access
      if (profile?.role === "realtor") {
        const trialStart = new Date(profile.trial_started_at);
        const daysSince = (Date.now() - trialStart) / (1000 * 60 * 60 * 24);
        const expired = daysSince > 14;
        const paid = profile.subscription_status === "active";
        const freeVol = (profile.inspection_count || 0) >= 50;
        if (expired && !paid && !freeVol) {
          return res.status(403).json({ code: "TRIAL_EXPIRED", message: "Your 14-day trial has ended. Subscribe for $20/year to continue." });
        }
      }

      const truncated = (reportText || "").slice(0, 5000);
      const now = new Date().toISOString();

      // ── Save initial report record to DB ──────────────────────
      const savedReport = await saveReport({
        inspector_name: inspectorName || "Unknown",
        company_name: companyName || null,
        license_no: licenseNo || null,
        property_address: propertyAddress || null,
        submitted_by: authUserId,
        status: "analyzing",
        created_at: now,
        report_year: new Date().getFullYear(),
        report_text_excerpt: truncated.slice(0, 500),
      });

      const dbReportId = savedReport?.id || null;

      // ── BALANCED AI ANALYSIS ──────────────────────────────────
      // This is the critical Phase 1 rewrite — neutral, professional, balanced scoring

      const BALANCED_SYSTEM_PROMPT = `You are a neutral, professional real estate inspection analyst with 20+ years of experience. Your role is to evaluate inspection reports FAIRLY for both buyers and sellers.

## CRITICAL SCORING PHILOSOPHY

### What inspectors SHOULD flag (these are EXPECTED findings — do NOT inflate bias score):
- Structural issues (foundation cracks, framing problems)
- Roof condition (missing shingles, active leaks, end-of-life)
- Electrical issues (outdated panels, aluminum wiring, missing GFCIs in wet areas)
- Plumbing issues (leaks, supply/drain problems, water heater age/condition)
- HVAC condition (age, efficiency, needed repairs)
- Water intrusion / moisture damage
- Safety hazards (CO, radon, smoke detectors, stair safety)
→ Finding these items = BALANCED inspector. Do NOT penalize for noting these.

### What inflates the Balance Score toward BUYER-BIASED (penalize heavily):
- Calling cosmetic wear "defects" (normal paint wear, minor scuffs, aging carpet)
- Flagging normal home aging as urgent concerns
- Using alarmist language for minor/cosmetic items
- Including excessive minor landscape notes as structural concerns
- Flagging items that are purely cosmetic as "immediate action required"
- Disproportionate page count on minor observations vs major findings
- Using vague, subjective language to pad the report

## REPORT STRUCTURE
Organize findings into three tiers with different weights:

1. DEAL BREAKERS / MAJOR CONCERNS (weight: HIGH importance, EXPECTED to find)
   - Structural, safety, major systems failures
   - Buyers SHOULD know these. Sellers SHOULD address these.
   - Finding these = balanced inspector behavior.

2. NOTABLE ISSUES (weight: MEDIUM — judgment required)
   - Repairs needed but not urgent
   - Items near end of useful life
   - Deferred maintenance with real cost impact

3. MINOR OBSERVATIONS (weight: LOW — flag if excessive)
   - Cosmetic items, normal wear, aesthetic preferences
   - If an inspector has 20+ items here relative to 2-3 major items, that's BUYER BIAS.
   - If minor items use alarmist language, that's BUYER BIAS.

## BALANCE SCORE CALCULATION
- 50 = perfectly balanced/fair
- Below 35 = buyer-biased (too many minor/cosmetic items flagged as major, alarmist language)
- Above 65 = seller-biased (missing obvious defects, vague on real issues)
- IMPORTANT: A report with many LEGITIMATE major findings is NOT buyer-biased. It's thorough.
- ONLY penalize when cosmetic/minor items are over-weighted or use alarmist language.

## PROFESSIONAL TONE
- Be objective and professional
- Avoid alarmist language in your analysis
- Acknowledge that some findings are normal for home age/type
- Distinguish clearly between "urgent" and "monitor" and "cosmetic"

Return ONLY this JSON — no markdown, no backticks:
{
  "trustScore": <integer 0-100>,
  "fraudRisk": "<Low|Moderate|High>",
  "balanceScore": <integer 0-100>,
  "inspectorGrade": "<A|B|C|D|F>",
  "completenessScore": <integer 0-100>,
  "technicalScore": <integer 0-100>,
  "objectivityScore": <integer 0-100>,
  "summary": "<2-3 sentence professional summary distinguishing major vs minor findings>",
  "dealBreakers": [{"item": "<finding>", "severity": "critical|major", "recommendation": "<action>"}],
  "notableIssues": [{"item": "<finding>", "severity": "moderate", "recommendation": "<action>"}],
  "minorObservations": [{"item": "<finding>", "severity": "minor", "isCosmeticOverreach": <true|false>}],
  "strengths": ["<what the inspector did well>"],
  "concerns": ["<legitimate concern about report quality>"],
  "biasIndicators": ["<specific language or pattern indicating buyer bias, if any>"],
  "redFlags": ["<fraud indicators if any>"],
  "recommendation": "<one professional actionable sentence>",
  "emailBuyer": "<professional 4-sentence email distinguishing major vs cosmetic findings>",
  "emailSeller": "<professional 4-sentence email helping seller understand what actually needs addressing>",
  "emailRealtor": "<professional 4-sentence email with deal-relevant summary and next steps>"
}`;

      const raw = await callClaude(
        BALANCED_SYSTEM_PROMPT,
        `Inspector: ${inspectorName || "Unknown"}
Company: ${companyName || "Unknown"}
License: ${licenseNo || "Not provided"}
Property: ${propertyAddress || "Not provided"}

FULL INSPECTION REPORT:
${truncated}`,
        1800,
        false // Use Sonnet for deep analysis
      );

      let analysis;
      try { analysis = safeParseJSON(raw); }
      catch (e) {
        console.error("Analysis parse failed:", e.message, "\nRaw:", raw.slice(0, 300));
        return res.status(500).json({ error: "AI response could not be parsed. Please try again." });
      }

      // Ensure all required fields with safe defaults
      const defaults = {
        trustScore: 70, fraudRisk: "Low", balanceScore: 50,
        inspectorGrade: "B", completenessScore: 70, technicalScore: 70, objectivityScore: 70,
        summary: "Analysis complete.", dealBreakers: [], notableIssues: [], minorObservations: [],
        strengths: [], concerns: [], biasIndicators: [], redFlags: [],
        recommendation: "Review all findings carefully before proceeding.",
        emailBuyer: "Please review the attached inspection analysis.",
        emailSeller: "Please review the attached inspection analysis.",
        emailRealtor: "Please review the attached inspection analysis.",
      };
      for (const [k, v] of Object.entries(defaults)) {
        if (analysis[k] === undefined || analysis[k] === null || analysis[k] === "") analysis[k] = v;
      }

      // ── Save analysis to DB ───────────────────────────────────
      const analysisToSave = {
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
      };

      // Save asynchronously (don't block response)
      if (dbReportId) {
        updateReport(dbReportId, analysisToSave).catch(console.error);
      }

      // Increment inspection count
      incrementCount(authUserId, profile?.inspection_count).catch(console.error);

      return res.status(200).json({
        analysis,
        reportId: dbReportId,
        saved: !!dbReportId,
      });
    }

    return res.status(400).json({ error: "Unknown mode." });

  } catch (err) {
    console.error("analyze handler error:", err.message);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
};
