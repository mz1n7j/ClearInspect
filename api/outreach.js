// /api/outreach — ADMIN ONLY. Sends role-targeted invitation / feedback emails via Resend.
// Each recipient gets their own private email (no shared To/CC), so addresses are never exposed.
// Body: { emails: string[], subject, bodyText, audience, replyTo?, senderName? }
module.exports = async function handler(req, res) {
  const SB = process.env.SUPABASE_URL;
  const SK = process.env.SUPABASE_SERVICE_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const EMAIL_FROM = process.env.EMAIL_FROM;
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://inspectortrust.com";

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!SB || !SK) return res.status(500).json({ error: "Server is not configured." });
  if (!RESEND_API_KEY || !EMAIL_FROM) return res.status(500).json({ error: "Email isn't configured (RESEND_API_KEY / EMAIL_FROM)." });

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Login required." });

  // Verify the caller…
  let userId, userEmail;
  try {
    const u = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: SK, Authorization: `Bearer ${token}` } });
    const ud = await u.json();
    if (!u.ok || !ud?.id) return res.status(401).json({ error: "Session expired. Please sign back in." });
    userId = ud.id; userEmail = (ud.email || "").toLowerCase();
  } catch (e) { console.error("outreach auth error:", e.message); return res.status(401).json({ error: "Could not verify session." }); }

  // …and require admin.
  let role = null;
  try {
    const pr = await fetch(`${SB}/rest/v1/profiles?id=eq.${userId}&select=role`, { headers: { apikey: SK, Authorization: `Bearer ${SK}` } });
    if (pr.ok) { const pj = await pr.json(); role = pj[0]?.role || null; }
  } catch (e) { console.error("outreach role lookup error:", e.message); }
  if (role !== "admin") return res.status(403).json({ error: "Admin access required." });

  const { emails, subject, bodyText, replyTo, senderName } = req.body || {};
  if (!subject || !bodyText) return res.status(400).json({ error: "Subject and message are required." });

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const list = Array.isArray(emails) ? emails : [];
  const clean = [...new Set(list.map(e => String(e || "").trim().toLowerCase()).filter(e => EMAIL_RE.test(e)))];
  if (!clean.length) return res.status(400).json({ error: "No valid email addresses to send to." });
  if (clean.length > 50) return res.status(400).json({ error: "Please send to 50 or fewer addresses per batch (email providers rate-limit large bursts)." });

  const safe = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const paras = String(bodyText).split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const bodyHtml = paras.map(p => `<p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.65;">${safe(p).replace(/\n/g, "<br>")}</p>`).join("");
  const fromName = safe(senderName || "InspectorTrust");
  const replyAddr = (replyTo && EMAIL_RE.test(String(replyTo).trim())) ? String(replyTo).trim() : userEmail;

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
    <div style="margin-bottom:18px;"><img src="${safe(SITE_URL)}/inspectortrust-logo.png" alt="InspectorTrust" width="120" style="display:block;border:0;outline:none;"></div>
    ${bodyHtml}
    <div style="text-align:center;margin:26px 0;">
      <a href="${safe(SITE_URL)}" style="display:inline-block;background:#C8A84B;color:#0e0e0e;text-decoration:none;font-weight:700;font-size:15px;padding:12px 28px;border-radius:8px;">Take a look at InspectorTrust &rarr;</a>
    </div>
    <p style="margin:0 0 4px;color:#333;font-size:15px;">&mdash; ${fromName}</p>
    <p style="margin:0;color:#999;font-size:12px;line-height:1.5;">You can reply directly to this email with any thoughts &mdash; I read every one. If this isn't relevant to you, no need to do anything.</p>
  </div>`;
  const text = `${paras.join("\n\n")}\n\nTake a look: ${SITE_URL}\n\n— ${senderName || "InspectorTrust"}\nReply to this email with any thoughts.`;

  const sendOne = async (to) => {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject: String(subject), html, text, reply_to: replyAddr }),
    });
    if (!r.ok) { const t = await r.text(); throw new Error(`${r.status} ${t.slice(0, 140)}`); }
    return to;
  };

  // Send in small concurrent chunks with a short gap to stay friendly with rate limits.
  const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };
  const sent = [], failed = [];
  for (const group of chunk(clean, 5)) {
    const rs = await Promise.allSettled(group.map(sendOne));
    rs.forEach((r, i) => { if (r.status === "fulfilled") sent.push(group[i]); else failed.push(`${group[i]}: ${r.reason?.message || "failed"}`); });
    await new Promise(r => setTimeout(r, 300));
  }

  return res.status(200).json({ sent: sent.length, failed: failed.length, failures: failed, total: clean.length });
};
