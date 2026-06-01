const { createClient } = require("@supabase/supabase-js");

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

  const { action, email, password, name, role, licenseNumber } = req.body;

  try {
    if (action === "signup") {
      if (role === "realtor" && !licenseNumber) {
        return res.status(400).json({ error: "Realtors must provide a license number." });
      }
      const { data, error } = await supabase.auth.admin.createUser({
        email, password,
        email_confirm: true,
        user_metadata: { name, role, licenseNumber: licenseNumber || null },
      });
      if (error) return res.status(400).json({ error: error.message });

      await supabase.from("profiles").insert({
        id: data.user.id,
        email, name, role,
        license_number: licenseNumber || null,
        trial_started_at: role === "realtor" ? new Date().toISOString() : null,
        inspection_count: 0,
        subscription_status: role === "realtor" ? "trial" : "free",
      });

      return res.status(200).json({ success: true });
    }

    if (action === "signin") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return res.status(401).json({ error: "Invalid email or password." });

      const { data: profile } = await supabase
        .from("profiles").select("*").eq("id", data.user.id).single();

      // Check trial expiry
      if (profile?.role === "realtor" && profile?.subscription_status === "trial") {
        const trialStart = new Date(profile.trial_started_at);
        const daysSince = (Date.now() - trialStart) / (1000 * 60 * 60 * 24);
        if (daysSince > 14 && profile.inspection_count < 20) {
          await supabase.from("profiles")
            .update({ subscription_status: "expired" }).eq("id", data.user.id);
          profile.subscription_status = "expired";
        }
        if (profile.inspection_count >= 20) {
          await supabase.from("profiles")
            .update({ subscription_status: "active" }).eq("id", data.user.id);
          profile.subscription_status = "active";
        }
      }

      return res.status(200).json({
        user: data.user,
        session: data.session,
        profile,
      });
    }

    if (action === "profile") {
      const token = req.headers.authorization?.replace("Bearer ", "");
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error) return res.status(401).json({ error: "Unauthorized" });
      const { data: profile } = await supabase
        .from("profiles").select("*").eq("id", user.id).single();
      return res.status(200).json({ user, profile });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    console.error("auth error:", err);
    return res.status(500).json({ error: err.message });
  }
};
