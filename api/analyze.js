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

  // ── Call Claude ──────────────────────────────────────────────
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

  // ── Safe JSON parse — tries multiple strategies ──────────────
  function safeParseJSON(str) {
    // Strategy 1: direct parse
    try { return JSON.parse(str); } catch {}
    // Strategy 2: extract first {...} block
    const m1 = str.match(/\{[\s\S]*\}/);
    if (m1) { try { return JSON.parse(m1[0]); } catch {} }
    // Strategy 3: strip markdown fences
    const stripped = str.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    try { return JSON.parse(stripped); } catch {}
    // Strategy 4: extract again after stripping
    const m2 = stripped.match(/\{[\s\S]*\}/);
    if (m2) { try { return JSON.parse(m2[0]); } catch {} }
    // Strategy 5: fix common JSON issues (trailing commas, single quotes)
    try {
      const fixed = str
        .replace(/```json|```/g, "")
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/'/g, '"')
        .trim();
      return JSON.parse(fixed);
    } catch {}
    throw new Error("All JSON parse strategies failed. Raw: " + str.slice(0, 200));
  }

  try {
    // ── MODE: PARSE ──────────────────────────────────────────────
    if (mode === "parse") {
      if (!reportText || reportText.trim().length < 10) {
        return res.status(400).json({ error: "Report text is empty or too short." });
      }

      const truncated = reportText.slice(0, 4000);

      const raw = await callClaude(
        `You are a data extraction specialist for real estate inspection reports.
Your job is to extract specific fields from inspection report text.
CRITICAL RULES:
- Return ONLY a valid JSON object. No explanation, no markdown, no backticks.
- Use empty string "" for any field you cannot find.
- For state, use the 2-letter abbreviation (e.g. TX, CA, FL).
- For zip, use 5 digits only.
- Inspector name is the person who performed the inspection, NOT the client/buyer.
- Look for patterns like "Inspector:", "Inspected by:", "Inspector Name:", "Prepared by:" for the inspector name.
- Look for patterns like "Property Address:", "Subject Property:", "Inspection Address:" for the address.
- Look for patterns like "License #:", "License No:", "Certified Inspector #" for license numbers.

Return this exact JSON structure:
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
        `Extract all fields from this inspection report text:\n\n${truncated}`
      );

      let parsed;
      try {
        parsed = safeParseJSON(raw);
      } catch (parseErr) {
        // Return empty fields rather than failing — user can fill in manually
        console.error("Parse JSON failed:", parseErr.message);
        parsed = {
          inspectorName: "", companyName: "", licenseNo: "",
          street: "", city: "", state: "", zip: "",
          buyerEmail: "", sellerEmail: "", realtorEmail: ""
        };
      }

      return res.status(200).json({ parsed });
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
      if (!userRes.ok) return res.status(401).json({ error: "Session expired. Please log in again." });
      const userId = userData.id;

      // Get profile
      const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`,
        { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
      );
      const profiles = await profileRes.json();
      const profile = profiles[0];

      // Check realtor trial
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

      const truncated = (reportText || "").slice(0, 4000);

      const raw = await callClaude(
        `You are an expert real estate inspection fraud analyst and fairness evaluator.
Analyze the inspection report and return a comprehensive assessment.

CRITICAL RULES:
- Return ONLY a valid JSON object. No explanation, no markdown, no backticks.
- All numeric scores must be integers 0-100.
- balanceScore: 50 = perfectly balanced. Below 35 = buyer-biased (flags too many minor issues). Above 65 = seller-biased (misses real defects).
- fraudRisk must be exactly "Low", "Moderate", or "High".
- inspectorGrade must be exactly "A", "B", "C", "D", or "F".
- All array items must be non-empty strings.
- All email fields must be complete professional emails (3-5 sentences each).

Return this exact JSON:
{
  "trustScore": 75,
  "fraudRisk": "Low",
  "summary": "2-3 sentence plain language summary of the inspection quality",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "concerns": ["concern 1", "concern 2", "concern 3"],
  "inspectorGrade": "B",
  "completenessScore": 75,
  "technicalScore": 75,
  "objectivityScore": 75,
  "balanceScore": 50,
  "emailBuyer": "professional email to buyer summarizing analysis and what it means for them",
  "emailSeller": "professional email to seller summarizing analysis and what it means for them",
  "emailRealtor": "professional email to realtor summarizing analysis and key takeaways",
  "redFlags": [],
  "recommendation": "one sentence actionable recommendation"
}`,
        `Inspector: ${inspectorName || "Unknown"}
Company: ${companyName || "Unknown"}
License: ${licenseNo || "Not provided"}
Property: ${propertyAddress || "Not provided"}

INSPECTION REPORT:
${truncated}`,
        1400
      );

      let analysis;
      try {
        analysis = safeParseJSON(raw);
      } catch (parseErr) {
        console.error("Analyze JSON failed:", parseErr.message, "Raw:", raw.slice(0, 300));
        return res.status(500).json({ error: "AI response could not be parsed. Please try again." });
      }

      // Ensure all required fields exist with defaults
      analysis.trustScore = analysis.trustScore || 70;
      analysis.fraudRisk = analysis.fraudRisk || "Low";
      analysis.inspectorGrade = analysis.inspectorGrade || "B";
      analysis.completenessScore = analysis.completenessScore || 70;
      analysis.technicalScore = analysis.technicalScore || 70;
      analysis.objectivityScore = analysis.objectivityScore || 70;
      analysis.balanceScore = analysis.balanceScore || 50;
      analysis.strengths = analysis.strengths || [];
      analysis.concerns = analysis.concerns || [];
      analysis.redFlags = analysis.redFlags || [];
      analysis.summary = analysis.summary || "Analysis complete.";
      analysis.recommendation = analysis.recommendation || "Review findings carefully before proceeding.";
      analysis.emailBuyer = analysis.emailBuyer || "Please review the attached inspection analysis.";
      analysis.emailSeller = analysis.emailSeller || "Please review the attached inspection analysis.";
      analysis.emailRealtor = analysis.emailRealtor || "Please review the attached inspection analysis.";

      // Increment inspection count in Supabase
      if (userId && SUPABASE_URL && SUPABASE_KEY) {
        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
          },
          body: JSON.stringify({ inspection_count: (profile?.inspection_count || 0) + 1 }),
        }).catch(e => console.error("Failed to increment count:", e));
      }

      return res.status(200).json({ analysis });
    }

    return res.status(400).json({ error: "Unknown mode. Use 'parse' or 'analyze'." });

  } catch (err) {
    console.error("analyze error:", err.message);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
};
