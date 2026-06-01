module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://inspectortrust.com";

  const { action } = req.body;

  try {
    // ── CREATE CORRECTION CHECKOUT ───────────────────────────────
    if (action === "checkout") {
      const { reportId, inspectorName, companyName, correctedInspectorName, correctedCompanyName, reason, email } = req.body;

      if (!reportId || (!correctedInspectorName && !correctedCompanyName)) {
        return res.status(400).json({ error: "Report ID and at least one corrected field are required." });
      }

      // Build Stripe checkout for $20 correction fee
      const params = new URLSearchParams({
        mode: "payment",
        "payment_method_types[0]": "card",
        customer_email: email || "",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][product_data][name]": "InspectorTrust — Record Correction Fee",
        "line_items[0][price_data][product_data][description]": "One-time fee to submit a correction request for your inspection record.",
        "line_items[0][price_data][unit_amount]": "2000",
        "line_items[0][quantity]": "1",
        "metadata[reportId]": reportId,
        "metadata[inspectorName]": inspectorName || "",
        "metadata[companyName]": companyName || "",
        "metadata[correctedInspectorName]": correctedInspectorName || "",
        "metadata[correctedCompanyName]": correctedCompanyName || "",
        "metadata[reason]": (reason || "").slice(0, 500),
        "metadata[email]": email || "",
        success_url: `${SITE_URL}?correction=success&reportId=${reportId}`,
        cancel_url: `${SITE_URL}?correction=cancelled`,
      });

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${STRIPE_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const stripeData = await stripeRes.json();
      if (!stripeRes.ok) return res.status(400).json({ error: stripeData.error?.message || "Stripe error" });

      return res.status(200).json({ url: stripeData.url });
    }

    // ── STRIPE WEBHOOK: correction payment confirmed ──────────────
    if (action === "webhook") {
      const { sessionId } = req.body;

      // Fetch the session from Stripe to get metadata
      const sessionRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
        headers: { "Authorization": `Bearer ${STRIPE_KEY}` },
      });
      const session = await sessionRes.json();
      if (!sessionRes.ok) return res.status(400).json({ error: "Could not retrieve session" });

      const { reportId, correctedInspectorName, correctedCompanyName, reason, email, inspectorName, companyName } = session.metadata;

      // Insert correction request into Supabase for admin review
      await fetch(`${SUPABASE_URL}/rest/v1/correction_requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          report_id: reportId,
          original_inspector_name: inspectorName,
          original_company_name: companyName,
          corrected_inspector_name: correctedInspectorName || null,
          corrected_company_name: correctedCompanyName || null,
          reason: reason || null,
          submitter_email: email || null,
          status: "pending",
          paid: true,
          stripe_session_id: sessionId,
          created_at: new Date().toISOString(),
        }),
      });

      return res.status(200).json({ success: true });
    }

    // ── GET PENDING CORRECTIONS (admin only) ─────────────────────
    if (action === "list") {
      const adminKey = req.headers["x-admin-key"];
      if (adminKey !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const r = await fetch(`${SUPABASE_URL}/rest/v1/correction_requests?status=eq.pending&order=created_at.desc`, {
        headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
      });
      const corrections = await r.json();
      return res.status(200).json({ corrections });
    }

    // ── APPROVE CORRECTION (admin only) ─────────────────────────
    if (action === "approve") {
      const adminKey = req.headers["x-admin-key"];
      if (adminKey !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { correctionId, reportId, correctedInspectorName, correctedCompanyName } = req.body;

      // Update the report in Supabase
      const updateFields = {};
      if (correctedInspectorName) updateFields.inspector_name = correctedInspectorName;
      if (correctedCompanyName) updateFields.company_name = correctedCompanyName;

      await fetch(`${SUPABASE_URL}/rest/v1/inspection_reports?id=eq.${reportId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify(updateFields),
      });

      // Mark correction as approved
      await fetch(`${SUPABASE_URL}/rest/v1/correction_requests?id=eq.${correctionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({ status: "approved", reviewed_at: new Date().toISOString() }),
      });

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    console.error("correction error:", err.message);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
};
