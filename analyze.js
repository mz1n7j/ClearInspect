const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function callClaude(system, userMsg, maxTokens = 900) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
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
  throw new Error("Could not parse AI response as JSON");
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { mode, reportText, inspectorName, companyName, licenseNo, propertyAddress } = req.body;

  try {
    if (mode === "parse") {
      const raw = await callClaude(
        `You are a data extraction specialist for real estate inspection reports.
Extract fields from the report. Return ONLY a raw JSON object, no markdown, no backticks.
Use empty string "" for any field not found.
{"inspectorName":"","companyName":"","licenseNo":"","street":"","city":"","state":"","zip":"","buyerEmail":"","sellerEmail":"","realtorEmail":""}`,
        `Extract fields from this inspection report:\n\n${(reportText || "").slice(0, 3500)}`
      );
      const parsed = safeParseJSON(raw);
      return res.status(200).json({ parsed });
    }

    if (mode === "analyze") {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Login required." });

      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr) return res.status(401).json({ error: "Session expired. Please log in again." });

      const { data: profile } = await supabase
        .from("profiles").select("*").eq("id", user.id).single();

      if (profile?.role === "realtor") {
        const trialStart = new Date(profile.trial_started_at);
        const daysSince = (Date.now() - trialStart) / (1000 * 60 * 60 * 24);
        const trialExpired = daysSince > 14;
        const hasPaid = profile.subscription_status === "active";
        const freeByVolume = profile.inspection_count >= 20;
        if (trialExpired && !hasPaid && !freeByVolume) {
          return res.status(403).json({
            error: "Trial expired", code: "TRIAL_EXPIRED",
            message: "Your 14-day trial has ended. Subscribe for $20/year to continue.",
          });
        }
      }

      const raw = await callClaude(
        `You are an expert real estate inspection fraud analyst.
Analyze this inspection report for quality, completeness, and fraud indicators.
Return ONLY a raw JSON object, no markdown, no backticks:
{"trustScore":0,"fraudRisk":"Low","summary":"","strengths":["","",""],"concerns":["","",""],"inspectorGrade":"A","completenessScore":0,"technicalScore":0,"objectivityScore":0,"emailBuyer":"","emailSeller":"","emailRealtor":"","redFlags":[],"recommendation":""}`,
        `Inspector: ${inspectorName}\nCompany: ${companyName || "Unknown"}\nLicense: ${licenseNo || "Not provided"}\nProperty: ${propertyAddress}\n\nREPORT:\n${(reportText || "").slice(0, 3500)}`,
        1200
      );

      const analysis = safeParseJSON(raw);

      // Increment inspection count
      await supabase.rpc("increment_inspection_count", { user_id: user.id });

      return res.status(200).json({ analysis });
    }

    return res.status(400).json({ error: "Unknown mode" });
  } catch (err) {
    console.error("analyze error:", err);
    return res.status(500).json({ error: err.message });
  }
};
