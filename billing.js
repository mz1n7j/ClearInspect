const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers.authorization?.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError) return res.status(401).json({ error: "Unauthorized" });

  const { action } = req.body;

  try {
    if (action === "checkout") {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        customer_email: user.email,
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: { name: "InspectorTrust Realtor — Annual Plan" },
            unit_amount: 2000,
            recurring: { interval: "year" },
          },
          quantity: 1,
        }],
        metadata: { userId: user.id },
        success_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://inspectortrust.com"}?payment=success`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://inspectortrust.com"}?payment=cancelled`,
      });
      return res.status(200).json({ url: session.url });
    }

    if (action === "portal") {
      const { data: profile } = await supabase
        .from("profiles").select("stripe_customer_id").eq("id", user.id).single();
      if (!profile?.stripe_customer_id) {
        return res.status(400).json({ error: "No billing account found." });
      }
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://inspectortrust.com"}`,
      });
      return res.status(200).json({ url: portalSession.url });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    console.error("billing error:", err);
    return res.status(500).json({ error: err.message });
  }
};
