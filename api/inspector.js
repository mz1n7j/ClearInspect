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

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("inspector: SUPABASE_URL or SUPABASE_SERVICE_KEY is missing");
    return res.status(500).json({ error: "Database is not configured." });
  }

  const SB_HEADERS = { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` };

  // Helper: GET from Supabase, always returns an array, logs failures.
  async function sbGet(pathAndQuery) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, { headers: SB_HEADERS });
      const text = await r.text();
      if (!r.ok) { console.error(`sbGet ${pathAndQuery} FAILED ${r.status}: ${text}`); return []; }
      const d = text ? JSON.parse(text) : [];
      return Array.isArray(d) ? d : [];
    } catch (e) { console.error(`sbGet ${pathAndQuery} threw: ${e.message}`); return []; }
  }

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

      const conflicts = await sbGet(
        `profiles?license_number=eq.${encodeURIComponent(m.licenseNo)}&role=neq.inspector&select=id,role,email`
      );
      const hasConflict = conflicts.length > 0;

      // CRITICAL: this is the registry insert. It is now checked. If it fails,
      // we log the exact Supabase error and report it instead of falsely
      // returning success (which is what made registrations silently vanish).
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/inspector_profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`,
          // return=representation so we can confirm a row actually came back.
          // merge-duplicates requires a UNIQUE constraint on license_no (see notes).
          "Prefer": "resolution=merge-duplicates,return=representation",
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

      const insertText = await insertRes.text();
      if (!insertRes.ok) {
        console.error(`inspector_profiles INSERT FAILED ${insertRes.status}: ${insertText}`);
        // The customer paid, so this must NOT look like a success. Surface it.
        return res.status(500).json({
          error: "Payment succeeded but saving your directory profile failed. Our team has been notified.",
          detail: insertText,
        });
      }

      let inserted = [];
      try { inserted = insertText ? JSON.parse(insertText) : []; } catch {}
      if (!Array.isArray(inserted) || inserted.length === 0) {
        console.error(`inspector_profiles INSERT returned no row. Body: ${insertText}`);
      }

      return res.status(200).json({ success: true, hasConflict, saved: Array.isArray(inserted) && inserted.length > 0 });
    }

    // ── SEARCH DIRECTORY ─────────────────────────────────────────
    if (action === "search" || req.method === "GET") {
      const { name, state, city } = req.body || {};
      let query = `inspector_profiles?active=eq.true&select=*`;
      if (state) query += `&state=eq.${encodeURIComponent(state)}`;
      if (city) query += `&city=ilike.${encodeURIComponent("*" + city + "*")}`;
      if (name) query += `&name=ilike.${encodeURIComponent("*" + name + "*")}`;
      query += "&order=avg_trust_score.desc.nullslast";

      const inspectors = await sbGet(query);
      return res.status(200).json({ inspectors });
    }

    // ── GET PROFILE + REPORT HISTORY ────────────────────────────
    if (action === "profile") {
      const { licenseNo } = req.body;
      if (!licenseNo) return res.status(400).json({ error: "License number required." });

      const profiles = await sbGet(`inspector_profiles?license_no=eq.${encodeURIComponent(licenseNo)}&select=*`);
      const profile = profiles[0] || null;

      const reports = await sbGet(`inspection_reports?license_no=eq.${encodeURIComponent(licenseNo)}&select=*&order=created_at.desc`);

      const conflicts = await sbGet(`profiles?license_number=eq.${encodeURIComponent(licenseNo)}&role=neq.inspector&select=id,role`);

      return res.status(200).json({
        profile,
        reports,
        conflictOfInterest: conflicts.length > 0,
        conflictDetails: conflicts.length > 0 ? `This license number is also associated with a ${conflicts[0].role} account.` : null,
      });
    }

    // ── UPDATE AGGREGATE SCORES ──────────────────────────────────
    if (action === "update_scores") {
      const { licenseNo } = req.body;
      if (!licenseNo) return res.status(400).json({ error: "License number required." });

      const reports = await sbGet(`inspection_reports?license_no=eq.${encodeURIComponent(licenseNo)}&select=analysis_data`);
      if (reports.length === 0) return res.status(200).json({ updated: false });

      const validReports = reports.filter(r => r.analysis_data);
      if (validReports.length === 0) return res.status(200).json({ updated: false });

      const avg = key => Math.round(validReports.reduce((sum, r) => sum + (r.analysis_data?.[key] || 0), 0) / validReports.length);
      const grades = validReports.map(r => r.analysis_data?.inspectorGrade || "C");
      const gradeMode = grades.sort((a, b) => grades.filter(v=>v===b).length - grades.filter(v=>v===a).length)[0];

      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/inspector_profiles?license_no=eq.${encodeURIComponent(licenseNo)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...SB_HEADERS, "Prefer": "return=representation" },
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
      const patchText = await patchRes.text();
      if (!patchRes.ok) {
        console.error(`update_scores PATCH FAILED ${patchRes.status}: ${patchText}`);
        return res.status(500).json({ error: "Failed to update scores.", detail: patchText });
      }
      if (patchText === "[]") {
        console.error(`update_scores PATCH matched 0 rows for license ${licenseNo} — no inspector_profiles row exists yet.`);
      }

      return res.status(200).json({ updated: true, reportCount: validReports.length });
    }

    // ── DELETE INSPECTOR (admin only) ────────────────────────────
    if (action === "delete_inspector") {
      const { licenseNo, adminUserId } = req.body;
      if (!licenseNo || !adminUserId) {
        return res.status(400).json({ error: "License number and admin user ID are required." });
      }

      // Verify the requesting user is an admin
      const adminData = await sbGet(`profiles?id=eq.${encodeURIComponent(adminUserId)}&select=role`);
      if (adminData.length === 0 || adminData[0].role !== "admin") {
        return res.status(403).json({ error: "Forbidden. Admin access required." });
      }

      // Delete the inspector profile
      const deleteRes = await fetch(
        `${SUPABASE_URL}/rest/v1/inspector_profiles?license_no=eq.${encodeURIComponent(licenseNo)}`,
        { method: "DELETE", headers: SB_HEADERS }
      );

      if (!deleteRes.ok) {
        const t = await deleteRes.text();
        console.error(`delete_inspector FAILED ${deleteRes.status}: ${t}`);
        return res.status(500).json({ error: "Failed to delete inspector profile." });
      }

      return res.status(200).json({ success: true, message: `Inspector ${licenseNo} has been deleted.` });
    }

    return res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    console.error("inspector error:", err.message);
    return res.status(500).json({ error: "Server error: " + err.message });
  }
};
