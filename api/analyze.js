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

  const { mode, reportText, inspectorName, companyName, licenseNo, propertyAddress } = req.body;

  async function callClaude(system, userMsg, maxTokens) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
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
    try { return JSON.parse(str); } catch {}
    const m1 = str.match(/\{[\s\S]*\}/);
    if (m1) { try { return JSON.parse(m1[0]); } catch {} }
    const stripped = str.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    try { return JSON.parse(stripped); } catch {}
    const m2 = stripped.match(/\{[\s\S]*\}/);
    if (m2) { try { return JSON.parse(m2[0]); } catch {} }
    try {
      const fixed = str.replace(/```json|```/g, "").replace(/,\s*([}\]])/g, "$1").trim();
      return JSON.parse(fixed);
    } catch {}
    throw new Error("All JSON parse strategies failed. Raw: " + str.slice(0, 300));
  }

  try {
    // ── MODE: PARSE ──────────────────────────────────────────────
    if (mode === "parse") {
      if (!reportText || reportText.trim().length < 10) {
        return res.status(400).json({ error: "Report text is empty or too short." });
      }

      // Send first 5000 chars for better coverage
      const truncated = reportText.slice(0, 5000);

      const raw = await callClaude(
        `You are an expert at reading home inspection reports and extracting structured data.

TASK: Extract specific fields from the inspection report text below.

CRITICAL RULES:
1. Return ONLY a valid JSON object — no explanation, no markdown, no backticks, nothing else.
2. Use empty string "" for any field you cannot confidently find.
3. DO NOT guess or make up values.

FIELD DEFINITIONS — read carefully:
- inspectorName: The LICENSED HOME INSPECTOR who conducted the inspection. Look for "Inspector:", "Inspected By:", "Inspector Name:", "Certified by:", "Performed by:". This is NOT the client, buyer, seller, or repair company.
- companyName: The HOME INSPECTION COMPANY that employs the inspector. Look for "Company:", "Inspection Company:", "Firm:", company name near the top of the report header, or the company logo text. NOT a repair company, NOT a real estate company.
- licenseNo: The inspector's license number. Look for "License #", "License No.", "Lic.", "Cert. #", "Inspector ID:", state license patterns like "TREC #", "HI-", "CPI".
- street: Street number and name of the INSPECTED PROPERTY (not the inspector's office address).
- city: City of the inspected property.
- state: 2-letter state abbreviation of the inspected property (TX, CA, FL, etc.).
- zip: 5-digit ZIP code of the inspected property.
- buyerEmail: Email address labeled as buyer, client, or purchaser. Empty string if not found.
- sellerEmail: Email address labeled as seller or owner. Empty string if not found.
- realtorEmail: Email address labeled as agent, realtor, or broker. Empty string if not found.

Return exactly this JSON structure:
{
  "inspectorName": "",
  "companyName": "",
  "licenseNo": "",
  "street": "",
  "city": "",
  "state": "",
  "zip": "",
  "buyerEmail": "",
  "sellerEmail": "",
  "realtorEmail": ""
}`,
        `Here is the inspection report text to extract fields from:\n\n${truncated}`
      );

      let parsed;
      try {
        parsed = safeParseJSON(raw);
      } catch (parseErr) {
        console.error("Parse JSON failed:", parseErr.message);
        parsed = {
          inspectorName: "", companyName: "", licenseNo: "",
          street: "", city: "", state: "", zip: "",
          buyerEmail: "", sellerEmail: "", realtorEmail: ""
        };
      }

      // Clean up any accidental "Unknown" or placeholder values
      const cleaned = {};
      for (const [k, v] of Object.entries(parsed)) {
        const val = String(v || "").trim();
        cleaned[k] = (val === "Unknown" || val === "N/A" || val === "n/a" || val === "null") ? "" : val;
      }

      return res.status(200).json({ parsed: cleaned });
    }

    // ── MODE: ANALYZE ────────────────────────────────────────────
    if (mode === "analyze") {
      const token = (req.headers.authorization || "").replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Login required to analyze reports." });

      // Verify token with Supabase
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` },
      });
      const userData = await userRes.json();

      if (!userRes.ok) {
        return res.status(401).json({ 
          error: "Your session has expired. Please sign out and sign back in.",
          code: "SESSION_EXPIRED"
        });
      }

      const userId = userData.id;

      // Get profile
      const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`,
        { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
      );
      const profiles = await profileRes.json();
      const profile = profiles[0];

      // Check realtor access
      if (profile?.role === "realtor") {
        const trialStart = new Date(profile.trial_started_at);
        const daysSince = (Date.now() - trialStart) / (1000 * 60 * 60 * 24);
        const expired = daysSince > 14;
        const paid = profile.subscription_status === "active";
        const freeVol = (profile.inspection_count || 0) >= 50;
        if (expired && !paid && !freeVol) {
          return res.status(403).json({
            code: "TRIAL_EXPIRED",
            message: "Your 14-day trial has ended. Subscribe for $20/year to continue.",
          });
        }
      }

      const truncated = (reportText || "").slice(0, 4500);

      const raw = await callClaude(
        `You are an expert real estate inspection fraud analyst and fairness evaluator.

Analyze this home inspection report and return a comprehensive, accurate assessment.

CRITICAL RULES:
- Return ONLY a valid JSON object — no markdown, no backticks, no explanation.
- All scores are integers 0-100.
- balanceScore meaning: 50 = perfectly balanced. Under 35 = inspector is buyer-biased (flags too many minor/cosmetic issues as major concerns). Over 65 = inspector is seller-biased (downplays or misses real defects that matter).
- fraudRisk: "Low" = report appears thorough and honest. "Moderate" = some inconsistencies. "High" = significant red flags like missing sections, vague language throughout, or clear bias.
- inspectorGrade: Overall letter grade A-F based on report quality.
- strengths and concerns: Be specific to THIS report, not generic. Reference actual findings.
- emails: Write complete, professional 4-5 sentence emails. Each should be tailored to that recipient's interests.
- redFlags: Only include if genuine concerns exist. Empty array is fine for good reports.

Return this exact JSON — all fields required:
{
  "trustScore": 75,
  "fraudRisk": "Low",
  "summary": "2-3 sentences summarizing the inspection quality and key findings",
  "strengths": ["specific strength 1", "specific strength 2", "specific strength 3"],
  "concerns": ["specific concern 1", "specific concern 2", "specific concern 3"],
  "inspectorGrade": "B",
  "completenessScore": 75,
  "technicalScore": 75,
  "objectivityScore": 75,
  "balanceScore": 50,
  "emailBuyer": "Dear Buyer, [professional 4-5 sentence email about what this inspection means for your purchase decision]",
  "emailSeller": "Dear Seller, [professional 4-5 sentence email about what this inspection means for your sale]",
  "emailRealtor": "Dear Agent, [professional 4-5 sentence email summarizing key findings and recommended next steps]",
  "redFlags": [],
  "recommendation": "One clear, actionable sentence recommending next steps"
}`,
        `Inspector: ${inspectorName || "Unknown"}
Company: ${companyName || "Unknown"}
License: ${licenseNo || "Not provided"}
Property: ${propertyAddress || "Not provided"}

FULL INSPECTION REPORT TEXT:
${truncated}`,
        1500
      );

      let analysis;
      try {
        analysis = safeParseJSON(raw);
      } catch (parseErr) {
        console.error("Analyze JSON failed:", parseErr.message, "\nRaw:", raw.slice(0, 400));
        return res.status(500).json({ 
          error: "AI response could not be parsed. The report may be too complex. Please try again." 
        });
      }

      // Ensure all fields exist with safe defaults
      const defaults = {
        trustScore: 70, fraudRisk: "Low", inspectorGrade: "B",
        completenessScore: 70, technicalScore: 70, objectivityScore: 70, balanceScore: 50,
        strengths: ["Report submitted for review"], concerns: ["Manual review recommended"],
        redFlags: [], summary: "Analysis complete. Please review the full report.",
        recommendation: "Review all findings carefully before proceeding.",
        emailBuyer: "Dear Buyer, please review the attached inspection analysis carefully before making your final decision.",
        emailSeller: "Dear Seller, please review the attached inspection analysis to understand the findings.",
        emailRealtor: "Dear Agent, please review the attached inspection analysis for key findings and next steps."
      };

      for (const [key, val] of Object.entries(defaults)) {
        if (analysis[key] === undefined || analysis[key] === null || analysis[key] === "") {
          analysis[key] = val;
        }
      }

      // Increment inspection count
      if (userId) {
        fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
          },
          body: JSON.stringify({ inspection_count: (profile?.inspection_count || 0) + 1 }),
        }).catch(e => console.error("Count increment failed:", e));
      }

      return res.status(200).json({ analysis });
    }

    return res.status(400).json({ error: "Unknown mode." });

  } catch (err) {
    console.error("analyze handler error:", err.message);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
};
