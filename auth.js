import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { action, email, password, name, role, licenseNumber } = req.body;

  try {
    // ── SIGN UP ────────────────────────────────────────────────
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

      // Create profile row
      await supabase.from("profiles").insert({
        id: data.user.id,
        email,
        name,
        role,
        license_number: licenseNumber || null,
        trial_started_at: role === "realtor" ? new Date().toISOString() : null,
        inspection_count: 0,
        subscription_status: role === "realtor" ? "trial" : "free",
      });

      return res.status(200).json({ user: data.user });
    }

    // ── SIGN IN ────────────────────────────────────────────────
    if (action === "signin") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return res.status(401).json({ error: "Invalid email or password." });

      const { data: profile } = await supabase
        .from("profiles").select("*").eq("id", data.user.id).single();

      return res.status(200).json({ user: data.user, session: data.session, profile });
    }

    // ── GET PROFILE ────────────────────────────────────────────
    if (action === "profile") {
      const token = req.headers.authorization?.replace("Bearer ", "");
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error) return res.status(401).json({ error: "Unauthorized" });

      const { data: profile } = await supabase
        .from("profiles").select("*").eq("id", user.id).single();

      // Check trial expiry (14 days)
      if (profile?.role === "realtor" && profile?.subscription_status === "trial") {
        const trialStart = new Date(profile.trial_started_at);
        const daysSince = (Date.now() - trialStart) / (1000 * 60 * 60 * 24);
        if (daysSince > 14 && profile.inspection_count < 20) {
          await supabase.from("profiles")
            .update({ subscription_status: "expired" })
            .eq("id", user.id);
          profile.subscription_status = "expired";
        }
        // Free for first year if 20+ inspections
        if (profile.inspection_count >= 20) {
          await supabase.from("profiles")
            .update({ subscription_status: "active" })
            .eq("id", user.id);
          profile.subscription_status = "active";
        }
      }

      return res.status(200).json({ user, profile });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
