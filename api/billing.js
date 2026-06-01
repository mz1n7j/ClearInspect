import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers.authorization?.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError) return res.status(401).json({ error: "Unauthorized" });

  const { action } = req.body;

  try {
    // ── CREATE CHECKOUT SESSION ────────────────────────────────
    if (action === "checkout") {
      const { data: profile } = await supabase
        .from("profiles").select("*").eq("id", user.id).single();

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        customer_email: user.email,
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: { name: "ClearInspect Realtor — Annual Plan" },
            unit_amount: 2000, // $20.00
            recurring: { interval: "year" },
          },
          quantity: 1,
        }],
        metadata: { userId: user.id },
        success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account?payment=success`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account?payment=cancelled`,
      });

      return res.status(200).json({ url: session.url });
    }

    // ── STRIPE WEBHOOK: payment confirmed ─────────────────────
    if (action === "webhook") {
      const sig = req.headers["stripe-signature"];
      let event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        return res.status(400).json({ error: `Webhook error: ${err.message}` });
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const userId = session.metadata.userId;
        await supabase.from("profiles")
          .update({
            subscription_status: "active",
            stripe_customer_id: session.customer,
            subscription_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq("id", userId);
      }

      if (event.type === "customer.subscription.deleted") {
        const customerId = event.data.object.customer;
        await supabase.from("profiles")
          .update({ subscription_status: "expired" })
          .eq("stripe_customer_id", customerId);
      }

      return res.status(200).json({ received: true });
    }

    // ── GET BILLING PORTAL ─────────────────────────────────────
    if (action === "portal") {
      const { data: profile } = await supabase
        .from("profiles").select("stripe_customer_id").eq("id", user.id).single();

      if (!profile?.stripe_customer_id) {
        return res.status(400).json({ error: "No billing account found." });
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account`,
      });

      return res.status(200).json({ url: portalSession.url });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
