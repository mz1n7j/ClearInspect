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
      return res.status(200).json({ session: { access_token: accessToken }, profile });
    }
    return res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    console.error("auth error:", err);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
};
