// api/analyze.js
// Vercel Serverless Function — keeps your Anthropic API key secret on the server.
// The frontend calls POST /api/analyze instead of Anthropic directly.

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured on server." });
  }

  try {
    const { inspectorName, companyName, licenseNo, propertyAddress, reportText } = req.body;

    if (!inspectorName || !propertyAddress || !reportText) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const systemPrompt = `You are an expert real estate inspection fraud analyst.
Analyze inspection reports to detect quality, completeness, and potential fraud indicators.
Respond ONLY in valid JSON with this exact shape:
{
  "trustScore": <integer 0-100>,
  "fraudRisk": "<Low|Moderate|High>",
  "summary": "<2-3 sentence plain-language summary>",
  "strengths": ["<point>","<point>","<point>"],
  "concerns": ["<point>","<point>","<point>"],
  "inspectorGrade": "<A|B|C|D|F>",
  "completenessScore": <integer 0-100>,
  "technicalScore": <integer 0-100>,
  "objectivityScore": <integer 0-100>,
  "emailBuyer": "<professional email body to buyer summarizing analysis>",
  "emailSeller": "<professional email body to seller summarizing analysis>",
  "emailRealtor": "<professional email body to realtor summarizing analysis>",
  "redFlags": ["<flag if any, else empty array>"],
  "recommendation": "<one sentence actionable recommendation>"
}`;

    const userMsg = `Inspector: ${inspectorName}
Company: ${companyName || "Unknown"}
License: ${licenseNo || "Not provided"}
Property: ${propertyAddress}

INSPECTION REPORT CONTENT:
${reportText.slice(0, 3000)}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: `Anthropic API error: ${err}` });
    }

    const data = await response.json();
    const raw = data.content?.find((b) => b.type === "text")?.text || "{}";
    const clean = raw.replace(/```json|```/g, "").trim();
    const analysis = JSON.parse(clean);

    return res.status(200).json({ analysis });
  } catch (err) {
    console.error("analyze error:", err);
    return res.status(500).json({ error: "Internal server error: " + err.message });
  }
}
