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

  // GET from Supabase, always returns an array, logs failures.
  async function sbGet(pathAndQuery) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, { headers: SB_HEADERS });
      const text = await r.text();
      if (!r.ok) { console.error(`sbGet ${pathAndQuery} FAILED ${r.status}: ${text}`); return []; }
      const d = text ? JSON.parse(text) : [];
      return Array.isArray(d) ? d : [];
    } catch (e) { console.error(`sbGet ${pathAndQuery} threw: ${e.message}`); return []; }
  }

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

    // — OPEN A SHARED REPORT (account required) ————————————————
    // Security model: the recipient MUST be signed in. We validate their
    // Supabase auth token server-side BEFORE returning anything, and the
    // report content is returned from here — not via a separate, unauthenticated
    // read — so there is no way to view a report without a valid account.
    if (action === "verify" || action === "open") {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "Token required." });

      // 1) Require a logged-in user. The frontend must send the signed-in
      //    user's Supabase access token as the Authorization Bearer header.
      const authToken = (req.headers.authorization || "").replace("Bearer ", "").trim();
      if (!authToken) {
        return res.status(401).json({ error: "Please sign in or create an account to view this report.", code: "AUTH_REQUIRED" });
      }

      // 2) Validate that session against Supabase Auth. A random or expired
      //    token is rejected here — it cannot be faked with an arbitrary string.
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${authToken}` },
      });
      const user = await userRes.json();
      if (!userRes.ok || !user?.id) {
        return res.status(401).json({ error: "Your session is invalid or expired. Please sign in again.", code: "SESSION_EXPIRED" });
      }

      // 3) Look up the share token.
      const shares = await sbGet(`report_shares?token=eq.${encodeURIComponent(token)}&select=*`);
      if (shares.length === 0) {
        return res.status(404).json({ error: "Invalid share link." });
      }
      const share = shares[0];

      if (new Date(share.expires_at) < new Date()) {
        return res.status(410).json({ error: "This share link has expired." });
      }

      // 4) OPTIONAL stricter check: only the exact invited email may open it.
      //    Set this to true to lock a link to the address it was sent to, so a
      //    forwarded link is useless to anyone else (recommended for sensitive
      //    reports). Left false here = any signed-in account with the link.
      const REQUIRE_EMAIL_MATCH = false;
      if (REQUIRE_EMAIL_MATCH && share.recipient_email &&
          user.email?.toLowerCase() !== String(share.recipient_email).toLowerCase()) {
        return res.status(403).json({ error: "This report was shared with a different email address.", code: "EMAIL_MISMATCH" });
      }

      // 5) Mark as accessed (best effort — not fatal if it fails).
      await fetch(`${SUPABASE_URL}/rest/v1/report_shares?token=eq.${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...SB_HEADERS },
        body: JSON.stringify({ accessed: true }),
      });

      // 6) Only now — after auth + token checks pass — fetch and return the
      //    report. The content never leaves the server for an unauthenticated caller.
      const reports = await sbGet(`inspection_reports?id=eq.${encodeURIComponent(share.report_id)}&select=*`);
      const report = reports[0] || null;
      if (!report) return res.status(404).json({ error: "Report not found." });

      return res.status(200).json({ success: true, reportId: share.report_id, report });
    }

    return res.status(400).json({ error: "Invalid action." });

  } catch (err) {
    console.error("share.js error:", err);
    return res.status(500).json({ error: "Internal server error.", details: err.message });
  }
};
