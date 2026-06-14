// /api/disputes.js  — InspectorTrust dispute workflow endpoint (CommonJS)
//
// Mirrors your existing routes: POST only, Bearer access-token in the
// Authorization header, all Supabase access via the service-role key + fetch,
// server-side role verification.
//
// ── CONFIRM THESE TWO THINGS against any of your other /api routes ──
//   1) Env var names below resolve on your deployment (fallbacks cover the
//      common Supabase naming; if your routes read different names, add them).
//   2) Nothing else — this endpoint does NOT touch your reports table. The
//      client passes the report's id/name/address/grade at file time, so there
//      is no reports-table name to guess.
//
// Actions (all POST, body = JSON):
//   { action:"file",    reportId, reason, inspectorName?, propertyAddress?, grade? }  -> inspector/admin
//   { action:"active" }                                                               -> any signed-in user
//   { action:"list",    status? }                                                     -> dispute_analyst/admin
//   { action:"resolve", disputeId, decision:"approved"|"rejected", note? }            -> dispute_analyst/admin

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_PROJECT_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

const REST = `${SUPABASE_URL}/rest/v1`;
const svcHeaders = (extra) => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  ...extra,
});

// Verify the caller's Supabase access token and return the auth user, or null.
async function getAuthUser(token) {
  if (!token) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u : null;
  } catch {
    return null;
  }
}

// Look up the caller's profile (id, name, email, role) by auth user id.
async function getProfile(userId) {
  try {
    const r = await fetch(
      `${REST}/profiles?id=eq.${userId}&select=id,name,email,role`,
      { headers: svcHeaders() }
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({ error: "Supabase env vars are not configured for /api/disputes." });
    return;
  }

  // Body may arrive parsed (object) or raw (string) depending on the platform.
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body || "{}"); } catch { body = {}; }
  }
  body = body || {};
  const action = body.action;

  const auth = (req.headers.authorization || req.headers.Authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;

  const user = await getAuthUser(token);
  if (!user) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  const profile = await getProfile(user.id);
  const role = profile?.role || null;
  const isAdmin = role === "admin";
  const isAnalyst = role === "dispute_analyst";

  try {
    // ── FILE: an inspector (or admin) disputes a grade ──────────────────────
    if (action === "file") {
      if (!(role === "inspector" || isAdmin)) {
        res.status(403).json({ error: "Only inspectors can file a dispute." });
        return;
      }
      const reportId = body.reportId;
      const reason = (body.reason || "").trim();
      if (!reportId) { res.status(400).json({ error: "Missing reportId." }); return; }
      if (!reason)  { res.status(400).json({ error: "A reason is required." }); return; }

      // Block a duplicate while one is already pending for this report.
      const existing = await fetch(
        `${REST}/disputes?report_id=eq.${reportId}&status=eq.pending&select=id`,
        { headers: svcHeaders() }
      );
      const existingRows = existing.ok ? await existing.json() : [];
      if (Array.isArray(existingRows) && existingRows.length) {
        res.status(409).json({ error: "This grade is already being disputed." });
        return;
      }

      const row = {
        report_id: reportId,
        inspector_name: body.inspectorName || null,
        property_address: body.propertyAddress || null,
        grade: body.grade || null,
        reason,
        status: "pending",
        filed_by: profile?.id || user.id,
        filed_by_name: profile?.name || null,
        filed_by_email: profile?.email || user.email || null,
      };
      const ins = await fetch(`${REST}/disputes`, {
        method: "POST",
        headers: svcHeaders({ Prefer: "return=representation" }),
        body: JSON.stringify(row),
      });
      if (!ins.ok) {
        const t = await ins.text();
        res.status(500).json({ error: "Could not file dispute.", detail: t });
        return;
      }
      const created = await ins.json();
      res.status(200).json({ success: true, dispute: created[0] || null });
      return;
    }

    // ── ACTIVE: report_ids that currently have a pending dispute ────────────
    // Any signed-in user may read this so grades can render "Disputing".
    if (action === "active") {
      const r = await fetch(
        `${REST}/disputes?status=eq.pending&select=report_id`,
        { headers: svcHeaders() }
      );
      const rows = r.ok ? await r.json() : [];
      const reportIds = Array.from(new Set((rows || []).map((x) => String(x.report_id))));
      res.status(200).json({ reportIds });
      return;
    }

    // ── LIST: the review queue (analyst/admin only) ─────────────────────────
    if (action === "list") {
      if (!(isAnalyst || isAdmin)) {
        res.status(403).json({ error: "Dispute analyst access required." });
        return;
      }
      const status = body.status; // optional: pending | approved | rejected
      const filter = status ? `&status=eq.${encodeURIComponent(status)}` : "";
      const r = await fetch(
        `${REST}/disputes?select=*${filter}&order=created_at.desc`,
        { headers: svcHeaders() }
      );
      if (!r.ok) {
        const t = await r.text();
        res.status(500).json({ error: "Could not load disputes.", detail: t });
        return;
      }
      const disputes = await r.json();
      res.status(200).json({ disputes });
      return;
    }

    // ── RESOLVE: approve or reject (analyst/admin only) ─────────────────────
    if (action === "resolve") {
      if (!(isAnalyst || isAdmin)) {
        res.status(403).json({ error: "Dispute analyst access required." });
        return;
      }
      const disputeId = body.disputeId;
      const decision = body.decision; // "approved" | "rejected"
      if (!disputeId) { res.status(400).json({ error: "Missing disputeId." }); return; }
      if (decision !== "approved" && decision !== "rejected") {
        res.status(400).json({ error: "decision must be 'approved' or 'rejected'." });
        return;
      }
      const patch = {
        status: decision,
        resolution_note: (body.note || "").trim() || null,
        reviewed_by: profile?.id || user.id,
        reviewed_by_name: profile?.name || null,
        reviewed_at: new Date().toISOString(),
      };
      const upd = await fetch(`${REST}/disputes?id=eq.${disputeId}`, {
        method: "PATCH",
        headers: svcHeaders({ Prefer: "return=representation" }),
        body: JSON.stringify(patch),
      });
      if (!upd.ok) {
        const t = await upd.text();
        res.status(500).json({ error: "Could not update dispute.", detail: t });
        return;
      }
      const updated = await upd.json();
      // NOTE: resolving (either way) just clears the "Disputing" state and the
      // grade returns. Approving does NOT auto-change or remove the grade — that
      // regrade/removal behavior is a deliberate follow-up if you want it.
      res.status(200).json({ success: true, dispute: updated[0] || null });
      return;
    }

    res.status(400).json({ error: "Unknown action." });
  } catch (e) {
    res.status(500).json({ error: "Server error.", detail: String(e && e.message || e) });
  }
};
