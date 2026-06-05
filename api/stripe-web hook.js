// Stripe webhook → keeps subscription_status in sync with Stripe.
// Security: we do NOT trust the posted payload. We read only the event id and
// re-fetch the event from Stripe with the secret key, then act on that. This
// avoids the raw-body requirement of HMAC signature verification on Vercel and
// is safe because a forged POST can't fabricate a real Stripe event.
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!STRIPE_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error("webhook: server not configured");
    return res.status(500).json({ error: "Server not configured" });
  }

  // Map a Stripe subscription object to our subscription_status value.
  const statusFromSub = (sub) => {
    const s = sub.status;
    if (s === "active" || s === "trialing") return sub.cancel_at_period_end ? "canceling" : "active";
    if (s === "past_due" || s === "unpaid" || s === "canceled" || s === "incomplete_expired") return "expired";
    return null; // incomplete / unknown — leave as-is
  };

  try {
    const eventId = req.body && req.body.id;
    if (!eventId || typeof eventId !== "string" || !eventId.startsWith("evt_")) {
      return res.status(200).json({ received: true, ignored: "no event id" });
    }

    // Re-fetch the canonical event from Stripe (this is our verification).
    const evRes = await fetch(`https://api.stripe.com/v1/events/${eventId}`, {
      headers: { "Authorization": `Bearer ${STRIPE_KEY}` },
    });
    if (!evRes.ok) {
      console.error(`webhook: event ${eventId} fetch ${evRes.status}`);
      return res.status(200).json({ received: true, ignored: "event not found" });
    }
    const event = await evRes.json();
    const type = event.type || "";
    const obj = (event.data && event.data.object) || {};

    if (type.startsWith("customer.subscription.")) {
      const sub = obj;
      const newStatus = type === "customer.subscription.deleted" ? "expired" : statusFromSub(sub);

      if (newStatus && sub.customer) {
        // Resolve the customer's email, then update the matching profile.
        const cRes = await fetch(`https://api.stripe.com/v1/customers/${sub.customer}`, {
          headers: { "Authorization": `Bearer ${STRIPE_KEY}` },
        });
        const cust = await cRes.json();
        const email = cRes.ok && cust && cust.email;
        if (email) {
          const up = await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "apikey": SUPABASE_KEY,
              "Authorization": `Bearer ${SUPABASE_KEY}`,
              "Prefer": "return=minimal",
            },
            body: JSON.stringify({ subscription_status: newStatus }),
          });
          if (!up.ok) console.error(`webhook: profile update FAILED ${up.status}: ${await up.text()}`);
          else console.log(`webhook: ${email} -> ${newStatus} (${type})`);
        } else {
          console.error(`webhook: no email for customer ${sub.customer}`);
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (e) {
    console.error("webhook error:", e.message);
    // 200 so Stripe doesn't retry-storm on our bug; the error is logged.
    return res.status(200).json({ received: true, error: e.message });
  }
};
