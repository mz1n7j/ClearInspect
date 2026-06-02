module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://inspectortrust.com";

  const { action } = req.body;

  try {
    if (action === "checkout") {
      const params = new URLSearchParams({
        mode: "subscription",
        "payment_method_types[0]": "card",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][product_data][name]": "InspectorTrust Realtor — Annual",
        "line_items[0][price_data][unit_amount]": "100",
        "line_items[0][price_data][recurring][interval]": "year",
        "line_items[0][quantity]": "1",
        success_url: `${SITE_URL}?subscribed=true`,
        cancel_url: `${SITE_URL}?subscribed=cancelled`,
      });

      const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${STRIPE_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const data = await r.json();
      if (!r.ok) return res.status(400).json({ error: data.error?.message || "Stripe error" });
      return res.status(200).json({ url: data.url });
    }

    return res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    console.error("billing error:", err.message);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
}
