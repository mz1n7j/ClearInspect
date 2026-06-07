module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: "Server configuration error." });
  }
  const { action, email, password, name, role, licenseNumber } = req.body;
  const VALID_ROLES = ["buyer", "seller", "realtor", "inspector", "admin"];
  try {
    if (action === "signup") {
      const safeRole = VALID_ROLES.includes(role) ? role : "buyer";
      // Realtors and inspectors are licensed professionals — require a license number.
      if ((safeRole === "realtor" || safeRole === "inspector") && !licenseNumber) {
        return res.status(400).json({ error: "Realtors and inspectors must provide a license number." });
      }
      const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          email, password,
          email_confirm: true,
          user_metadata: { name, role: safeRole, licenseNumber: licenseNumber || null },
        }),
      });
      const signupData = await signupRes.json();
      if (!signupRes.ok) return res.status(400).json({ error: signupData.message || signupData.error || "Signup failed" });
      const userId = signupData.id;
      // Everyone subscribes at signup (checkout runs first), so the account is active.
      await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          id: userId,
          email,
          name: name || "",
          role: safeRole,
          license_number: licenseNumber || null,
          trial_started_at: null,
          inspection_count: 0,
          subscription_status: "active",
        }),
      });
      // Record terms acceptance (best-effort; harmless if the columns don't exist).
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Prefer": "return=minimal" },
          body: JSON.stringify({ terms_accepted_at: new Date().toISOString(), terms_version: "1.0" }),
        });
      } catch (_) {}
      return res.status(200).json({ success: true });
    }
    if (action === "signin") {
      const signinRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY },
        body: JSON.stringify({ email, password }),
      });
      const signinData = await signinRes.json();
      if (!signinRes.ok) return res.status(401).json({ error: "Invalid email or password." });
      const accessToken = signinData.access_token;
      const userId = signinData.user?.id;
      const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`,
        { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
      );
      const profiles = await profileRes.json();
      let profile = profiles[0] || null;
      // Best-effort engagement metrics (never block login on failure)
      if (profile && userId) {
        try {
          const nowIso = new Date().toISOString();
          await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Prefer": "return=minimal" },
            body: JSON.stringify({ login_count: (profile.login_count || 0) + 1, session_count: (profile.session_count || 0) + 1, last_login_at: nowIso, last_seen_at: nowIso }),
          });
        } catch (e) { console.error("login metric error:", e.message); }
      }
      return res.status(200).json({ session: { access_token: accessToken }, profile });
    }
    if (action === "accept_terms") {
      const t = (req.body && req.body.token) || (req.headers.authorization || "").replace("Bearer ", "");
      if (!t) return res.status(401).json({ error: "Not authenticated." });
      const uRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${t}` },
      });
      const u = await uRes.json();
      if (!uRes.ok || !u?.id) return res.status(401).json({ error: "Session expired. Please sign back in." });
      const up = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Prefer": "return=minimal" },
        body: JSON.stringify({ terms_accepted_at: new Date().toISOString(), terms_version: "1.0" }),
      });
      if (!up.ok) { console.error(`accept_terms PATCH ${up.status}: ${await up.text()}`); return res.status(500).json({ error: "Could not record acceptance. Please try again." }); }
      return res.status(200).json({ success: true });
    }
    if (action === "request_password_reset") {
      const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://inspectortrust.com";
      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      const EMAIL_FROM = process.env.EMAIL_FROM;
      if (!email) return res.status(400).json({ error: "Email is required." });
      try {
        // Supabase mints a secure recovery link (no email sent by Supabase); we email it ourselves.
        const genRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
          body: JSON.stringify({ type: "recovery", email, redirect_to: SITE_URL }),
        });
        const gen = await genRes.json();
        const link = gen.action_link || (gen.properties && gen.properties.action_link);
        if (genRes.ok && link && RESEND_API_KEY && EMAIL_FROM) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_API_KEY}` },
            body: JSON.stringify({
              from: EMAIL_FROM,
              to: email,
              subject: "Reset your InspectorTrust password",
              html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
                <div style="margin-bottom:16px;"><img src="${SITE_URL}/inspectortrust-logo.png" alt="InspectorTrust" width="110" style="display:block;border:0;outline:none;"></div>
                <h2 style="margin:0 0 8px;">Reset your password</h2>
                <p style="color:#444;font-size:14px;line-height:1.6;">We received a request to reset the password for your InspectorTrust account. Click the button below to choose a new password. If you didn't request this, you can safely ignore this email.</p>
                <div style="text-align:center;margin:24px 0;">
                  <a href="${link}" style="display:inline-block;background:#C8A84B;color:#0e0e0e;text-decoration:none;font-weight:700;font-size:15px;padding:12px 28px;border-radius:8px;">Reset password &rarr;</a>
                </div>
                <p style="color:#888;font-size:12px;">This link expires shortly for your security. If the button doesn't work, copy and paste this URL into your browser:<br>${link}</p>
              </div>`,
            }),
          });
        } else if (!genRes.ok) {
          console.error(`generate_link ${genRes.status}: ${JSON.stringify(gen)}`);
        }
      } catch (e) { console.error("request_password_reset error:", e.message); }
      // Always return success so we never reveal whether an account exists.
      return res.status(200).json({ success: true });
    }
    if (action === "update_password") {
      const { token, password } = req.body;
      if (!token || !password) return res.status(400).json({ error: "Missing token or password." });
      if (String(password).length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
      const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ password }),
      });
      if (!r.ok) { console.error(`update_password ${r.status}: ${await r.text()}`); return res.status(400).json({ error: "Your reset link has expired or is invalid. Please request a new one." }); }
      return res.status(200).json({ success: true });
    }
    return res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    console.error("auth error:", err);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
};
