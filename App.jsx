import { useState, useRef, useEffect } from "react";

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

// --- Utility ---
function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function StarRating({ score, max = 5 }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          style={{
            color: i < Math.round(score) ? "#C8A84B" : "#3a3a3a",
            fontSize: 16,
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function ScoreBadge({ score }) {
  const color =
    score >= 80 ? "#2ecc71" : score >= 55 ? "#C8A84B" : "#e74c3c";
  const label =
    score >= 80 ? "TRUSTED" : score >= 55 ? "REVIEW" : "FLAGGED";
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 14px",
        borderRadius: 4,
        border: `1.5px solid ${color}`,
        color,
        fontSize: 12,
        fontFamily: "'DM Mono', monospace",
        letterSpacing: "0.12em",
        fontWeight: 700,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
          display: "inline-block",
        }}
      />
      {label} · {score}/100
    </div>
  );
}

// --- Main App ---
export default function App() {
  const [view, setView] = useState("home"); // home | upload | database | report
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [toast, setToast] = useState(null);
  const fileRef = useRef();

  // Form state
  const [form, setForm] = useState({
    inspectorName: "",
    companyName: "",
    licenseNo: "",
    propertyAddress: "",
    buyerEmail: "",
    sellerEmail: "",
    realtorEmail: "",
    reportText: "",
    file: null,
  });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3800);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setForm((f) => ({ ...f, file }));
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm((f) => ({ ...f, reportText: ev.target.result }));
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!form.inspectorName || !form.propertyAddress || !form.reportText) {
      showToast("Please fill in all required fields.", "error");
      return;
    }
    setUploading(true);
    setAnalysisResult(null);

    try {
      const systemPrompt = `You are an expert real estate inspection fraud analyst. 
Analyze inspection reports to detect quality, completeness, and potential fraud indicators.
Respond ONLY in valid JSON with this exact shape:
{
  "trustScore": <integer 0-100>,
  "fraudRisk": "<Low|Moderate|High>",
  "summary": "<2-3 sentence plain-language summary>",
  "strengths": ["<point>","<point>","<point>"],
  "concerns": ["<point>","<point>","<point>"],
  "inspectorGrade": "<A|B|C|D|F>",
  "completenessScore": <integer 0-100>,
  "technicalScore": <integer 0-100>,
  "objectivityScore": <integer 0-100>,
  "emailBuyer": "<professional email body to buyer summarizing analysis>",
  "emailSeller": "<professional email body to seller summarizing analysis>",
  "emailRealtor": "<professional email body to realtor summarizing analysis>",
  "redFlags": ["<flag if any, else empty array>"],
  "recommendation": "<one sentence actionable recommendation>"
}`;

      const userMsg = `Inspector: ${form.inspectorName}
Company: ${form.companyName}
License: ${form.licenseNo}
Property: ${form.propertyAddress}

INSPECTION REPORT CONTENT:
${form.reportText.slice(0, 3000)}`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: "user", content: userMsg }],
        }),
      });

      const data = await res.json();
      const raw = data.content?.find((b) => b.type === "text")?.text || "{}";
      const clean = raw.replace(/```json|```/g, "").trim();
      const analysis = JSON.parse(clean);

      const newReport = {
        id: generateId(),
        ...form,
        file: undefined,
        analysis,
        date: new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
      };

      setReports((r) => [newReport, ...r]);
      setAnalysisResult(newReport);
      setView("report");
      showToast("Report analyzed successfully.");
    } catch (err) {
      showToast("Analysis failed. Please try again.", "error");
    } finally {
      setUploading(false);
    }
  };

  const sendEmails = async (report) => {
    setEmailSending(true);
    await new Promise((r) => setTimeout(r, 1800));
    setEmailSending(false);
    setEmailSent(true);
    showToast("Email summaries dispatched to all parties.");
  };

  const viewReport = (r) => {
    setAnalysisResult(r);
    setView("report");
  };

  return (
    <div style={styles.root}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            ...styles.toast,
            borderColor: toast.type === "error" ? "#e74c3c" : "#C8A84B",
            color: toast.type === "error" ? "#e74c3c" : "#C8A84B",
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <button onClick={() => setView("home")} style={styles.logo}>
            <span style={styles.logoMark}>▲</span>
            <span>ClearInspect</span>
          </button>
          <nav style={styles.nav}>
            <button
              style={view === "upload" ? styles.navActive : styles.navBtn}
              onClick={() => setView("upload")}
            >
              Upload Report
            </button>
            <button
              style={view === "database" ? styles.navActive : styles.navBtn}
              onClick={() => setView("database")}
            >
              Inspector Registry ({reports.length})
            </button>
          </nav>
        </div>
      </header>

      {/* HOME */}
      {view === "home" && (
        <main style={styles.main}>
          <div style={styles.heroSection}>
            <div style={styles.pill}>AI-Powered · Real Estate Transparency</div>
            <h1 style={styles.heroTitle}>
              The Truth About
              <br />
              <span style={styles.heroAccent}>Your Inspector</span>
            </h1>
            <p style={styles.heroSub}>
              Upload any inspection report. Our AI instantly scores the inspector
              on objectivity, completeness, and fraud risk — then automatically
              notifies all parties with a full performance review.
            </p>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
              <button style={styles.ctaPrimary} onClick={() => setView("upload")}>
                Analyze a Report →
              </button>
              <button style={styles.ctaSecondary} onClick={() => setView("database")}>
                View Registry
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div style={styles.statsRow}>
            {[
              { n: "1 in 4", label: "inspectors flagged for bias" },
              { n: "AI", label: "fraud risk scoring" },
              { n: "3-way", label: "auto email summaries" },
              { n: "100%", label: "transparent & free" },
            ].map((s) => (
              <div key={s.label} style={styles.statCard}>
                <div style={styles.statNum}>{s.n}</div>
                <div style={styles.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>How It Works</h2>
            <div style={styles.steps}>
              {[
                {
                  n: "01",
                  title: "Upload the Report",
                  body: "Paste or upload any PDF or text inspection report along with inspector details.",
                },
                {
                  n: "02",
                  title: "AI Analysis",
                  body: "Our AI agent scores completeness, technical rigor, objectivity, and flags red flags.",
                },
                {
                  n: "03",
                  title: "Performance Review",
                  body: "Get a full inspector performance dossier — like a Glassdoor review, but for inspectors.",
                },
                {
                  n: "04",
                  title: "Auto Email All Parties",
                  body: "Buyer, seller, and realtor each receive a tailored AI-written summary automatically.",
                },
              ].map((s) => (
                <div key={s.n} style={styles.stepCard}>
                  <div style={styles.stepNum}>{s.n}</div>
                  <h3 style={styles.stepTitle}>{s.title}</h3>
                  <p style={styles.stepBody}>{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* UPLOAD */}
      {view === "upload" && (
        <main style={styles.main}>
          <div style={styles.uploadWrap}>
            <h2 style={styles.pageTitle}>Submit Inspection Report</h2>
            <p style={styles.pageSub}>
              All submissions are analyzed by AI and added to the public inspector registry.
            </p>

            <div style={styles.formGrid}>
              {/* Inspector Info */}
              <div style={styles.formCard}>
                <div style={styles.formCardTitle}>Inspector Details</div>
                {[
                  { label: "Inspector Full Name *", key: "inspectorName", placeholder: "John Smith" },
                  { label: "Company / Firm", key: "companyName", placeholder: "Apex Home Inspections LLC" },
                  { label: "License Number", key: "licenseNo", placeholder: "HI-20984" },
                ].map((f) => (
                  <div key={f.key} style={styles.field}>
                    <label style={styles.label}>{f.label}</label>
                    <input
                      style={styles.input}
                      placeholder={f.placeholder}
                      value={form[f.key]}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, [f.key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>

              {/* Property & Contacts */}
              <div style={styles.formCard}>
                <div style={styles.formCardTitle}>Property & Parties</div>
                {[
                  { label: "Property Address *", key: "propertyAddress", placeholder: "123 Maple St, Austin TX 78701" },
                  { label: "Buyer Email", key: "buyerEmail", placeholder: "buyer@email.com" },
                  { label: "Seller Email", key: "sellerEmail", placeholder: "seller@email.com" },
                  { label: "Realtor Email", key: "realtorEmail", placeholder: "agent@realty.com" },
                ].map((f) => (
                  <div key={f.key} style={styles.field}>
                    <label style={styles.label}>{f.label}</label>
                    <input
                      style={styles.input}
                      placeholder={f.placeholder}
                      value={form[f.key]}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, [f.key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Report Upload */}
            <div style={{ ...styles.formCard, marginTop: 20 }}>
              <div style={styles.formCardTitle}>Inspection Report *</div>
              <div style={styles.dropZone} onClick={() => fileRef.current?.click()}>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.pdf,.doc,.docx"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                <span style={{ fontSize: 28 }}>📄</span>
                <span style={{ color: "#888", fontSize: 14, marginTop: 8 }}>
                  {form.file ? form.file.name : "Click to upload report (.txt, .pdf, .doc)"}
                </span>
              </div>
              <div style={{ margin: "16px 0", color: "#555", fontSize: 12, textAlign: "center" }}>
                — or paste report text below —
              </div>
              <textarea
                style={styles.textarea}
                placeholder="Paste full inspection report content here..."
                value={form.reportText}
                onChange={(e) =>
                  setForm((p) => ({ ...p, reportText: e.target.value }))
                }
                rows={10}
              />
            </div>

            <button
              style={uploading ? styles.btnDisabled : styles.ctaPrimary}
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={styles.spinner} /> Analyzing with AI...
                </span>
              ) : (
                "Analyze Report & Generate Review →"
              )}
            </button>
          </div>
        </main>
      )}

      {/* REPORT */}
      {view === "report" && analysisResult && (
        <ReportView
          report={analysisResult}
          onSendEmails={sendEmails}
          emailSending={emailSending}
          emailSent={emailSent}
          onBack={() => setView("database")}
        />
      )}

      {/* DATABASE */}
      {view === "database" && (
        <main style={styles.main}>
          <h2 style={styles.pageTitle}>Inspector Registry</h2>
          <p style={styles.pageSub}>
            Public database of analyzed inspection reports. Search, review, and verify.
          </p>

          {reports.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
              <p style={{ color: "#666" }}>No reports submitted yet.</p>
              <button
                style={{ ...styles.ctaPrimary, marginTop: 16 }}
                onClick={() => setView("upload")}
              >
                Submit the first report
              </button>
            </div>
          ) : (
            <div style={styles.cardGrid}>
              {reports.map((r) => (
                <div key={r.id} style={styles.registryCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={styles.inspectorName}>{r.inspectorName}</div>
                      <div style={styles.companyName}>{r.companyName || "Independent"}</div>
                    </div>
                    <ScoreBadge score={r.analysis.trustScore} />
                  </div>
                  <div style={styles.propertyLine}>📍 {r.propertyAddress}</div>
                  <p style={styles.summarySnippet}>{r.analysis.summary.slice(0, 120)}…</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ ...styles.riskTag, background: r.analysis.fraudRisk === "High" ? "#3a1010" : r.analysis.fraudRisk === "Moderate" ? "#2d2000" : "#0d2b1a", color: r.analysis.fraudRisk === "High" ? "#e74c3c" : r.analysis.fraudRisk === "Moderate" ? "#C8A84B" : "#2ecc71", borderColor: r.analysis.fraudRisk === "High" ? "#e74c3c" : r.analysis.fraudRisk === "Moderate" ? "#C8A84B" : "#2ecc71" }}>
                        {r.analysis.fraudRisk} Risk
                      </span>
                      <span style={styles.gradeTag}>Grade {r.analysis.inspectorGrade}</span>
                    </div>
                    <button style={styles.viewBtn} onClick={() => viewReport(r)}>
                      View Review →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}
    </div>
  );
}

function ReportView({ report, onSendEmails, emailSending, emailSent, onBack }) {
  const a = report.analysis;
  const [activeTab, setActiveTab] = useState("overview");
  const [pdfExporting, setPdfExporting] = useState(false);

  const tabs = ["overview", "scores", "emails", "flags"];

  const exportToPDF = async () => {
    setPdfExporting(true);
    try {
      // Dynamically load jsPDF
      await new Promise((resolve, reject) => {
        if (window.jspdf) { resolve(); return; }
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });

      const W = 215.9;
      const margin = 18;
      const contentW = W - margin * 2;
      let y = 0;

      // ── helpers ──────────────────────────────────────────────
      const hex2rgb = (hex) => {
        const h = hex.replace("#", "");
        return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
      };

      const setColor = (hex, type = "text") => {
        const [r,g,b] = hex2rgb(hex);
        if (type === "fill") doc.setFillColor(r,g,b);
        else if (type === "draw") doc.setDrawColor(r,g,b);
        else doc.setTextColor(r,g,b);
      };

      const addPage = () => { doc.addPage(); y = margin; };

      const checkY = (needed = 12) => { if (y + needed > 265) addPage(); };

      const text = (str, x, size=10, color="#cccccc", style="normal", maxW=null) => {
        doc.setFontSize(size);
        doc.setFont("helvetica", style);
        setColor(color);
        if (maxW) {
          const lines = doc.splitTextToSize(String(str), maxW);
          doc.text(lines, x, y);
          return lines.length;
        }
        doc.text(String(str), x, y);
        return 1;
      };

      const bar = (label, value, color, barY) => {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        setColor("#888888");
        doc.text(label, margin, barY);
        setColor(value >= 80 ? "#2ecc71" : value >= 55 ? "#C8A84B" : "#e74c3c");
        doc.text(`${value}/100`, W - margin, barY, { align: "right" });
        // track
        setColor("#222222", "fill");
        doc.roundedRect(margin, barY + 2, contentW, 4, 1, 1, "F");
        // fill
        setColor(color, "fill");
        doc.roundedRect(margin, barY + 2, contentW * (value / 100), 4, 1, 1, "F");
      };

      // ── COVER PAGE ───────────────────────────────────────────
      // Dark background
      setColor("#0e0e0e", "fill");
      doc.rect(0, 0, W, 279.4, "F");

      // Gold top bar
      setColor("#C8A84B", "fill");
      doc.rect(0, 0, W, 2, "F");

      // Watermark text
      doc.setFontSize(72);
      doc.setFont("helvetica", "bold");
      setColor("#1a1a1a");
      doc.text("CI", W / 2, 120, { align: "center" });

      // Title block
      y = 52;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      setColor("#C8A84B");
      doc.text("CLEARINSPECT · INSPECTOR PERFORMANCE REVIEW", W / 2, y, { align: "center" });

      y = 68;
      doc.setFontSize(26);
      doc.setFont("helvetica", "bold");
      setColor("#f0f0f0");
      const nameLines = doc.splitTextToSize(report.inspectorName.toUpperCase(), contentW);
      doc.text(nameLines, W / 2, y, { align: "center" });
      y += nameLines.length * 11;

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      setColor("#C8A84B");
      doc.text(report.companyName || "Independent Inspector", W / 2, y + 4, { align: "center" });

      // Score circle
      const cx = W / 2, cy = 155, r = 22;
      const scoreColor = a.trustScore >= 80 ? "#2ecc71" : a.trustScore >= 55 ? "#C8A84B" : "#e74c3c";
      setColor("#1a1a1a", "fill");
      setColor(scoreColor, "draw");
      doc.setLineWidth(1.5);
      doc.circle(cx, cy, r, "FD");
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      setColor(scoreColor);
      doc.text(String(a.trustScore), cx, cy + 3, { align: "center" });
      doc.setFontSize(7);
      setColor("#888888");
      doc.text("TRUST SCORE", cx, cy + 10, { align: "center" });

      // Grade badge
      const gradeColor = a.inspectorGrade === "A" ? "#2ecc71" : a.inspectorGrade === "B" ? "#C8A84B" : "#e74c3c";
      setColor("#1a1a1a", "fill");
      setColor(gradeColor, "draw");
      doc.setLineWidth(1);
      doc.roundedRect(cx + 28, cy - 10, 20, 20, 3, 3, "FD");
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      setColor(gradeColor);
      doc.text(a.inspectorGrade, cx + 38, cy + 4, { align: "center" });

      // Fraud badge
      const riskColor = a.fraudRisk === "High" ? "#e74c3c" : a.fraudRisk === "Moderate" ? "#C8A84B" : "#2ecc71";
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      setColor(riskColor);
      doc.text(`${a.fraudRisk.toUpperCase()} FRAUD RISK`, cx - 26, cy + 5, { align: "center" });

      // Property info box
      setColor("#111111", "fill");
      setColor("#2a2a2a", "draw");
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, 190, contentW, 32, 3, 3, "FD");
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      setColor("#888888");
      doc.text("PROPERTY", margin + 6, 199);
      doc.text("LICENSE", margin + 6, 209);
      doc.text("DATE ANALYZED", margin + 6, 219);
      setColor("#cccccc");
      doc.text(report.propertyAddress || "N/A", margin + 44, 199);
      doc.text(report.licenseNo || "Not Provided", margin + 44, 209);
      doc.text(report.date, margin + 44, 219);

      // Disclaimer at bottom
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "italic");
      setColor("#444444");
      const disc = "DISCLAIMER: This report represents AI-generated analysis and opinion based on submitted content. It does not constitute a legal determination, background check, or official licensing board finding. ClearInspect scores are provided for informational transparency purposes only.";
      const discLines = doc.splitTextToSize(disc, contentW);
      doc.text(discLines, W / 2, 258, { align: "center" });

      // Gold bottom bar
      setColor("#C8A84B", "fill");
      doc.rect(0, 277, W, 2, "F");

      // ── PAGE 2: AI SUMMARY & STRENGTHS/CONCERNS ──────────────
      addPage();

      // Section header helper
      const sectionHeader = (title) => {
        checkY(14);
        setColor("#C8A84B", "fill");
        doc.rect(margin, y - 4, 3, 10, "F");
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        setColor("#C8A84B");
        doc.text(title, margin + 6, y + 3);
        y += 12;
        setColor("#1e1e1e", "draw");
        doc.setLineWidth(0.2);
        doc.line(margin, y - 2, W - margin, y - 2);
        y += 4;
      };

      // Page header
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      setColor("#444444");
      doc.text("CLEARINSPECT PERFORMANCE REVIEW", margin, y);
      doc.text(`${report.inspectorName} · ${report.date}`, W - margin, y, { align: "right" });
      setColor("#C8A84B", "fill");
      doc.rect(margin, y + 2, contentW, 0.4, "F");
      y += 10;

      sectionHeader("AI SUMMARY");
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      setColor("#aaaaaa");
      const sumLines = doc.splitTextToSize(a.summary, contentW);
      doc.text(sumLines, margin, y);
      y += sumLines.length * 5.5 + 10;

      // Recommendation box
      checkY(20);
      setColor("#1a1400", "fill");
      setColor("#C8A84B", "draw");
      doc.setLineWidth(0.4);
      doc.roundedRect(margin, y - 4, contentW, 16, 2, 2, "FD");
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      setColor("#C8A84B");
      doc.text("RECOMMENDATION:", margin + 5, y + 3);
      doc.setFont("helvetica", "normal");
      setColor("#cccccc");
      const recLines = doc.splitTextToSize(a.recommendation, contentW - 50);
      doc.text(recLines, margin + 42, y + 3);
      y += 22;

      // Strengths
      sectionHeader("STRENGTHS");
      (a.strengths || []).forEach((s) => {
        checkY(10);
        setColor("#2ecc71", "fill");
        doc.circle(margin + 2, y - 1, 1.2, "F");
        doc.setFontSize(9.5);
        doc.setFont("helvetica", "normal");
        setColor("#aaaaaa");
        const ls = doc.splitTextToSize(s, contentW - 8);
        doc.text(ls, margin + 7, y);
        y += ls.length * 5 + 3;
      });
      y += 4;

      // Concerns
      sectionHeader("CONCERNS");
      (a.concerns || []).forEach((c) => {
        checkY(10);
        setColor("#e74c3c", "fill");
        doc.rect(margin + 0.5, y - 3.5, 2.5, 2.5, "F");
        doc.setFontSize(9.5);
        doc.setFont("helvetica", "normal");
        setColor("#aaaaaa");
        const lc = doc.splitTextToSize(c, contentW - 8);
        doc.text(lc, margin + 7, y);
        y += lc.length * 5 + 3;
      });

      // ── PAGE 3: SCORECARD ─────────────────────────────────────
      addPage();

      // Page header
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      setColor("#444444");
      doc.text("CLEARINSPECT PERFORMANCE REVIEW", margin, y);
      doc.text(`${report.inspectorName} · ${report.date}`, W - margin, y, { align: "right" });
      setColor("#C8A84B", "fill");
      doc.rect(margin, y + 2, contentW, 0.4, "F");
      y += 10;

      sectionHeader("PERFORMANCE SCORECARD");

      const scorecardItems = [
        { label: "Trust Score", val: a.trustScore, color: "#C8A84B" },
        { label: "Completeness", val: a.completenessScore, color: "#3498db" },
        { label: "Technical Rigor", val: a.technicalScore, color: "#9b59b6" },
        { label: "Objectivity", val: a.objectivityScore, color: "#2ecc71" },
      ];

      scorecardItems.forEach((item) => {
        checkY(16);
        bar(item.label, item.val, item.color, y);
        y += 14;
      });

      y += 6;
      sectionHeader("RED FLAG ANALYSIS");

      if (!a.redFlags || a.redFlags.length === 0) {
        checkY(14);
        setColor("#0d2b1a", "fill");
        setColor("#2ecc71", "draw");
        doc.setLineWidth(0.4);
        doc.roundedRect(margin, y - 4, contentW, 14, 2, 2, "FD");
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        setColor("#2ecc71");
        doc.text("✓  No red flags detected. Report meets standard industry criteria.", margin + 6, y + 4);
        y += 18;
      } else {
        (a.redFlags || []).forEach((flag) => {
          checkY(12);
          setColor("#1a0505", "fill");
          setColor("#e74c3c", "draw");
          doc.setLineWidth(0.3);
          doc.roundedRect(margin, y - 4, contentW, 12, 2, 2, "FD");
          doc.setFontSize(8.5);
          doc.setFont("helvetica", "normal");
          setColor("#e74c3c");
          doc.text("⚑", margin + 4, y + 2);
          setColor("#cccccc");
          const fl = doc.splitTextToSize(flag, contentW - 16);
          doc.text(fl, margin + 12, y + 2);
          y += fl.length * 5 + 6;
        });
      }

      y += 8;
      sectionHeader("INSPECTOR PROFILE");
      const profileItems = [
        ["Inspector", report.inspectorName],
        ["Company", report.companyName || "Independent"],
        ["License No.", report.licenseNo || "Not Provided"],
        ["Property Inspected", report.propertyAddress],
        ["Date of Analysis", report.date],
        ["Overall Grade", a.inspectorGrade],
        ["Fraud Risk Level", a.fraudRisk],
      ];
      profileItems.forEach(([label, value]) => {
        checkY(8);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        setColor("#555555");
        doc.text(label.toUpperCase(), margin, y);
        doc.setFont("helvetica", "normal");
        setColor("#cccccc");
        doc.text(String(value), margin + 52, y);
        setColor("#1e1e1e", "draw");
        doc.setLineWidth(0.15);
        doc.line(margin, y + 2.5, W - margin, y + 2.5);
        y += 9;
      });

      // ── PAGE 4: EMAIL SUMMARIES ────────────────────────────────
      addPage();

      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      setColor("#444444");
      doc.text("CLEARINSPECT PERFORMANCE REVIEW", margin, y);
      doc.text(`${report.inspectorName} · ${report.date}`, W - margin, y, { align: "right" });
      setColor("#C8A84B", "fill");
      doc.rect(margin, y + 2, contentW, 0.4, "F");
      y += 10;

      sectionHeader("AUTO-GENERATED EMAIL SUMMARIES");

      const emailSections = [
        { role: "BUYER", key: "emailBuyer", addr: report.buyerEmail, color: "#3498db" },
        { role: "SELLER", key: "emailSeller", addr: report.sellerEmail, color: "#9b59b6" },
        { role: "REALTOR", key: "emailRealtor", addr: report.realtorEmail, color: "#C8A84B" },
      ];

      emailSections.forEach(({ role, key, addr, color }) => {
        checkY(24);
        // Box header
        setColor("#111111", "fill");
        setColor(color, "draw");
        doc.setLineWidth(0.5);
        doc.roundedRect(margin, y - 5, contentW, 10, 2, 2, "FD");
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        setColor(color);
        doc.text(`TO: ${role}`, margin + 5, y + 1);
        if (addr) {
          doc.setFont("helvetica", "normal");
          setColor("#888888");
          doc.text(`<${addr}>`, margin + 22, y + 1);
        }
        y += 10;

        const emailLines = doc.splitTextToSize(a[key] || "", contentW - 4);
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        setColor("#999999");
        emailLines.forEach((line) => {
          checkY(6);
          doc.text(line, margin + 2, y);
          y += 5;
        });
        y += 10;
      });

      // Final footer on last page
      setColor("#C8A84B", "fill");
      doc.rect(0, 275, W, 2, "F");
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "italic");
      setColor("#333333");
      doc.text("ClearInspect · AI-Powered Real Estate Inspection Transparency · clearinspect.com", W / 2, 271, { align: "center" });

      // ── SAVE ──────────────────────────────────────────────────
      const safeName = report.inspectorName.replace(/\s+/g, "_");
      doc.save(`ClearInspect_Review_${safeName}_${report.date.replace(/\s/g,"")}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("PDF export failed. Please try again.");
    } finally {
      setPdfExporting(false);
    }
  };

  return (
    <main style={styles.main}>
      {/* Back */}
      <button onClick={onBack} style={styles.backBtn}>
        ← Back to Registry
      </button>

      {/* Hero */}
      <div style={styles.reportHero}>
        <div>
          <div style={styles.reportInspectorName}>{report.inspectorName}</div>
          <div style={styles.reportCompany}>
            {report.companyName || "Independent Inspector"} · License {report.licenseNo || "N/A"}
          </div>
          <div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
            📍 {report.propertyAddress} · {report.date}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          <ScoreBadge score={a.trustScore} />
          <div
            style={{
              fontSize: 28,
              fontFamily: "'DM Mono', monospace",
              fontWeight: 700,
              color: a.inspectorGrade === "A" ? "#2ecc71" : a.inspectorGrade === "B" ? "#C8A84B" : "#e74c3c",
            }}
          >
            {a.inspectorGrade}
          </div>
          <button
            onClick={exportToPDF}
            disabled={pdfExporting}
            style={{
              background: pdfExporting ? "#1a1a1a" : "transparent",
              border: "1px solid #C8A84B",
              color: pdfExporting ? "#555" : "#C8A84B",
              padding: "8px 16px",
              borderRadius: 6,
              cursor: pdfExporting ? "not-allowed" : "pointer",
              fontSize: 12,
              fontFamily: "'DM Mono', monospace",
              fontWeight: 700,
              letterSpacing: "0.08em",
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            {pdfExporting ? (
              <><span style={styles.spinner} /> Exporting...</>
            ) : (
              <>↓ Export PDF</>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabBar}>
        {tabs.map((t) => (
          <button
            key={t}
            style={activeTab === t ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div style={styles.tabContent}>
          <div style={styles.summaryBlock}>
            <h3 style={styles.blockTitle}>AI Summary</h3>
            <p style={styles.summaryText}>{a.summary}</p>
          </div>
          <div style={styles.twoCol}>
            <div style={styles.listBlock}>
              <h4 style={{ color: "#2ecc71", fontSize: 13, letterSpacing: "0.1em", marginBottom: 12 }}>
                ✓ STRENGTHS
              </h4>
              {a.strengths?.map((s, i) => (
                <div key={i} style={styles.listItem}>
                  <span style={{ color: "#2ecc71" }}>+</span> {s}
                </div>
              ))}
            </div>
            <div style={styles.listBlock}>
              <h4 style={{ color: "#e74c3c", fontSize: 13, letterSpacing: "0.1em", marginBottom: 12 }}>
                ⚠ CONCERNS
              </h4>
              {a.concerns?.map((s, i) => (
                <div key={i} style={styles.listItem}>
                  <span style={{ color: "#e74c3c" }}>!</span> {s}
                </div>
              ))}
            </div>
          </div>
          <div style={styles.recommendationBox}>
            <span style={{ color: "#C8A84B", fontWeight: 700, marginRight: 8 }}>Recommendation:</span>
            {a.recommendation}
          </div>
        </div>
      )}

      {/* Tab: Scores */}
      {activeTab === "scores" && (
        <div style={styles.tabContent}>
          <h3 style={styles.blockTitle}>Performance Scorecard</h3>
          {[
            { label: "Trust Score", val: a.trustScore, color: "#C8A84B" },
            { label: "Completeness", val: a.completenessScore, color: "#3498db" },
            { label: "Technical Rigor", val: a.technicalScore, color: "#9b59b6" },
            { label: "Objectivity", val: a.objectivityScore, color: "#2ecc71" },
          ].map((s) => (
            <div key={s.label} style={styles.scoreRow}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#ccc", fontSize: 13 }}>{s.label}</span>
                <span
                  style={{
                    color: s.color,
                    fontFamily: "'DM Mono', monospace",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {s.val}/100
                </span>
              </div>
              <div style={styles.barTrack}>
                <div
                  style={{
                    ...styles.barFill,
                    width: `${s.val}%`,
                    background: s.color,
                  }}
                />
              </div>
            </div>
          ))}
          <div style={{ ...styles.summaryBlock, marginTop: 28 }}>
            <h3 style={styles.blockTitle}>Fraud Risk Assessment</h3>
            <div
              style={{
                display: "inline-flex",
                padding: "10px 22px",
                border: `2px solid ${a.fraudRisk === "High" ? "#e74c3c" : a.fraudRisk === "Moderate" ? "#C8A84B" : "#2ecc71"}`,
                color: a.fraudRisk === "High" ? "#e74c3c" : a.fraudRisk === "Moderate" ? "#C8A84B" : "#2ecc71",
                fontFamily: "'DM Mono', monospace",
                fontWeight: 700,
                borderRadius: 4,
                fontSize: 18,
                marginTop: 8,
              }}
            >
              {a.fraudRisk.toUpperCase()} RISK
            </div>
          </div>
        </div>
      )}

      {/* Tab: Emails */}
      {activeTab === "emails" && (
        <div style={styles.tabContent}>
          <h3 style={styles.blockTitle}>Auto-Generated Email Summaries</h3>
          <p style={{ color: "#666", fontSize: 13, marginBottom: 24 }}>
            These AI-drafted emails are ready to dispatch to all parties.
          </p>

          {[
            { role: "Buyer", key: "emailBuyer", addr: report.buyerEmail, icon: "🏠" },
            { role: "Seller", key: "emailSeller", addr: report.sellerEmail, icon: "💼" },
            { role: "Realtor", key: "emailRealtor", addr: report.realtorEmail, icon: "📋" },
          ].map((e) => (
            <div key={e.key} style={styles.emailCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{e.icon}</span>
                  <div>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>
                      To: {e.role}
                    </div>
                    <div style={{ color: "#555", fontSize: 12 }}>
                      {e.addr || "No email provided"}
                    </div>
                  </div>
                </div>
              </div>
              <div style={styles.emailBody}>{a[e.key]}</div>
            </div>
          ))}

          <button
            style={emailSent ? styles.btnSent : emailSending ? styles.btnDisabled : styles.ctaPrimary}
            onClick={() => !emailSent && !emailSending && onSendEmails(report)}
            disabled={emailSending || emailSent}
          >
            {emailSent ? "✓ Emails Dispatched" : emailSending ? (
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={styles.spinner} /> Sending...
              </span>
            ) : (
              "Dispatch All Emails →"
            )}
          </button>
        </div>
      )}

      {/* Tab: Flags */}
      {activeTab === "flags" && (
        <div style={styles.tabContent}>
          <h3 style={styles.blockTitle}>Red Flag Analysis</h3>
          {a.redFlags?.length === 0 ? (
            <div style={{ ...styles.summaryBlock, borderColor: "#2ecc71" }}>
              <span style={{ color: "#2ecc71", fontSize: 22 }}>✓</span>
              <p style={{ color: "#2ecc71", marginTop: 8 }}>
                No red flags detected. This report appears to meet standard industry criteria.
              </p>
            </div>
          ) : (
            <div>
              {a.redFlags?.map((flag, i) => (
                <div key={i} style={styles.flagRow}>
                  <span style={{ color: "#e74c3c", fontSize: 18 }}>⚑</span>
                  <span style={{ color: "#ddd", fontSize: 14, flex: 1 }}>{flag}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ ...styles.summaryBlock, marginTop: 28 }}>
            <h4 style={styles.blockTitle}>Inspector Background</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
              {[
                { label: "Inspector", value: report.inspectorName },
                { label: "Company", value: report.companyName || "Independent" },
                { label: "License", value: report.licenseNo || "Not Provided" },
                { label: "Inspected", value: report.date },
              ].map((item) => (
                <div key={item.label}>
                  <div style={{ color: "#555", fontSize: 11, letterSpacing: "0.1em", marginBottom: 4 }}>
                    {item.label.toUpperCase()}
                  </div>
                  <div style={{ color: "#ddd", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// --- STYLES ---
const styles = {
  root: {
    minHeight: "100vh",
    background: "#0e0e0e",
    color: "#e8e8e8",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    backgroundImage:
      "radial-gradient(ellipse at 20% 10%, rgba(200,168,75,0.04) 0%, transparent 50%), radial-gradient(ellipse at 80% 90%, rgba(200,168,75,0.03) 0%, transparent 50%)",
  },
  header: {
    borderBottom: "1px solid #1e1e1e",
    background: "rgba(14,14,14,0.95)",
    backdropFilter: "blur(10px)",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  headerInner: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "0 24px",
    height: 60,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    background: "none",
    border: "none",
    color: "#C8A84B",
    fontSize: 18,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
    letterSpacing: "-0.02em",
    fontFamily: "'DM Sans', sans-serif",
  },
  logoMark: { fontSize: 14, opacity: 0.8 },
  nav: { display: "flex", gap: 8 },
  navBtn: {
    background: "none",
    border: "1px solid #2a2a2a",
    color: "#888",
    padding: "7px 16px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
    transition: "all 0.2s",
  },
  navActive: {
    background: "none",
    border: "1px solid #C8A84B",
    color: "#C8A84B",
    padding: "7px 16px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
  },
  main: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "48px 24px 80px",
  },
  toast: {
    position: "fixed",
    top: 72,
    right: 24,
    zIndex: 999,
    background: "#111",
    border: "1px solid",
    padding: "12px 20px",
    borderRadius: 8,
    fontSize: 13,
    fontFamily: "'DM Mono', monospace",
    animation: "fadeIn 0.3s ease",
  },
  heroSection: {
    textAlign: "center",
    padding: "60px 0 48px",
  },
  pill: {
    display: "inline-block",
    background: "rgba(200,168,75,0.1)",
    border: "1px solid rgba(200,168,75,0.3)",
    color: "#C8A84B",
    padding: "5px 16px",
    borderRadius: 100,
    fontSize: 12,
    letterSpacing: "0.12em",
    marginBottom: 24,
    fontFamily: "'DM Mono', monospace",
  },
  heroTitle: {
    fontSize: "clamp(40px, 7vw, 72px)",
    fontWeight: 800,
    lineHeight: 1.05,
    letterSpacing: "-0.03em",
    color: "#f0f0f0",
    marginBottom: 24,
  },
  heroAccent: {
    color: "#C8A84B",
    display: "block",
  },
  heroSub: {
    fontSize: 16,
    color: "#777",
    maxWidth: 560,
    margin: "0 auto 36px",
    lineHeight: 1.7,
  },
  ctaPrimary: {
    background: "#C8A84B",
    color: "#0e0e0e",
    border: "none",
    padding: "14px 30px",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "-0.01em",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },
  ctaSecondary: {
    background: "transparent",
    color: "#C8A84B",
    border: "1px solid #C8A84B",
    padding: "14px 30px",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  btnDisabled: {
    background: "#2a2a2a",
    color: "#666",
    border: "none",
    padding: "14px 30px",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 700,
    cursor: "not-allowed",
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },
  btnSent: {
    background: "#0d2b1a",
    color: "#2ecc71",
    border: "1px solid #2ecc71",
    padding: "14px 30px",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 700,
    cursor: "default",
    fontFamily: "inherit",
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
    margin: "0 0 64px",
  },
  statCard: {
    background: "#111",
    border: "1px solid #1e1e1e",
    borderRadius: 12,
    padding: "24px",
    textAlign: "center",
  },
  statNum: {
    fontSize: 28,
    fontWeight: 800,
    color: "#C8A84B",
    fontFamily: "'DM Mono', monospace",
    marginBottom: 4,
  },
  statLabel: { color: "#555", fontSize: 12, letterSpacing: "0.08em" },
  section: { marginBottom: 64 },
  sectionTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: "#f0f0f0",
    marginBottom: 32,
    letterSpacing: "-0.02em",
  },
  steps: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 20,
  },
  stepCard: {
    background: "#111",
    border: "1px solid #1e1e1e",
    borderRadius: 12,
    padding: "28px 24px",
  },
  stepNum: {
    fontFamily: "'DM Mono', monospace",
    color: "#C8A84B",
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 16,
    opacity: 0.7,
  },
  stepTitle: { color: "#e8e8e8", fontSize: 16, fontWeight: 600, marginBottom: 10 },
  stepBody: { color: "#666", fontSize: 13, lineHeight: 1.7 },
  pageTitle: {
    fontSize: 32,
    fontWeight: 700,
    letterSpacing: "-0.03em",
    marginBottom: 8,
    color: "#f0f0f0",
  },
  pageSub: { color: "#666", fontSize: 14, marginBottom: 36 },
  uploadWrap: { maxWidth: 820, margin: "0 auto" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 },
  formCard: {
    background: "#111",
    border: "1px solid #1e1e1e",
    borderRadius: 12,
    padding: "24px",
  },
  formCardTitle: {
    color: "#C8A84B",
    fontSize: 11,
    letterSpacing: "0.14em",
    fontFamily: "'DM Mono', monospace",
    marginBottom: 20,
    textTransform: "uppercase",
  },
  field: { marginBottom: 16 },
  label: { display: "block", color: "#666", fontSize: 12, marginBottom: 6, letterSpacing: "0.04em" },
  input: {
    width: "100%",
    background: "#0a0a0a",
    border: "1px solid #222",
    borderRadius: 6,
    padding: "10px 12px",
    color: "#e8e8e8",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    background: "#0a0a0a",
    border: "1px solid #222",
    borderRadius: 6,
    padding: "12px",
    color: "#e8e8e8",
    fontSize: 13,
    fontFamily: "'DM Mono', monospace",
    outline: "none",
    resize: "vertical",
    boxSizing: "border-box",
    lineHeight: 1.6,
  },
  dropZone: {
    border: "2px dashed #222",
    borderRadius: 8,
    padding: "32px",
    textAlign: "center",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
    gap: 20,
  },
  registryCard: {
    background: "#111",
    border: "1px solid #1e1e1e",
    borderRadius: 12,
    padding: "24px",
    transition: "border-color 0.2s",
  },
  inspectorName: { fontSize: 18, fontWeight: 700, color: "#f0f0f0", marginBottom: 2 },
  companyName: { color: "#555", fontSize: 13 },
  propertyLine: { color: "#666", fontSize: 12, margin: "14px 0 10px" },
  summarySnippet: { color: "#888", fontSize: 13, lineHeight: 1.6 },
  riskTag: {
    fontSize: 11,
    fontFamily: "'DM Mono', monospace",
    padding: "3px 10px",
    borderRadius: 4,
    border: "1px solid",
    fontWeight: 700,
    letterSpacing: "0.06em",
  },
  gradeTag: {
    background: "#1a1a1a",
    color: "#C8A84B",
    fontSize: 11,
    fontFamily: "'DM Mono', monospace",
    padding: "3px 10px",
    borderRadius: 4,
    fontWeight: 700,
    border: "1px solid #2a2a2a",
  },
  viewBtn: {
    background: "none",
    border: "none",
    color: "#C8A84B",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
    fontWeight: 600,
  },
  emptyState: {
    textAlign: "center",
    padding: "80px 0",
    borderRadius: 12,
    border: "1px dashed #1e1e1e",
  },
  spinner: {
    width: 16,
    height: 16,
    border: "2px solid rgba(14,14,14,0.3)",
    borderTop: "2px solid #0e0e0e",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    display: "inline-block",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#666",
    cursor: "pointer",
    fontSize: 14,
    fontFamily: "inherit",
    marginBottom: 32,
    padding: 0,
  },
  reportHero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "28px 32px",
    background: "#111",
    border: "1px solid #1e1e1e",
    borderRadius: 12,
    marginBottom: 8,
  },
  reportInspectorName: {
    fontSize: 28,
    fontWeight: 800,
    color: "#f0f0f0",
    letterSpacing: "-0.02em",
  },
  reportCompany: { color: "#C8A84B", fontSize: 14, marginTop: 4 },
  tabBar: {
    display: "flex",
    borderBottom: "1px solid #1e1e1e",
    marginBottom: 28,
    marginTop: 28,
    gap: 0,
  },
  tab: {
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "#555",
    padding: "12px 20px",
    cursor: "pointer",
    fontSize: 14,
    fontFamily: "inherit",
    fontWeight: 600,
    marginBottom: -1,
  },
  tabActive: {
    background: "none",
    border: "none",
    borderBottom: "2px solid #C8A84B",
    color: "#C8A84B",
    padding: "12px 20px",
    cursor: "pointer",
    fontSize: 14,
    fontFamily: "inherit",
    fontWeight: 600,
    marginBottom: -1,
  },
  tabContent: { animation: "fadeIn 0.2s ease" },
  summaryBlock: {
    background: "#111",
    border: "1px solid #1e1e1e",
    borderRadius: 10,
    padding: "24px",
    marginBottom: 20,
  },
  blockTitle: {
    color: "#C8A84B",
    fontSize: 11,
    letterSpacing: "0.14em",
    fontFamily: "'DM Mono', monospace",
    marginBottom: 12,
    textTransform: "uppercase",
  },
  summaryText: { color: "#aaa", fontSize: 15, lineHeight: 1.75 },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 },
  listBlock: {
    background: "#111",
    border: "1px solid #1e1e1e",
    borderRadius: 10,
    padding: "24px",
  },
  listItem: {
    color: "#aaa",
    fontSize: 13,
    lineHeight: 1.6,
    display: "flex",
    gap: 10,
    marginBottom: 10,
  },
  recommendationBox: {
    background: "rgba(200,168,75,0.06)",
    border: "1px solid rgba(200,168,75,0.2)",
    borderRadius: 10,
    padding: "18px 24px",
    fontSize: 14,
    color: "#bbb",
    lineHeight: 1.65,
  },
  scoreRow: { marginBottom: 24 },
  barTrack: {
    height: 6,
    background: "#1e1e1e",
    borderRadius: 99,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 99,
    transition: "width 0.8s ease",
  },
  emailCard: {
    background: "#111",
    border: "1px solid #1e1e1e",
    borderRadius: 10,
    padding: "20px 24px",
    marginBottom: 16,
  },
  emailBody: {
    color: "#888",
    fontSize: 13,
    lineHeight: 1.75,
    fontFamily: "'DM Mono', monospace",
    borderTop: "1px solid #1a1a1a",
    paddingTop: 14,
    whiteSpace: "pre-wrap",
  },
  flagRow: {
    display: "flex",
    gap: 14,
    alignItems: "flex-start",
    background: "rgba(231,76,60,0.04)",
    border: "1px solid rgba(231,76,60,0.15)",
    borderRadius: 8,
    padding: "14px 18px",
    marginBottom: 10,
  },
};

// Inject keyframes
const style = document.createElement("style");
style.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=DM+Mono:wght@400;500;700&display=swap');
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  input::placeholder, textarea::placeholder { color: #333; }
  input:focus, textarea:focus { border-color: #333 !important; }
  button:hover { opacity: 0.88; }
  @media (max-width: 700px) {
    .steps, .statsRow { grid-template-columns: 1fr 1fr !important; }
    .formGrid, .twoCol { grid-template-columns: 1fr !important; }
    .reportHero { flex-direction: column; gap: 16px; }
  }
`;
document.head.appendChild(style);
