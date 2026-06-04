// /api/template — personal inspection templates + photo uploads.
// Actions (all require a logged-in user via Authorization: Bearer <token>):
//   get          -> returns the caller's saved template (or null)
//   save         -> upserts the caller's template { sections, identity }
//   upload_photo -> stores a (downscaled) data-URL image in Supabase Storage,
//                   returns a public URL. Uploaded with the service key, so no
//                   storage RLS policies are required — just a public bucket.
module.exports = async function handler(req, res) {
  const SB = process.env.SUPABASE_URL;
  const SK = process.env.SUPABASE_SERVICE_KEY;
  const BUCKET = process.env.INSPECTION_PHOTO_BUCKET || "inspection-photos";

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!SB || !SK) return res.status(500).json({ error: "Server storage is not configured." });

  const { action } = req.body || {};

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Login required." });

  // Validate the session and resolve the user id.
  let userId;
  try {
    const userRes = await fetch(`${SB}/auth/v1/user`, {
      headers: { apikey: SK, Authorization: `Bearer ${token}` },
    });
    const userData = await userRes.json();
    if (!userRes.ok || !userData?.id) return res.status(401).json({ error: "Session expired. Please sign back in." });
    userId = userData.id;
  } catch (e) {
    console.error("template auth error:", e.message);
    return res.status(401).json({ error: "Could not verify session." });
  }

  try {
    // ── GET the caller's template ───────────────────────────────
    if (action === "get") {
      const r = await fetch(
        `${SB}/rest/v1/inspector_templates?user_id=eq.${userId}&select=template&limit=1`,
        { headers: { apikey: SK, Authorization: `Bearer ${SK}` } }
      );
      if (!r.ok) { console.error(`template get FAILED ${r.status}: ${await r.text()}`); return res.status(500).json({ error: "Could not load template." }); }
      const rows = await r.json();
      return res.status(200).json({ template: Array.isArray(rows) && rows[0] ? rows[0].template : null });
    }

    // ── SAVE (upsert) the caller's template ─────────────────────
    if (action === "save") {
      const { template } = req.body;
      if (!template || typeof template !== "object") return res.status(400).json({ error: "Template payload required." });
      const r = await fetch(`${SB}/rest/v1/inspector_templates?on_conflict=user_id`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SK,
          Authorization: `Bearer ${SK}`,
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify({ user_id: userId, template, updated_at: new Date().toISOString() }),
      });
      const text = await r.text();
      if (!r.ok) { console.error(`template save FAILED ${r.status}: ${text}`); return res.status(500).json({ error: "Could not save template." }); }
      return res.status(200).json({ success: true });
    }

    // ── UPLOAD a photo to Supabase Storage ──────────────────────
    if (action === "upload_photo") {
      const { dataUrl } = req.body;
      if (!dataUrl) return res.status(400).json({ error: "No image data." });
      const m = String(dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!m) return res.status(400).json({ error: "Invalid image data." });
      const contentType = m[1];
      const bytes = Buffer.from(m[2], "base64");
      if (bytes.length > 6 * 1024 * 1024) return res.status(413).json({ error: "Image too large (max ~6MB)." });
      const ext = (contentType.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "jpg";
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const up = await fetch(`${SB}/storage/v1/object/${BUCKET}/${path}`, {
        method: "POST",
        headers: { "Content-Type": contentType, apikey: SK, Authorization: `Bearer ${SK}`, "x-upsert": "true" },
        body: bytes,
      });
      if (!up.ok) {
        const t = await up.text();
        console.error(`photo upload FAILED ${up.status}: ${t}`);
        return res.status(500).json({ error: up.status === 404 ? `Storage bucket "${BUCKET}" not found — create it first.` : "Photo upload failed." });
      }
      const publicUrl = `${SB}/storage/v1/object/public/${BUCKET}/${path}`;
      return res.status(200).json({ url: publicUrl, path });
    }

    return res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    console.error("template route error:", err.message);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
};
