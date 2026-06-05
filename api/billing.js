module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://inspectortrust.com";

  const { action, role, email, name, licenseNumber, interval } = req.body;

  // ── (role, interval) -> Stripe recurring Price ID, from env vars ──
  // Create these Prices in your Stripe dashboard, then set the env vars:
  //   STRIPE_PRICE_BUYER_YEARLY        ($5/year, recurring)   — buyers & sellers
  //   STRIPE_PRICE_REALTOR_MONTHLY     ($5/month, recurring)
  //   STRIPE_PRICE_REALTOR_YEARLY      ($50/year, recurring)
  //   STRIPE_PRICE_INSPECTOR_MONTHLY   ($5/month, recurring)
  //   STRIPE_PRICE_INSPECTOR_YEARLY    ($50/year, recurring)
  function resolvePrice(roleRaw, intervalRaw) {
    const r = (roleRaw || "buyer").toLowerCase();
    const i = (intervalRaw || "yearly").toLowerCase() === "monthly" ? "monthly" : "yearly";
    // Buyers & sellers: yearly only ($5/yr)
    if (r === "buyer" || r === "seller") {
      return { priceId: process.env.STRIPE_PRICE_BUYER_YEARLY, envName: "STRIPE_PRICE_BUYER_YEARLY", interval: "yearly" };
    }
    if (r === "realtor") {
      return i === "monthly"
        ? { priceId: process.env.STRIPE_PRICE_REALTOR_MONTHLY, envName: "STRIPE_PRICE_REALTOR_MONTHLY", interval: "monthly" }
        : { priceId: process.env.STRIPE_PRICE_REALTOR_YEARLY, envName: "STRIPE_PRICE_REALTOR_YEARLY", interval: "yearly" };
    }
    if (r === "inspector") {
      return i === "monthly"
        ? { priceId: process.env.STRIPE_PRICE_INSPECTOR_MONTHLY, envName: "STRIPE_PRICE_INSPECTOR_MONTHLY", interval: "monthly" }
        : { priceId: process.env.STRIPE_PRICE_INSPECTOR_YEARLY, envName: "STRIPE_PRICE_INSPECTOR_YEARLY", interval: "yearly" };
    }
    return { priceId: null, envName: null, interval: "yearly" };
  }

  async function createSubscriptionCheckout({ priceId, customerEmail, metadata, successUrl, cancelUrl }) {
    const params = new URLSearchParams({
      mode: "subscription",
      "payment_method_types[0]": "card",
      customer_email: customerEmail || "",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    for (const [k, v] of Object.entries(metadata || {})) {
      const val = v == null ? "" : String(v);
      params.append(`metadata[${k}]`, val);
      params.append(`subscription_data[metadata][${k}]`, val);
    }
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const data = await r.json();
    return { ok: r.ok, data };
  }

  try {
    // ── SIGNUP CHECKOUT — recurring subscription, price by (role, interval) ──
    if (action === "signup_checkout") {
      const { priceId, envName, interval: resolved } = resolvePrice(role, interval);
      if (!priceId) {
        return res.status(500).json({ error: `Pricing isn't configured for this plan yet (missing ${envName || "price"}). Add the Stripe price ID to your environment variables.` });
      }
      const successUrl = `${SITE_URL}?signup_success=true&role=${encodeURIComponent(role || "buyer")}&email=${encodeURIComponent(email || "")}`;
      const cancelUrl = `${SITE_URL}?signup_cancelled=true`;
      const { ok, data } = await createSubscriptionCheckout({
        priceId,
        customerEmail: email,
        metadata: { role: role || "buyer", email: email || "", name: name || "", licenseNumber: licenseNumber || "", interval: resolved },
        successUrl, cancelUrl,
      });
      if (!ok) return res.status(400).json({ error: data.error?.message || "Stripe error" });
      return res.status(200).json({ url: data.url });
    }

    // ── CONFIRM SIGNUP (server-verified path; verifies the Stripe session) ──
    // Not used by the current redirect flow, kept for future hardening.
    if (action === "confirm_signup") {
      const { sessionId, password } = req.body;
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

      const sessionRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
        headers: { "Authorization": `Bearer ${STRIPE_KEY}` },
      });
      const session = await sessionRes.json();
      const paid = session.payment_status === "paid" || session.status === "complete";
      if (!sessionRes.ok || !paid) {
        return res.status(400).json({ error: "Payment not confirmed." });
      }

      const { role: pRole, email: pEmail, name: pName, licenseNumber: pLicense } = session.metadata || {};

      const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({
          email: pEmail,
          password: password || Math.random().toString(36).slice(2) + "Aa1!",
          email_confirm: true,
          user_metadata: { name: pName, role: pRole },
        }),
      });
      const signupData = await signupRes.json();
      if (!signupRes.ok) return res.status(400).json({ error: signupData.message || "Account creation failed" });

      await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Prefer": "return=minimal" },
        body: JSON.stringify({
          id: signupData.id,
          email: pEmail,
          name: pName || "",
          role: pRole || "buyer",
          license_number: pLicense || null,
          trial_started_at: null,
          inspection_count: 0,
          subscription_status: "active",
        }),
      });

      return res.status(200).json({ success: true });
    }

    // ── (RE)SUBSCRIBE for an existing signed-in account ──
    if (action === "checkout") {
      const token = (req.headers.authorization || "").replace("Bearer ", "");
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` },
      });
      const userData = await userRes.json();
      if (!userRes.ok) return res.status(401).json({ error: "Session expired. Please sign back in." });

      // Resolve the role from the saved profile (don't trust the client).
      const pRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userData.id}&select=role`, {
        headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
      });
      const profs = await pRes.json();
      const pRole = (Array.isArray(profs) && profs[0]?.role) || role || "buyer";

      const { priceId, envName, interval: resolved } = resolvePrice(pRole, interval);
      if (!priceId) {
        return res.status(500).json({ error: `Pricing isn't configured for this plan yet (missing ${envName || "price"}).` });
      }
      const { ok, data } = await createSubscriptionCheckout({
        priceId,
        customerEmail: userData.email,
        metadata: { role: pRole, email: userData.email || "", interval: resolved },
        successUrl: `${SITE_URL}?subscribed=true`,
        cancelUrl: `${SITE_URL}?subscribed=cancelled`,
      });
      if (!ok) return res.status(400).json({ error: data.error?.message || "Stripe error" });
      return res.status(200).json({ url: data.url });
    }

    // ── CANCEL SUBSCRIPTION (at period end) ──────────────────────
    if (action === "cancel") {
      const token = (req.headers.authorization || "").replace("Bearer ", "");
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` },
      });
      const userData = await userRes.json();
      if (!userRes.ok || !userData?.id) return res.status(401).json({ error: "Session expired. Please sign back in." });
      const userEmail = userData.email;
      if (!userEmail) return res.status(400).json({ error: "No email on file for this account." });

      // Find every Stripe customer with this email and cancel active subs at period end.
      let cancelled = 0;
      const custRes = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(userEmail)}&limit=20`, {
        headers: { "Authorization": `Bearer ${STRIPE_KEY}` },
      });
      const custData = await custRes.json();
      if (!custRes.ok) return res.status(400).json({ error: custData.error?.message || "Stripe error" });

      for (const c of (custData.data || [])) {
        const subRes = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${c.id}&status=active&limit=100`, {
          headers: { "Authorization": `Bearer ${STRIPE_KEY}` },
        });
        const subData = await subRes.json();
        for (const s of (subData.data || [])) {
          const upd = await fetch(`https://api.stripe.com/v1/subscriptions/${s.id}`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${STRIPE_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
            body: "cancel_at_period_end=true",
          });
          if (upd.ok) cancelled++;
          else console.error(`cancel sub ${s.id} FAILED ${upd.status}: ${await upd.text()}`);
        }
      }

      if (cancelled === 0) {
        return res.status(200).json({ cancelled: 0, message: "No active subscription was found to cancel." });
      }
      // Reflect the cancellation in our DB so the app shows it.
      await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Prefer": "return=minimal" },
        body: JSON.stringify({ subscription_status: "canceling" }),
      });
      return res.status(200).json({ cancelled, message: "Your subscription will cancel at the end of the current billing period. You'll keep access until then." });
    }

    return res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    console.error("billing error:", err.message);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
};
