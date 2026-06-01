module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://inspectortrust.com";

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const { action } = req.body;

  try {
    // Verify user
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` },
    });
    const userData = await userRes.json();
    if (!userRes.ok) return res.status(401).json({ error: "Unauthorized" });

    if (action === "checkout") {
      // Create Stripe checkout session via REST API
      const params = new URLSearchParams({
        mode: "subscription",
        "payment_method_types[0]": "card",
        customer_email: userData.email,
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][product_data][name]": "InspectorTrust Realtor Annual Plan",
        "line_items[0][price_data][unit_amount]": "2000",
        "line_items[0][price_data][recurring][interval]": "year",
        "line_items[0][quantity]": "1",
        "metadata[userId]": userData.id,
        success_url: `${SITE_URL}?payment=success`,
        cancel_url: `${SITE_URL}?payment=cancelled`,
      });

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${STRIPE_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const stripeData = await stripeRes.json();
      if (!stripeRes.ok) return res.status(400).json({ error: stripeData.error?.message });
      return res.status(200).json({ url: stripeData.url });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    console.error("billing error:", err);
    return res.status(500).json({ error: err.message });
  }
};
