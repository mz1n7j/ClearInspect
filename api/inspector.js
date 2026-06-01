// api/inspector.js — inspector registration, directory, profiles, conflict detection
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://inspectortrust.com";

  const { action } = req.body || {};

  try {
    // ── REGISTER / CHECKOUT ──────────────────────────────────────
    if (action === "register_checkout") {
      const { name, companyName, licenseNo, city, state, phone, email, bio } = req.body;
      if (!name || !licenseNo || !email) return res.status(400).json({ error: "Name, license number, and email are required." });

      const params = new URLSearchParams({
        mode: "subscription",
        "payment_method_types[0]": "card",
        customer_email: email,
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][product_data][name]": "InspectorTrust — Inspector Directory Listing",
        "line_items[0][price_data][product_data][description]": "Annual listing in the InspectorTrust verified inspector directory.",
        "line_items[0][price_data][unit_amount]": "5000",
        "line_items[0][price_data][recurring][interval]": "year",
        "line_items[0][quantity]": "1",
        "metadata[name]": name,
        "metadata[companyName]": companyName || "",
        "metadata[licenseNo]": licenseNo,
        "metadata[city]": city || "",
        "metadata[state]": state || "",
        "metadata[phone]": phone || "",
        "metadata[email]": email,
        "metadata[bio]": (bio || "").slice(0, 400),
        success_url: `${SITE_URL}?inspector_registered=true`,
        cancel_url: `${SITE_URL}?inspector_registered=cancelled`,
      });

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${STRIPE_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      const stripeData = await stripeRes.json();
      if (!stripeRes.ok) return res.status(400).json({ error: stripeData.error?.message });
      return res.status(200).json({ url: stripeData.url });
    }

    // ── CONFIRM REGISTRATION (after Stripe payment) ──────────────
    if (action === "confirm") {
      const { sessionId } = req.body;
      const sessionRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
        headers: { "Authorization": `Bearer ${STRIPE_KEY}` },
      });
      const session = await sessionRes.json();
      if (!sessionRes.ok) return res.status(400).json({ error: "Could not verify payment." });
      if (session.payment_status !== "paid" && session.status !== "complete") {
        return res.status(400).json({ error: "Payment not completed." });
      }

      const m = session.metadata;

      // Check for conflict of interest — does this license belong to a buyer/seller profile?
      const conflictRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?license_number=eq.${encodeURIComponent(m.licenseNo)}&role=neq.inspector&select=id,role,email`,
        { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
      );
      const conflicts = await conflictRes.json();
      const hasConflict = conflicts.length > 0;

      // Upsert inspector profile
      await fetch(`${SUPABASE_URL}/rest/v1/inspector_profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          name: m.name, company_name: m.companyName || null, license_no: m.licenseNo,
          city: m.city || null, state: m.state || null, phone: m.phone || null,
          email: m.email, bio: m.bio || null,
          verified: true, active: true,
          conflict_flag: hasConflict,
          stripe_session_id: sessionId,
          registered_at: new Date().toISOString(),
          subscription_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      });

      return res.status(200).json({ success: true, hasConflict });
    }

    // ── SEARCH DIRECTORY ─────────────────────────────────────────
    if (action === "search" || req.method === "GET") {
      const { name, state, city, minScore } = req.body || {};
      let query = `${SUPABASE_URL}/rest/v1/inspector_profiles?active=eq.true&select=*`;
      if (state) query += `&state=eq.${encodeURIComponent(state)}`;
      if (city) query += `&city=ilike.${encodeURIComponent("*" + city + "*")}`;
      if (name) query += `&name=ilike.${encodeURIComponent("*" + name + "*")}`;
      query += "&order=avg_trust_score.desc.nullslast";

      const r = await fetch(query, { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } });
      const inspectors = await r.json();
      return res.status(200).json({ inspectors: Array.isArray(inspectors) ? inspectors : [] });
    }

    // ── GET PROFILE + REPORT HISTORY ────────────────────────────
    if (action === "profile") {
      const { licenseNo } = req.body;
      if (!licenseNo) return res.status(400).json({ error: "License number required." });

      // Get inspector profile
      const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/inspector_profiles?license_no=eq.${encodeURIComponent(licenseNo)}&select=*`,
        { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
      );
      const profiles = await profileRes.json();
      const profile = profiles[0] || null;

      // Get all reports for this inspector
      const reportsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/inspection_reports?license_no=eq.${encodeURIComponent(licenseNo)}&select=*&order=created_at.desc`,
        { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
      );
      const reports = await reportsRes.json();

      // Check conflict of interest
      const conflictRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?license_number=eq.${encodeURIComponent(licenseNo)}&role=neq.inspector&select=id,role`,
        { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
      );
      const conflicts = await conflictRes.json();

      return res.status(200).json({
        profile,
        reports: Array.isArray(reports) ? reports : [],
        conflictOfInterest: conflicts.length > 0,
        conflictDetails: conflicts.length > 0 ? `This license number is also associated with a ${conflicts[0].role} account.` : null,
      });
    }

    // ── UPDATE AGGREGATE SCORES (called after each new analysis) ─
    if (action === "update_scores") {
      const { licenseNo } = req.body;
      if (!licenseNo) return res.status(400).json({ error: "License number required." });

      const reportsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/inspection_reports?license_no=eq.${encodeURIComponent(licenseNo)}&select=analysis_data`,
        { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
      );
      const reports = await reportsRes.json();

      if (!Array.isArray(reports) || reports.length === 0) return res.status(200).json({ updated: false });

      const validReports = reports.filter(r => r.analysis_data);
      if (validReports.length === 0) return res.status(200).json({ updated: false });

      const avg = key => Math.round(validReports.reduce((sum, r) => sum + (r.analysis_data?.[key] || 0), 0) / validReports.length);
      const grades = validReports.map(r => r.analysis_data?.inspectorGrade || "C");
      const gradeMode = grades.sort((a, b) => grades.filter(v=>v===b).length - grades.filter(v=>v===a).length)[0];

      await fetch(`${SUPABASE_URL}/rest/v1/inspector_profiles?license_no=eq.${encodeURIComponent(licenseNo)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({
          avg_trust_score: avg("trustScore"),
          avg_balance_score: avg("balanceScore"),
          avg_completeness_score: avg("completenessScore"),
          avg_objectivity_score: avg("objectivityScore"),
          report_count: validReports.length,
          avg_grade: gradeMode,
          last_updated: new Date().toISOString(),
        }),
      });

      return res.status(200).json({ updated: true, reportCount: validReports.length });
    }

    return res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    console.error("inspector error:", err.message);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
};
