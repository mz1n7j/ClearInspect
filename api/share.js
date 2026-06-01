// api/share.js — handles emailing report links and token verification
const crypto = require("crypto");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://inspectortrust.com";

  const { action } = req.body;

  try {
    // ── SEND SHARE EMAIL ─────────────────────────────────────────
    if (action === "send") {
      const { reportId, recipientEmail, senderName, inspectorName, propertyAddress } = req.body;
      if (!reportId || !recipientEmail) return res.status(400).json({ error: "Report ID and recipient email required." });

      // Generate a secure token
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

      // Store share token in Supabase
      await fetch(`${SUPABASE_URL}/rest/v1/report_shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Prefer": "return=minimal" },
        body: JSON.stringify({ report_id: reportId, recipient_email: recipientEmail, token, expires_at: expiresAt, accessed: false, created_at: new Date().toISOString() }),
      });

      const shareLink = `${SITE_URL}?shared=${token}`;

      // Send email via Supabase Edge Function / or just return the link for now
      // In production wire up Resend or SendGrid here
      console.log(`Share link for ${recipientEmail}: ${shareLink}`);

      return res.status(200).json({ 
        success: true, 
        shareLink,
        message: `Share link generated. In production, email will be sent to ${recipientEmail}.`
      });
    }

    // ── VERIFY SHARE TOKEN ───────────────────────────────────────
    if (action === "verify") {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "Token required." });

      const r = await fetch(`${SUPABASE_URL}/rest/v1/report_shares?token=eq.${token}&select=*`, {
        headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
      });
      const shares = await r.json();
      const share = shares[0];

      if (!share) return res.status(404).json({ error: "Invalid share link." });
      if (new Date(share.expires_at) < new Date()) return res.status(410).json({ error: "This share link has expired." });

      // Mark as accessed
      await fetch(`${SUPABASE_URL}/rest/v1/report_shares?token=eq.${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ accessed: true, accessed_at: new Date().toISOString() }),
      });

      return res.status(200).json({ valid: true, reportId: share.report_id, recipientEmail: share.recipient_email });
    }

    return res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    console.error("share error:", err.message);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
};
