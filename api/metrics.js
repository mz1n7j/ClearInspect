// /api/metrics — engagement metrics.
//   action "ping"  : any signed-in user; accrues active session time (visible-tab heartbeat).
//   action "kpis"  : ADMIN only; returns per-user engagement data for the Insights page.
module.exports = async function handler(req, res) {
  const SB = process.env.SUPABASE_URL;
  const SK = process.env.SUPABASE_SERVICE_KEY;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!SB || !SK) return res.status(500).json({ error: "Server is not configured." });

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Login required." });
  const { action } = req.body || {};

  // Verify the caller.
  let userId;
  try {
    const u = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: SK, Authorization: `Bearer ${token}` } });
    const ud = await u.json();
    if (!u.ok || !ud?.id) return res.status(401).json({ error: "Session expired. Please sign back in." });
    userId = ud.id;
  } catch (e) { return res.status(401).json({ error: "Could not verify session." }); }

  // ── Heartbeat: accrue active time (delta since last_seen, capped at 2 min so idle/closed gaps don't count) ──
  if (action === "ping") {
    try {
      const pr = await fetch(`${SB}/rest/v1/profiles?id=eq.${userId}&select=active_seconds,last_seen_at`, { headers: { apikey: SK, Authorization: `Bearer ${SK}` } });
      const p = (await pr.json())[0] || {};
      const now = Date.now();
      const last = p.last_seen_at ? new Date(p.last_seen_at).getTime() : now;
      const delta = Math.min(Math.max(Math.round((now - last) / 1000), 0), 120);
      await fetch(`${SB}/rest/v1/profiles?id=eq.${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", apikey: SK, Authorization: `Bearer ${SK}`, Prefer: "return=minimal" },
        body: JSON.stringify({ active_seconds: (p.active_seconds || 0) + delta, last_seen_at: new Date(now).toISOString() }),
      });
    } catch (e) { console.error("ping error:", e.message); }
    return res.status(200).json({ ok: true });
  }

  // ── KPIs: admin only ──
  if (action === "kpis") {
    let role = null;
    try {
      const r = await fetch(`${SB}/rest/v1/profiles?id=eq.${userId}&select=role`, { headers: { apikey: SK, Authorization: `Bearer ${SK}` } });
      role = (await r.json())[0]?.role || null;
    } catch (e) { console.error("kpis role error:", e.message); }
    if (role !== "admin") return res.status(403).json({ error: "Admin access required." });

    try {
      const pr = await fetch(`${SB}/rest/v1/profiles?select=id,email,name,role,created_at,subscription_status,login_count,session_count,active_seconds,last_login_at,last_seen_at,outreach_sent,outreach_batches`, { headers: { apikey: SK, Authorization: `Bearer ${SK}` } });
      const profiles = await pr.json();

      // reports uploaded per user
      const repMap = {};
      try {
        const rr = await fetch(`${SB}/rest/v1/reports?select=submitted_by&limit=10000`, { headers: { apikey: SK, Authorization: `Bearer ${SK}` } });
        const reps = await rr.json();
        if (Array.isArray(reps)) for (const r of reps) { if (r.submitted_by) repMap[r.submitted_by] = (repMap[r.submitted_by] || 0) + 1; }
      } catch (e) { console.error("kpis reports error:", e.message); }

      const users = (Array.isArray(profiles) ? profiles : []).map(p => ({
        email: p.email, name: p.name, role: p.role, created_at: p.created_at, subscription_status: p.subscription_status,
        login_count: p.login_count || 0,
        avg_session_seconds: p.session_count ? Math.round((p.active_seconds || 0) / p.session_count) : 0,
        active_seconds: p.active_seconds || 0,
        last_login_at: p.last_login_at, last_seen_at: p.last_seen_at,
        outreach_sent: p.outreach_sent || 0, outreach_batches: p.outreach_batches || 0,
        reports_count: repMap[p.id] || 0,
      }));
      return res.status(200).json({ users });
    } catch (e) { console.error("kpis error:", e.message); return res.status(500).json({ error: "Could not load metrics." }); }
  }

  return res.status(400).json({ error: "Unknown action." });
};
