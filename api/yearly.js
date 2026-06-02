// api/yearly.js — Run via Vercel Cron on Jan 1st each year
// Add to vercel.json: {"crons":[{"path":"/api/yearly","schedule":"0 0 1 1 *"}]}
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const SB = process.env.SUPABASE_URL;
  const SK = process.env.SUPABASE_SERVICE_KEY;
  const CRON_SECRET = process.env.CRON_SECRET;

  // Secure the endpoint
  if (req.method === "GET") {
    const auth = req.headers.authorization;
    if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  if (!SB || !SK) return res.status(500).json({ error: "DB not configured" });

  const year = req.body?.year || (new Date().getFullYear() - 1);

  try {
    // Get all completed reports for the year
    const r = await fetch(
      `${SB}/rest/v1/inspection_reports?report_year=eq.${year}&status=eq.complete&select=*`,
      { headers: { "apikey": SK, "Authorization": `Bearer ${SK}` } }
    );
    const reports = await r.json();
    if (!Array.isArray(reports) || reports.length === 0) {
      return res.status(200).json({ message: "No reports found for year", year });
    }

    // Group by license number
    const byLicense = {};
    for (const rpt of reports) {
      const key = rpt.license_no || `unknown_${rpt.inspector_name}`;
      if (!byLicense[key]) byLicense[key] = [];
      byLicense[key].push(rpt);
    }

    const summaries = [];
    const allAvgScores = [];

    // Calculate per-inspector stats
    for (const [licenseNo, rpts] of Object.entries(byLicense)) {
      const count = rpts.length;
      const avgTrust = Math.round(rpts.reduce((s,r)=>s+(r.trust_score||0),0)/count);
      const avgBalance = Math.round(rpts.reduce((s,r)=>s+(r.balance_score||0),0)/count);
      const avgCompleteness = Math.round(rpts.reduce((s,r)=>s+(r.completeness_score||0),0)/count);

      let majorCount = 0, minorCount = 0, biasFlags = 0;
      for (const rpt of rpts) {
        const a = rpt.analysis_data || {};
        majorCount += (a.dealBreakers?.length||0) + (a.notableIssues?.length||0);
        minorCount += (a.minorObservations?.length||0);
        biasFlags += (a.biasIndicators?.length||0);
      }

      const grades = rpts.map(r=>r.inspector_grade||"C");
      const avgGrade = grades.sort((a,b)=>grades.filter(v=>v===b).length-grades.filter(v=>v===a).length)[0];
      const inspName = rpts[0]?.inspector_name || "Unknown";

      allAvgScores.push({ licenseNo, avgTrust, inspName });

      summaries.push({
        license_no: licenseNo,
        inspector_name: inspName,
        year: Number(year),
        total_inspections: count,
        avg_trust_score: avgTrust,
        avg_balance_score: avgBalance,
        avg_completeness_score: avgCompleteness,
        avg_grade: avgGrade,
        major_findings_count: majorCount,
        minor_findings_count: minorCount,
        bias_flags_count: biasFlags,
        generated_at: new Date().toISOString(),
        summary_data: {
          topFindings: [],
          reportIds: rpts.map(r=>r.id),
          inspectorCount: Object.keys(byLicense).length,
        },
      });
    }

    // Calculate rankings
    allAvgScores.sort((a,b) => b.avgTrust - a.avgTrust);
    const total = allAvgScores.length;
    for (const sum of summaries) {
      const rank = allAvgScores.findIndex(s=>s.licenseNo===sum.license_no) + 1;
      sum.ranking = rank;
      sum.percentile = Math.round(((total - rank) / total) * 100);
    }

    // Upsert all summaries
    const upsertRes = await fetch(`${SB}/rest/v1/yearly_summaries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SK,
        "Authorization": `Bearer ${SK}`,
        "Prefer": "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(summaries),
    });

    if (!upsertRes.ok) {
      const err = await upsertRes.json();
      throw new Error(JSON.stringify(err));
    }

    return res.status(200).json({
      success: true,
      year,
      inspectorsProcessed: summaries.length,
      reportsProcessed: reports.length,
      topInspector: allAvgScores[0]?.inspName,
    });

  } catch (err) {
    console.error("yearly error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
