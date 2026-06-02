module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://inspectortrust.com";

  const { action, role, email, name, password, licenseNumber } = req.body;

  try {
    // ── SIGNUP CHECKOUT — $1 for all roles ──────────────────────
    if (action === "signup_checkout") {
      const roleLabels = {
        buyer: "Buyer Account",
        seller: "Seller Account",
        realtor: "Realtor Account",
        inspector: "Inspector Account",
      };
      const label = roleLabels[role] || "InspectorTrust Account";

      // Encode signup data in metadata so we can create the account after payment
      const params = new URLSearchParams({
        mode: "payment",
        "payment_method_types[0]": "card",
        customer_email: email || "",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][product_data][name]": `InspectorTrust — ${label}`,
        "line_items[0][price_data][product_data][description]": `One-time $1 account activation fee for InspectorTrust.`,
        "line_items[0][price_data][unit_amount]": "100",
        "line_items[0][quantity]": "1",
        "metadata[role]": role || "buyer",
        "metadata[email]": email || "",
        "metadata[name]": name || "",
        "metadata[licenseNumber]": licenseNumber || "",
        success_url: `${SITE_URL}?signup_success=true&role=${role}&email=${encodeURIComponent(email||"")}`,
        cancel_url: `${SITE_URL}?signup_cancelled=true`,
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

    // ── CONFIRM SIGNUP (called after successful Stripe payment) ──
    if (action === "confirm_signup") {
      const { sessionId } = req.body;
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

      // Verify payment with Stripe
      const sessionRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
        headers: { "Authorization": `Bearer ${STRIPE_KEY}` },
      });
      const session = await sessionRes.json();
      if (!sessionRes.ok || session.payment_status !== "paid") {
        return res.status(400).json({ error: "Payment not confirmed." });
      }

      const { role: pRole, email: pEmail, name: pName, licenseNumber: pLicense, password: pPass } = session.metadata;

      // Create Supabase user
      const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          email: pEmail,
          password: pPass || Math.random().toString(36).slice(2) + "Aa1!",
          email_confirm: true,
          user_metadata: { name: pName, role: pRole },
        }),
      });

      const signupData = await signupRes.json();
      if (!signupRes.ok) return res.status(400).json({ error: signupData.message || "Account creation failed" });

      // Create profile
      await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          id: signupData.id,
          email: pEmail,
          name: pName || "",
          role: pRole || "buyer",
          license_number: pLicense || null,
          trial_started_at: null,
          inspection_count: 0,
          subscription_status: "active",
          paid_at: new Date().toISOString(),
        }),
      });

      return res.status(200).json({ success: true });
    }

    // ── REALTOR SUBSCRIPTION RENEWAL ────────────────────────────
    if (action === "checkout") {
      const token = (req.headers.authorization || "").replace("Bearer ", "");
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` },
      });
      const userData = await userRes.json();

      const params = new URLSearchParams({
        mode: "payment",
        "payment_method_types[0]": "card",
        customer_email: userData.email || "",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][product_data][name]": "InspectorTrust — Annual Renewal",
        "line_items[0][price_data][unit_amount]": "100",
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
};
