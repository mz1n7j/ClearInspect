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
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  // From address is now configurable. For testing before your domain is verified,
  // set EMAIL_FROM=onboarding@resend.dev in Vercel (delivers only to your Resend
  // signup email). Once inspectortrust.com is verified in Resend, set
  // EMAIL_FROM=noreply@inspectortrust.com (or just rely on this default).
  const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@inspectortrust.com";

  const SB_HEADERS = { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` };

  const { action } = req.body;

  try {
    // — SEND SHARE EMAIL ————————————————————————
    if (action === "send") {
      const { reportId, recipientEmail, senderName, inspectorName, propertyAddress } = req.body;
      if (!reportId || !recipientEmail) return res.status(400).json({ error: "Report ID and recipient email required." });
      if (!RESEND_API_KEY) { console.error("share: RESEND_API_KEY is missing"); return res.status(500).json({ error: "Email is not configured." }); }

      // Generate a secure token
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

      // Store share token in Supabase — CHECKED, so a failure here doesn't
      // result in an email containing a link that can never be verified.
      const storeRes = await fetch(`${SUPABASE_URL}/rest/v1/report_shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...SB_HEADERS, "Prefer": "return=minimal" },
        body: JSON.stringify({
          report_id: reportId,
          recipient_email: recipientEmail,
          token,
          expires_at: expiresAt,
          accessed: false,
          created_at: new Date().toISOString(),
        }),
      });
      if (!storeRes.ok) {
        const storeErr = await storeRes.text();
        console.error(`report_shares INSERT FAILED ${storeRes.status}: ${storeErr}`);
        return res.status(500).json({ error: "Could not create the share link.", details: storeErr });
      }

      const shareLink = `${SITE_URL}?shared=${token}`;

      // Send email via Resend
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: recipientEmail,
          subject: `${senderName || inspectorName || "Someone"} shared an inspection report with you`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1a1a1a;">Inspection Report Shared With You</h2>
              <p>Hi,</p>
              <p><strong>${senderName || inspectorName || "An inspector"}</strong> has shared an inspection report with you${propertyAddress ? ` for <strong>${propertyAddress}</strong>` : ""}.</p>
              <p style="margin: 24px 0;">
                <a href="${shareLink}"
                   style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View Inspection Report
                </a>
              </p>
              <p style="color: #666; font-size: 14px;">This link expires in 7 days.</p>
              <p style="color: #666; font-size: 14px;">If you have any questions, please contact the inspector directly.</p>
            </div>
          `,
        }),
      });

      if (!emailRes.ok) {
        const emailError = await emailRes.text();
        console.error(`Resend send FAILED ${emailRes.status}: ${emailError}`);
        return res.status(500).json({ error: "Failed to send email.", details: emailError });
      }

      return res.status(200).json({
        success: true,
        shareLink,
        message: `Report shared successfully. An email has been sent to ${recipientEmail}.`,
      });
    }

    // — VERIFY SHARE TOKEN ————————————————————————
    if (action === "verify") {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "Token required." });

      const verifyRes = await fetch(
        `${SUPABASE_URL}/rest/v1/report_shares?token=eq.${encodeURIComponent(token)}&select=*`,
        { headers: SB_HEADERS }
      );
      const shares = await verifyRes.json();

      if (!Array.isArray(shares) || shares.length === 0) {
        return res.status(404).json({ error: "Invalid or expired share link." });
      }

      const share = shares[0];

      if (new Date(share.expires_at) < new Date()) {
        return res.status(410).json({ error: "This share link has expired." });
      }

      // Mark as accessed
      await fetch(`${SUPABASE_URL}/rest/v1/report_shares?token=eq.${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...SB_HEADERS },
        body: JSON.stringify({ accessed: true }),
      });

      return res.status(200).json({ success: true, reportId: share.report_id });
    }

    return res.status(400).json({ error: "Invalid action." });

  } catch (err) {
    console.error("share.js error:", err);
    return res.status(500).json({ error: "Internal server error.", details: err.message });
  }
};
