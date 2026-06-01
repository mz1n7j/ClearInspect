export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error:"API key not configured." });

  const { mode, reportText, inspectorName, companyName, licenseNo, propertyAddress } = req.body;

  try {
    // ── MODE 1: Parse the report to extract fields ──────────────
    if (mode === "parse") {
      const res2 = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01" },
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:600,
          system:`You are a data extraction specialist for real estate inspection reports.
Extract fields from the report text. Respond ONLY in valid JSON, no markdown:
{
  "inspectorName": "<full name or empty string>",
  "companyName": "<company or empty string>",
  "licenseNo": "<license number or empty string>",
  "street": "<street address or empty string>",
  "city": "<city or empty string>",
  "state": "<2-letter state code or empty string>",
  "zip": "<5-digit zip or empty string>",
  "buyerEmail": "<email or empty string>",
  "sellerEmail": "<email or empty string>",
  "realtorEmail": "<email or empty string>"
}
If a field is not found in the report, return an empty string for that field.`,
          messages:[{ role:"user", content:`Extract fields from this inspection report:\n\n${(reportText||"").slice(0,3000)}` }],
        }),
      });
      const data = await res2.json();
      const raw = data.content?.find(b=>b.type==="text")?.text || "{}";
      const parsed = JSON.parse(raw.replace(/```json|```/g,"").trim());
      return res.status(200).json({ parsed });
    }

    // ── MODE 2: Full analysis ────────────────────────────────────
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST",
      headers:{ "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01" },
      body: JSON.stringify({
        model:"claude-sonnet-4-20250514",
        max_tokens:1200,
        system:`You are an expert real estate inspection fraud analyst.
Analyze inspection reports for quality, completeness, and fraud indicators.
Respond ONLY in valid JSON, no markdown:
{
  "trustScore": <0-100>,
  "fraudRisk": "<Low|Moderate|High>",
  "summary": "<2-3 sentence summary>",
  "strengths": ["<point>","<point>","<point>"],
  "concerns": ["<point>","<point>","<point>"],
  "inspectorGrade": "<A|B|C|D|F>",
  "completenessScore": <0-100>,
  "technicalScore": <0-100>,
  "objectivityScore": <0-100>,
  "emailBuyer": "<professional email body to buyer>",
  "emailSeller": "<professional email body to seller>",
  "emailRealtor": "<professional email body to realtor>",
  "redFlags": ["<flag>"],
  "recommendation": "<one sentence recommendation>"
}`,
        messages:[{ role:"user", content:`Inspector: ${inspectorName}\nCompany: ${companyName||"Unknown"}\nLicense: ${licenseNo||"Not provided"}\nProperty: ${propertyAddress}\n\nREPORT:\n${(reportText||"").slice(0,3000)}` }],
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error:`Anthropic error: ${data.error?.message}` });
    const raw = data.content?.find(b=>b.type==="text")?.text || "{}";
    const analysis = JSON.parse(raw.replace(/```json|```/g,"").trim());
    return res.status(200).json({ analysis });

  } catch(err) {
    console.error(err);
    return res.status(500).json({ error:"Server error: " + err.message });
  }
}
