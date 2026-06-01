module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

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
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens || 900,
        system,
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error?.message || "Anthropic error");
    return data.content?.find(b => b.type === "text")?.text || "{}";
  }

  function safeParseJSON(str) {
    try { return JSON.parse(str); } catch {}
    const match = str.match(/\{[\s\S]*\}/);
    if (match) { try { return JSON.parse(match[0]); } catch {} }
    throw new Error("Could not parse AI response");
  }

  try {
    // ── PARSE MODE ───────────────────────────────────────────
    if (mode === "parse") {
      const raw = await callClaude(
        `You are a data extraction specialist for real estate inspection reports.
Extract fields from the report. Return ONLY a raw JSON object, no markdown, no backticks.
Use empty string for any field not found.
{"inspectorName":"","companyName":"","licenseNo":"","street":"","city":"","state":"","zip":"","buyerEmail":"","sellerEmail":"","realtorEmail":""}`,
        `Extract fields:\n\n${(reportText || "").slice(0, 3500)}`
      );
      return res.status(200).json({ parsed: safeParseJSON(raw) });
    }

    // ── ANALYZE MODE ─────────────────────────────────────────
    if (mode === "analyze") {
      const token = (req.headers.authorization || "").replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Login required." });

      // Verify token and get user
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

      // Check realtor access
      if (profile?.role === "realtor") {
        const trialStart = new Date(profile.trial_started_at);
        const daysSince = (Date.now() - trialStart) / (1000 * 60 * 60 * 24);
        const expired = daysSince > 14;
        const paid = profile.subscription_status === "active";
        const freeVol = (profile.inspection_count || 0) >= 20;
        if (expired && !paid && !freeVol) {
          return res.status(403).json({
            code: "TRIAL_EXPIRED",
            message: "Your 14-day trial has ended. Subscribe for $20/year to continue.",
          });
        }
      }

      const raw = await callClaude(
        `You are an expert real estate inspection fraud analyst.
Analyze this inspection report. Return ONLY a raw JSON object, no markdown, no backticks:
{"trustScore":75,"fraudRisk":"Low","summary":"","strengths":["","",""],"concerns":["","",""],"inspectorGrade":"B","completenessScore":75,"technicalScore":75,"objectivityScore":75,"emailBuyer":"","emailSeller":"","emailRealtor":"","redFlags":[],"recommendation":""}`,
        `Inspector: ${inspectorName}\nCompany: ${companyName || "Unknown"}\nLicense: ${licenseNo || "N/A"}\nProperty: ${propertyAddress}\n\nREPORT:\n${(reportText || "").slice(0, 3500)}`,
        1200
      );

      const analysis = safeParseJSON(raw);

      // Increment inspection count
      await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({ inspection_count: (profile?.inspection_count || 0) + 1 }),
      });

      return res.status(200).json({ analysis });
    }

    return res.status(400).json({ error: "Unknown mode" });
  } catch (err) {
    console.error("analyze error:", err);
    return res.status(500).json({ error: err.message });
  }
};
