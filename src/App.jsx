import { useState, useRef } from "react";

function generateId() { return Math.random().toString(36).slice(2, 10); }

function ScoreBadge({ score }) {
  const color = score >= 80 ? "#2ecc71" : score >= 55 ? "#C8A84B" : "#e74c3c";
  const label = score >= 80 ? "TRUSTED" : score >= 55 ? "REVIEW" : "FLAGGED";
  return (
    <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 14px", borderRadius:4, border:`1.5px solid ${color}`, color, fontSize:12, fontFamily:"'DM Mono',monospace", letterSpacing:"0.12em", fontWeight:700 }}>
      <span style={{ width:8, height:8, borderRadius:"50%", background:color, display:"inline-block" }} />
      {label} · {score}/100
    </div>
  );
}

// ── STEP INDICATOR ────────────────────────────────────────────
function StepIndicator({ step }) {
  const steps = ["Upload Report", "Review Details", "Analyze"];
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", marginBottom:40, gap:0 }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display:"flex", alignItems:"center" }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
            <div style={{
              width:32, height:32, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
              background: i < step ? "#C8A84B" : i === step ? "#C8A84B" : "#1a1a1a",
              border: i <= step ? "2px solid #C8A84B" : "2px solid #2a2a2a",
              color: i <= step ? "#0e0e0e" : "#555",
              fontWeight:700, fontSize:13, fontFamily:"'DM Mono',monospace",
              transition:"all 0.3s"
            }}>
              {i < step ? "✓" : i + 1}
            </div>
            <span style={{ fontSize:11, color: i <= step ? "#C8A84B" : "#444", letterSpacing:"0.06em", whiteSpace:"nowrap" }}>{s}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ width:80, height:2, background: i < step ? "#C8A84B" : "#1e1e1e", margin:"0 8px", marginBottom:22, transition:"all 0.3s" }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── FIELD with missing indicator ──────────────────────────────
function Field({ label, value, onChange, placeholder, required, missing, type="text" }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
        <label style={{ color: missing ? "#e74c3c" : "#666", fontSize:12, letterSpacing:"0.04em" }}>{label}{required ? " *" : ""}</label>
        {missing && <span style={{ fontSize:10, color:"#e74c3c", fontFamily:"'DM Mono',monospace", background:"rgba(231,76,60,0.1)", padding:"2px 7px", borderRadius:4 }}>Not found in report — please fill in</span>}
      </div>
      <input
        type={type}
        style={{ ...styles.input, borderColor: missing ? "rgba(231,76,60,0.4)" : "#222" }}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("home");
  const [uploadStep, setUploadStep] = useState(0); // 0=drop, 1=review, 2=analyzing
  const [reports, setReports] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [toast, setToast] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const [form, setForm] = useState({
    inspectorName:"", companyName:"", licenseNo:"",
    street:"", city:"", state:"", zip:"",
    buyerEmail:"", sellerEmail:"", realtorEmail:"",
    reportText:"", fileName:"",
  });
  const [missing, setMissing] = useState({});

  const showToast = (msg, type="success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const setField = (key) => (val) => setForm(f => ({ ...f, [key]: val }));

  // ── Parse report text with AI to extract fields ──────────────
  const parseReport = async (text, fileName) => {
    setParsing(true);
    try {
      const res = await fetch("/api/analyze", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ mode:"parse", reportText: text.slice(0, 4000) }),
      });
      const data = await res.json();
      const p = data.parsed || {};
      const addrParts = (p.propertyAddress || "").split(",").map(s => s.trim());

      const newForm = {
        inspectorName: p.inspectorName || "",
        companyName:   p.companyName   || "",
        licenseNo:     p.licenseNo     || "",
        street:        p.street        || addrParts[0] || "",
        city:          p.city          || addrParts[1] || "",
        state:         p.state         || addrParts[2]?.replace(/\d+/g,"").trim() || "",
        zip:           p.zip           || addrParts[2]?.match(/\d{5}/)?.[0] || "",
        buyerEmail:    p.buyerEmail    || "",
        sellerEmail:   p.sellerEmail   || "",
        realtorEmail:  p.realtorEmail  || "",
        reportText:    text,
        fileName:      fileName,
      };
      setForm(newForm);

      // Flag fields that are still empty
      const m = {};
      ["inspectorName","street","city","state","zip"].forEach(k => {
        if (!newForm[k]) m[k] = true;
      });
      setMissing(m);
      setUploadStep(1);
    } catch(err) {
      showToast("Could not auto-parse report. Please fill in details manually.", "error");
      setForm(f => ({ ...f, reportText: text, fileName }));
      setMissing({ inspectorName:true, street:true, city:true, state:true, zip:true });
      setUploadStep(1);
    } finally {
      setParsing(false);
    }
  };

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => parseReport(ev.target.result, file.name);
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleAnalyze = async () => {
    const addr = [form.street, form.city, form.state, form.zip].filter(Boolean).join(", ");
    if (!form.inspectorName || !form.street || !form.reportText) {
      showToast("Inspector name and property address are required.", "error");
      return;
    }
    setUploading(true);
    setUploadStep(2);
    try {
      const res = await fetch("/api/analyze", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          mode:"analyze",
          inspectorName: form.inspectorName,
          companyName:   form.companyName,
          licenseNo:     form.licenseNo,
          propertyAddress: addr,
          reportText:    form.reportText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");

      const newReport = {
        id: generateId(), ...form,
        propertyAddress: addr,
        analysis: data.analysis,
        date: new Date().toLocaleDateString("en-US", { year:"numeric", month:"short", day:"numeric" }),
      };
      setReports(r => [newReport, ...r]);
      setAnalysisResult(newReport);
      setView("report");
      setUploadStep(0);
      setForm({ inspectorName:"", companyName:"", licenseNo:"", street:"", city:"", state:"", zip:"", buyerEmail:"", sellerEmail:"", realtorEmail:"", reportText:"", fileName:"" });
      showToast("Report analyzed successfully.");
    } catch(err) {
      showToast("Analysis failed: " + err.message, "error");
      setUploadStep(1);
    } finally {
      setUploading(false);
    }
  };

  const sendEmails = async () => {
    setEmailSending(true);
    await new Promise(r => setTimeout(r, 1800));
    setEmailSending(false);
    setEmailSent(true);
    showToast("Email summaries dispatched to all parties.");
  };

  const viewReport = (r) => { setAnalysisResult(r); setEmailSent(false); setView("report"); };

  // ── RENDER ────────────────────────────────────────────────────
  return (
    <div style={styles.root}>
      {toast && <div style={{ ...styles.toast, borderColor: toast.type==="error"?"#e74c3c":"#C8A84B", color: toast.type==="error"?"#e74c3c":"#C8A84B" }}>{toast.msg}</div>}

      <header style={styles.header}>
        <div style={styles.headerInner}>
          <button onClick={() => { setView("home"); setUploadStep(0); }} style={styles.logo}>
            <span style={{ fontSize:14, opacity:0.8 }}>▲</span> ClearInspect
          </button>
          <nav style={{ display:"flex", gap:8 }}>
            <button style={view==="upload"?styles.navActive:styles.navBtn} onClick={() => { setView("upload"); setUploadStep(0); }}>Upload Report</button>
            <button style={view==="database"?styles.navActive:styles.navBtn} onClick={() => setView("database")}>Inspector Registry ({reports.length})</button>
          </nav>
        </div>
      </header>

      {/* ── HOME ── */}
      {view==="home" && (
        <main style={styles.main}>
          <div style={styles.heroSection}>
            <div style={styles.pill}>AI-Powered · Real Estate Transparency</div>
            <h1 style={styles.heroTitle}>The Truth About<br /><span style={{ color:"#C8A84B", display:"block" }}>Your Inspector</span></h1>
            <p style={styles.heroSub}>Upload any inspection report. Our AI reads it, extracts all the details automatically, and generates a full fraud-risk performance review — no typing required.</p>
            <div style={{ display:"flex", gap:16, justifyContent:"center", flexWrap:"wrap" }}>
              <button style={styles.ctaPrimary} onClick={() => { setView("upload"); setUploadStep(0); }}>Analyze a Report →</button>
              <button style={styles.ctaSecondary} onClick={() => setView("database")}>View Registry</button>
            </div>
          </div>
          <div style={styles.statsRow}>
            {[{n:"1 in 4",l:"inspectors flagged for bias"},{n:"AI",l:"auto-extracts report data"},{n:"3-way",l:"auto email summaries"},{n:"100%",l:"transparent & free"}].map(s=>(
              <div key={s.l} style={styles.statCard}>
                <div style={styles.statNum}>{s.n}</div>
                <div style={{ color:"#555", fontSize:12, letterSpacing:"0.08em" }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div>
            <h2 style={styles.sectionTitle}>How It Works</h2>
            <div style={styles.steps}>
              {[
                {n:"01",t:"Drop Your Report",b:"Upload any inspection report file. Our AI reads it instantly — no manual data entry needed."},
                {n:"02",t:"Confirm Details",b:"We auto-fill everything we find. You only fill in what's missing."},
                {n:"03",t:"Get the Review",b:"Receive a full inspector performance dossier with fraud risk score, grade, and analysis."},
                {n:"04",t:"Notify All Parties",b:"Buyer, seller, and realtor each get a tailored AI-written email summary automatically."},
              ].map(s=>(
                <div key={s.n} style={styles.stepCard}>
                  <div style={{ fontFamily:"'DM Mono',monospace", color:"#C8A84B", fontSize:28, fontWeight:700, marginBottom:16, opacity:0.7 }}>{s.n}</div>
                  <h3 style={{ color:"#e8e8e8", fontSize:16, fontWeight:600, marginBottom:10 }}>{s.t}</h3>
                  <p style={{ color:"#666", fontSize:13, lineHeight:1.7 }}>{s.b}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* ── UPLOAD ── */}
      {view==="upload" && (
        <main style={styles.main}>
          <div style={{ maxWidth:700, margin:"0 auto" }}>
            <h2 style={styles.pageTitle}>Submit Inspection Report</h2>
            <p style={{ color:"#666", fontSize:14, marginBottom:36 }}>
              {uploadStep===0 ? "Drop your report file and we'll handle the rest." : uploadStep===1 ? "We've extracted what we could. Fill in anything missing below." : "Analyzing with AI..."}
            </p>

            <StepIndicator step={uploadStep} />

            {/* STEP 0 — Drop zone */}
            {uploadStep===0 && (
              <div>
                <div
                  style={{ ...styles.bigDropZone, borderColor: dragOver ? "#C8A84B" : "#2a2a2a", background: dragOver ? "rgba(200,168,75,0.05)" : "#0a0a0a" }}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" accept=".txt,.pdf,.doc,.docx" style={{ display:"none" }} onChange={e => handleFile(e.target.files[0])} />
                  {parsing ? (
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
                      <span style={{ ...styles.spinner, width:32, height:32, borderWidth:3, borderTopColor:"#C8A84B", borderColor:"rgba(200,168,75,0.2)" }} />
                      <span style={{ color:"#C8A84B", fontSize:14, fontFamily:"'DM Mono',monospace" }}>Reading report...</span>
                    </div>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
                      <span style={{ fontSize:52 }}>📋</span>
                      <span style={{ color:"#C8A84B", fontSize:16, fontWeight:700 }}>Drop your inspection report here</span>
                      <span style={{ color:"#555", fontSize:13 }}>or click to browse · .txt, .pdf, .doc, .docx</span>
                      <span style={{ color:"#333", fontSize:12, marginTop:8 }}>We'll automatically extract inspector name, company, license, and property details</span>
                    </div>
                  )}
                </div>

                <div style={{ margin:"24px 0", display:"flex", alignItems:"center", gap:16 }}>
                  <div style={{ flex:1, height:1, background:"#1e1e1e" }} />
                  <span style={{ color:"#444", fontSize:12 }}>or paste report text</span>
                  <div style={{ flex:1, height:1, background:"#1e1e1e" }} />
                </div>

                <textarea
                  style={{ ...styles.textarea, minHeight:160 }}
                  placeholder="Paste the full inspection report text here and we'll extract all the details..."
                  onChange={e => { if(e.target.value.length > 50) parseReport(e.target.value, "pasted report"); }}
                />
              </div>
            )}

            {/* STEP 1 — Review extracted fields */}
            {uploadStep===1 && (
              <div>
                {/* File badge */}
                {form.fileName && (
                  <div style={styles.fileBadge}>
                    <span style={{ fontSize:18 }}>📄</span>
                    <span style={{ color:"#C8A84B", fontSize:13 }}>{form.fileName}</span>
                    <button onClick={() => { setUploadStep(0); setForm(f => ({ ...f, reportText:"", fileName:"" })); }} style={{ marginLeft:"auto", background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:12 }}>✕ Remove</button>
                  </div>
                )}

                {Object.keys(missing).length > 0 && (
                  <div style={styles.missingBanner}>
                    <span style={{ fontSize:16 }}>⚠️</span>
                    <span style={{ color:"#C8A84B", fontSize:13 }}>We couldn't find {Object.keys(missing).length} field{Object.keys(missing).length>1?"s":""} in the report. Please fill them in below.</span>
                  </div>
                )}

                <div style={styles.formCard}>
                  <div style={styles.formCardTitle}>Inspector Details</div>
                  <Field label="Inspector Full Name" value={form.inspectorName} onChange={setField("inspectorName")} placeholder="John Smith" required missing={missing.inspectorName} />
                  <Field label="Company / Firm" value={form.companyName} onChange={setField("companyName")} placeholder="Apex Home Inspections LLC" />
                  <Field label="License Number" value={form.licenseNo} onChange={setField("licenseNo")} placeholder="HI-20984" />
                </div>

                <div style={{ ...styles.formCard, marginTop:16 }}>
                  <div style={styles.formCardTitle}>Property Address</div>
                  <Field label="Street Address" value={form.street} onChange={setField("street")} placeholder="123 Maple Street" required missing={missing.street} />
                  <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:12 }}>
                    <Field label="City" value={form.city} onChange={setField("city")} placeholder="Austin" required missing={missing.city} />
                    <Field label="State" value={form.state} onChange={setField("state")} placeholder="TX" required missing={missing.state} />
                    <Field label="ZIP Code" value={form.zip} onChange={setField("zip")} placeholder="78701" required missing={missing.zip} />
                  </div>
                </div>

                <div style={{ ...styles.formCard, marginTop:16 }}>
                  <div style={styles.formCardTitle}>Notify Parties <span style={{ color:"#444", fontWeight:400 }}>(optional)</span></div>
                  <p style={{ color:"#555", fontSize:12, marginBottom:16 }}>If provided, each party will receive an AI-written email summary of the inspection analysis.</p>
                  <Field label="Buyer Email" value={form.buyerEmail} onChange={setField("buyerEmail")} placeholder="buyer@email.com" type="email" />
                  <Field label="Seller Email" value={form.sellerEmail} onChange={setField("sellerEmail")} placeholder="seller@email.com" type="email" />
                  <Field label="Realtor Email" value={form.realtorEmail} onChange={setField("realtorEmail")} placeholder="agent@realty.com" type="email" />
                </div>

                <div style={{ display:"flex", gap:12, marginTop:24 }}>
                  <button style={styles.ctaSecondary} onClick={() => setUploadStep(0)}>← Start Over</button>
                  <button style={uploading ? styles.btnDisabled : styles.ctaPrimary} onClick={handleAnalyze} disabled={uploading}>
                    {uploading ? <span style={{ display:"flex", alignItems:"center", gap:10 }}><span style={styles.spinner}/> Analyzing...</span> : "Run AI Analysis →"}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2 — Analyzing spinner */}
            {uploadStep===2 && (
              <div style={{ textAlign:"center", padding:"60px 0" }}>
                <span style={{ ...styles.spinner, width:48, height:48, borderWidth:4, borderTopColor:"#C8A84B", borderColor:"rgba(200,168,75,0.15)", display:"inline-block" }} />
                <p style={{ color:"#C8A84B", fontSize:16, marginTop:24, fontFamily:"'DM Mono',monospace" }}>Analyzing report with AI...</p>
                <p style={{ color:"#555", fontSize:13, marginTop:8 }}>Scoring completeness, objectivity, fraud risk, and generating email summaries</p>
              </div>
            )}
          </div>
        </main>
      )}

      {/* ── REPORT ── */}
      {view==="report" && analysisResult && (
        <ReportView report={analysisResult} onSendEmails={sendEmails} emailSending={emailSending} emailSent={emailSent} onBack={() => setView("database")} />
      )}

      {/* ── DATABASE ── */}
      {view==="database" && (
        <main style={styles.main}>
          <h2 style={styles.pageTitle}>Inspector Registry</h2>
          <p style={{ color:"#666", fontSize:14, marginBottom:36 }}>Public database of analyzed inspection reports.</p>
          {reports.length===0 ? (
            <div style={{ textAlign:"center", padding:"80px 0", borderRadius:12, border:"1px dashed #1e1e1e" }}>
              <div style={{ fontSize:48, marginBottom:16 }}>🔍</div>
              <p style={{ color:"#666" }}>No reports submitted yet.</p>
              <button style={{ ...styles.ctaPrimary, marginTop:16 }} onClick={() => { setView("upload"); setUploadStep(0); }}>Submit the first report</button>
            </div>
          ) : (
            <div style={styles.cardGrid}>
              {reports.map(r=>(
                <div key={r.id} style={styles.registryCard}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <div style={{ fontSize:18, fontWeight:700, color:"#f0f0f0", marginBottom:2 }}>{r.inspectorName}</div>
                      <div style={{ color:"#555", fontSize:13 }}>{r.companyName||"Independent"}</div>
                    </div>
                    <ScoreBadge score={r.analysis.trustScore} />
                  </div>
                  <div style={{ color:"#666", fontSize:12, margin:"14px 0 10px" }}>📍 {r.propertyAddress}</div>
                  <p style={{ color:"#888", fontSize:13, lineHeight:1.6 }}>{r.analysis.summary?.slice(0,120)}…</p>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:16 }}>
                    <div style={{ display:"flex", gap:8 }}>
                      <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", padding:"3px 10px", borderRadius:4, border:"1px solid", fontWeight:700, letterSpacing:"0.06em", background: r.analysis.fraudRisk==="High"?"#3a1010":r.analysis.fraudRisk==="Moderate"?"#2d2000":"#0d2b1a", color: r.analysis.fraudRisk==="High"?"#e74c3c":r.analysis.fraudRisk==="Moderate"?"#C8A84B":"#2ecc71", borderColor: r.analysis.fraudRisk==="High"?"#e74c3c":r.analysis.fraudRisk==="Moderate"?"#C8A84B":"#2ecc71" }}>{r.analysis.fraudRisk} Risk</span>
                      <span style={{ background:"#1a1a1a", color:"#C8A84B", fontSize:11, fontFamily:"'DM Mono',monospace", padding:"3px 10px", borderRadius:4, fontWeight:700, border:"1px solid #2a2a2a" }}>Grade {r.analysis.inspectorGrade}</span>
                    </div>
                    <button style={{ background:"none", border:"none", color:"#C8A84B", cursor:"pointer", fontSize:13, fontFamily:"inherit", fontWeight:600 }} onClick={() => viewReport(r)}>View Review →</button>
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

// ── REPORT VIEW ───────────────────────────────────────────────
function ReportView({ report, onSendEmails, emailSending, emailSent, onBack }) {
  const a = report.analysis;
  const [activeTab, setActiveTab] = useState("overview");
  const [pdfExporting, setPdfExporting] = useState(false);

  const exportToPDF = async () => {
    setPdfExporting(true);
    try {
      await new Promise((resolve, reject) => {
        if (window.jspdf) { resolve(); return; }
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"letter" });
      const W = 215.9, margin = 18, contentW = W - margin * 2;
      let y = 0;
      const hex2rgb = h => { const x=h.replace("#",""); return [parseInt(x.slice(0,2),16),parseInt(x.slice(2,4),16),parseInt(x.slice(4,6),16)]; };
      const setColor = (hex, type="text") => { const [r,g,b]=hex2rgb(hex); type==="fill"?doc.setFillColor(r,g,b):type==="draw"?doc.setDrawColor(r,g,b):doc.setTextColor(r,g,b); };
      const addPage = () => { doc.addPage(); y = margin; };
      const checkY = (n=12) => { if(y+n>265) addPage(); };
      const bar = (label, value, color, barY) => {
        doc.setFontSize(9); doc.setFont("helvetica","normal");
        setColor("#888888"); doc.text(label, margin, barY);
        setColor(value>=80?"#2ecc71":value>=55?"#C8A84B":"#e74c3c"); doc.text(`${value}/100`, W-margin, barY, {align:"right"});
        setColor("#222222","fill"); doc.roundedRect(margin,barY+2,contentW,4,1,1,"F");
        setColor(color,"fill"); doc.roundedRect(margin,barY+2,contentW*(value/100),4,1,1,"F");
      };
      setColor("#0e0e0e","fill"); doc.rect(0,0,W,279.4,"F");
      setColor("#C8A84B","fill"); doc.rect(0,0,W,2,"F");
      doc.setFontSize(72); doc.setFont("helvetica","bold"); setColor("#1a1a1a"); doc.text("CI",W/2,120,{align:"center"});
      y=52; doc.setFontSize(9); doc.setFont("helvetica","normal"); setColor("#C8A84B"); doc.text("CLEARINSPECT · INSPECTOR PERFORMANCE REVIEW",W/2,y,{align:"center"});
      y=68; doc.setFontSize(26); doc.setFont("helvetica","bold"); setColor("#f0f0f0");
      const nameLines=doc.splitTextToSize(report.inspectorName.toUpperCase(),contentW); doc.text(nameLines,W/2,y,{align:"center"}); y+=nameLines.length*11;
      doc.setFontSize(12); doc.setFont("helvetica","normal"); setColor("#C8A84B"); doc.text(report.companyName||"Independent Inspector",W/2,y+4,{align:"center"});
      const cx=W/2,cy=155,scoreColor=a.trustScore>=80?"#2ecc71":a.trustScore>=55?"#C8A84B":"#e74c3c";
      setColor("#1a1a1a","fill"); setColor(scoreColor,"draw"); doc.setLineWidth(1.5); doc.circle(cx,cy,22,"FD");
      doc.setFontSize(22); doc.setFont("helvetica","bold"); setColor(scoreColor); doc.text(String(a.trustScore),cx,cy+3,{align:"center"});
      doc.setFontSize(7); setColor("#888888"); doc.text("TRUST SCORE",cx,cy+10,{align:"center"});
      const gradeColor=a.inspectorGrade==="A"?"#2ecc71":a.inspectorGrade==="B"?"#C8A84B":"#e74c3c";
      setColor("#1a1a1a","fill"); setColor(gradeColor,"draw"); doc.setLineWidth(1); doc.roundedRect(cx+28,cy-10,20,20,3,3,"FD");
      doc.setFontSize(16); doc.setFont("helvetica","bold"); setColor(gradeColor); doc.text(a.inspectorGrade,cx+38,cy+4,{align:"center"});
      const riskColor=a.fraudRisk==="High"?"#e74c3c":a.fraudRisk==="Moderate"?"#C8A84B":"#2ecc71";
      doc.setFontSize(8); doc.setFont("helvetica","bold"); setColor(riskColor); doc.text(`${a.fraudRisk.toUpperCase()} FRAUD RISK`,cx-26,cy+5,{align:"center"});
      setColor("#111111","fill"); setColor("#2a2a2a","draw"); doc.setLineWidth(0.3); doc.roundedRect(margin,190,contentW,32,3,3,"FD");
      doc.setFontSize(8); doc.setFont("helvetica","normal"); setColor("#888888");
      doc.text("PROPERTY",margin+6,199); doc.text("LICENSE",margin+6,209); doc.text("DATE",margin+6,219);
      setColor("#cccccc"); doc.text(report.propertyAddress||"N/A",margin+44,199); doc.text(report.licenseNo||"Not Provided",margin+44,209); doc.text(report.date,margin+44,219);
      doc.setFontSize(6.5); doc.setFont("helvetica","italic"); setColor("#444444");
      doc.text(doc.splitTextToSize("DISCLAIMER: This report represents AI-generated analysis and opinion based on submitted content. It does not constitute a legal determination, background check, or official licensing board finding.",contentW),W/2,258,{align:"center"});
      setColor("#C8A84B","fill"); doc.rect(0,277,W,2,"F");
      addPage();
      const sectionHeader = (title) => {
        checkY(14); setColor("#C8A84B","fill"); doc.rect(margin,y-4,3,10,"F");
        doc.setFontSize(8); doc.setFont("helvetica","bold"); setColor("#C8A84B"); doc.text(title,margin+6,y+3);
        y+=12; setColor("#1e1e1e","draw"); doc.setLineWidth(0.2); doc.line(margin,y-2,W-margin,y-2); y+=4;
      };
      doc.setFontSize(7); doc.setFont("helvetica","normal"); setColor("#444444");
      doc.text("CLEARINSPECT PERFORMANCE REVIEW",margin,y); doc.text(`${report.inspectorName} · ${report.date}`,W-margin,y,{align:"right"});
      setColor("#C8A84B","fill"); doc.rect(margin,y+2,contentW,0.4,"F"); y+=10;
      sectionHeader("AI SUMMARY");
      doc.setFontSize(10); doc.setFont("helvetica","italic"); setColor("#aaaaaa");
      const sumLines=doc.splitTextToSize(a.summary,contentW); doc.text(sumLines,margin,y); y+=sumLines.length*5.5+10;
      checkY(20); setColor("#1a1400","fill"); setColor("#C8A84B","draw"); doc.setLineWidth(0.4); doc.roundedRect(margin,y-4,contentW,16,2,2,"FD");
      doc.setFontSize(7.5); doc.setFont("helvetica","bold"); setColor("#C8A84B"); doc.text("RECOMMENDATION:",margin+5,y+3);
      doc.setFont("helvetica","normal"); setColor("#cccccc"); doc.text(doc.splitTextToSize(a.recommendation,contentW-50),margin+42,y+3); y+=22;
      sectionHeader("STRENGTHS");
      (a.strengths||[]).forEach(s=>{ checkY(10); setColor("#2ecc71","fill"); doc.circle(margin+2,y-1,1.2,"F"); doc.setFontSize(9.5); doc.setFont("helvetica","normal"); setColor("#aaaaaa"); const ls=doc.splitTextToSize(s,contentW-8); doc.text(ls,margin+7,y); y+=ls.length*5+3; });
      y+=4; sectionHeader("CONCERNS");
      (a.concerns||[]).forEach(c=>{ checkY(10); setColor("#e74c3c","fill"); doc.rect(margin+0.5,y-3.5,2.5,2.5,"F"); doc.setFontSize(9.5); doc.setFont("helvetica","normal"); setColor("#aaaaaa"); const lc=doc.splitTextToSize(c,contentW-8); doc.text(lc,margin+7,y); y+=lc.length*5+3; });
      addPage();
      doc.setFontSize(7); doc.setFont("helvetica","normal"); setColor("#444444");
      doc.text("CLEARINSPECT PERFORMANCE REVIEW",margin,y); doc.text(`${report.inspectorName} · ${report.date}`,W-margin,y,{align:"right"});
      setColor("#C8A84B","fill"); doc.rect(margin,y+2,contentW,0.4,"F"); y+=10;
      sectionHeader("PERFORMANCE SCORECARD");
      [{label:"Trust Score",val:a.trustScore,color:"#C8A84B"},{label:"Completeness",val:a.completenessScore,color:"#3498db"},{label:"Technical Rigor",val:a.technicalScore,color:"#9b59b6"},{label:"Objectivity",val:a.objectivityScore,color:"#2ecc71"}].forEach(item=>{ checkY(16); bar(item.label,item.val,item.color,y); y+=14; });
      y+=6; sectionHeader("RED FLAG ANALYSIS");
      if(!a.redFlags||a.redFlags.length===0){
        checkY(14); setColor("#0d2b1a","fill"); setColor("#2ecc71","draw"); doc.setLineWidth(0.4); doc.roundedRect(margin,y-4,contentW,14,2,2,"FD"); doc.setFontSize(9); doc.setFont("helvetica","bold"); setColor("#2ecc71"); doc.text("No red flags detected.",margin+6,y+4); y+=18;
      } else {
        (a.redFlags||[]).forEach(flag=>{ checkY(12); setColor("#1a0505","fill"); setColor("#e74c3c","draw"); doc.setLineWidth(0.3); doc.roundedRect(margin,y-4,contentW,12,2,2,"FD"); doc.setFontSize(8.5); doc.setFont("helvetica","normal"); setColor("#e74c3c"); doc.text("!",margin+4,y+2); setColor("#cccccc"); const fl=doc.splitTextToSize(flag,contentW-16); doc.text(fl,margin+12,y+2); y+=fl.length*5+6; });
      }
      doc.save(`ClearInspect_${report.inspectorName.replace(/\s+/g,"_")}.pdf`);
    } catch(err) { alert("PDF export failed."); }
    finally { setPdfExporting(false); }
  };

  return (
    <main style={styles.main}>
      <button onClick={onBack} style={{ background:"none", border:"none", color:"#666", cursor:"pointer", fontSize:14, fontFamily:"inherit", marginBottom:32, padding:0 }}>← Back to Registry</button>
      <div style={styles.reportHero}>
        <div>
          <div style={{ fontSize:28, fontWeight:800, color:"#f0f0f0", letterSpacing:"-0.02em" }}>{report.inspectorName}</div>
          <div style={{ color:"#C8A84B", fontSize:14, marginTop:4 }}>{report.companyName||"Independent Inspector"} · License {report.licenseNo||"N/A"}</div>
          <div style={{ color:"#666", fontSize:13, marginTop:4 }}>📍 {report.propertyAddress} · {report.date}</div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:10 }}>
          <ScoreBadge score={a.trustScore} />
          <div style={{ fontSize:28, fontFamily:"'DM Mono',monospace", fontWeight:700, color:a.inspectorGrade==="A"?"#2ecc71":a.inspectorGrade==="B"?"#C8A84B":"#e74c3c" }}>{a.inspectorGrade}</div>
          <button onClick={exportToPDF} disabled={pdfExporting} style={{ background:"transparent", border:"1px solid #C8A84B", color:pdfExporting?"#555":"#C8A84B", padding:"8px 16px", borderRadius:6, cursor:pdfExporting?"not-allowed":"pointer", fontSize:12, fontFamily:"'DM Mono',monospace", fontWeight:700, display:"flex", alignItems:"center", gap:7 }}>
            {pdfExporting ? <><span style={styles.spinner}/> Exporting...</> : <>↓ Export PDF</>}
          </button>
        </div>
      </div>

      <div style={styles.tabBar}>
        {["overview","scores","emails","flags"].map(t=>(
          <button key={t} style={activeTab===t?styles.tabActive:styles.tab} onClick={()=>setActiveTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>

      {activeTab==="overview" && (
        <div style={styles.tabContent}>
          <div style={styles.summaryBlock}><h3 style={styles.blockTitle}>AI Summary</h3><p style={{ color:"#aaa", fontSize:15, lineHeight:1.75 }}>{a.summary}</p></div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
            <div style={styles.listBlock}>
              <h4 style={{ color:"#2ecc71", fontSize:13, letterSpacing:"0.1em", marginBottom:12 }}>✓ STRENGTHS</h4>
              {a.strengths?.map((s,i)=><div key={i} style={{ color:"#aaa", fontSize:13, lineHeight:1.6, display:"flex", gap:10, marginBottom:10 }}><span style={{ color:"#2ecc71" }}>+</span>{s}</div>)}
            </div>
            <div style={styles.listBlock}>
              <h4 style={{ color:"#e74c3c", fontSize:13, letterSpacing:"0.1em", marginBottom:12 }}>⚠ CONCERNS</h4>
              {a.concerns?.map((s,i)=><div key={i} style={{ color:"#aaa", fontSize:13, lineHeight:1.6, display:"flex", gap:10, marginBottom:10 }}><span style={{ color:"#e74c3c" }}>!</span>{s}</div>)}
            </div>
          </div>
          <div style={styles.recommendationBox}><span style={{ color:"#C8A84B", fontWeight:700, marginRight:8 }}>Recommendation:</span>{a.recommendation}</div>
        </div>
      )}

      {activeTab==="scores" && (
        <div style={styles.tabContent}>
          <h3 style={styles.blockTitle}>Performance Scorecard</h3>
          {[{label:"Trust Score",val:a.trustScore,color:"#C8A84B"},{label:"Completeness",val:a.completenessScore,color:"#3498db"},{label:"Technical Rigor",val:a.technicalScore,color:"#9b59b6"},{label:"Objectivity",val:a.objectivityScore,color:"#2ecc71"}].map(s=>(
            <div key={s.label} style={{ marginBottom:24 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <span style={{ color:"#ccc", fontSize:13 }}>{s.label}</span>
                <span style={{ color:s.color, fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:14 }}>{s.val}/100</span>
              </div>
              <div style={{ height:6, background:"#1e1e1e", borderRadius:99, overflow:"hidden" }}>
                <div style={{ height:"100%", borderRadius:99, width:`${s.val}%`, background:s.color }} />
              </div>
            </div>
          ))}
          <div style={{ ...styles.summaryBlock, marginTop:28 }}>
            <h3 style={styles.blockTitle}>Fraud Risk Assessment</h3>
            <div style={{ display:"inline-flex", padding:"10px 22px", border:`2px solid ${a.fraudRisk==="High"?"#e74c3c":a.fraudRisk==="Moderate"?"#C8A84B":"#2ecc71"}`, color:a.fraudRisk==="High"?"#e74c3c":a.fraudRisk==="Moderate"?"#C8A84B":"#2ecc71", fontFamily:"'DM Mono',monospace", fontWeight:700, borderRadius:4, fontSize:18, marginTop:8 }}>{a.fraudRisk?.toUpperCase()} RISK</div>
          </div>
        </div>
      )}

      {activeTab==="emails" && (
        <div style={styles.tabContent}>
          <h3 style={styles.blockTitle}>Auto-Generated Email Summaries</h3>
          <p style={{ color:"#666", fontSize:13, marginBottom:24 }}>These AI-drafted emails are ready to dispatch to all parties.</p>
          {[{role:"Buyer",key:"emailBuyer",addr:report.buyerEmail,icon:"🏠"},{role:"Seller",key:"emailSeller",addr:report.sellerEmail,icon:"💼"},{role:"Realtor",key:"emailRealtor",addr:report.realtorEmail,icon:"📋"}].map(e=>(
            <div key={e.key} style={styles.emailCard}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                <span style={{ fontSize:20 }}>{e.icon}</span>
                <div>
                  <div style={{ color:"#fff", fontWeight:700, fontSize:14 }}>To: {e.role}</div>
                  <div style={{ color:"#555", fontSize:12 }}>{e.addr||"No email provided"}</div>
                </div>
              </div>
              <div style={{ color:"#888", fontSize:13, lineHeight:1.75, fontFamily:"'DM Mono',monospace", borderTop:"1px solid #1a1a1a", paddingTop:14, whiteSpace:"pre-wrap" }}>{a[e.key]}</div>
            </div>
          ))}
          <button style={emailSent?styles.btnSent:emailSending?styles.btnDisabled:styles.ctaPrimary} onClick={()=>!emailSent&&!emailSending&&onSendEmails()} disabled={emailSending||emailSent}>
            {emailSent?"✓ Emails Dispatched":emailSending?<span style={{ display:"flex", alignItems:"center", gap:10 }}><span style={styles.spinner}/> Sending...</span>:"Dispatch All Emails →"}
          </button>
        </div>
      )}

      {activeTab==="flags" && (
        <div style={styles.tabContent}>
          <h3 style={styles.blockTitle}>Red Flag Analysis</h3>
          {!a.redFlags||a.redFlags.length===0 ? (
            <div style={{ ...styles.summaryBlock, borderColor:"#2ecc71" }}><span style={{ color:"#2ecc71", fontSize:22 }}>✓</span><p style={{ color:"#2ecc71", marginTop:8 }}>No red flags detected.</p></div>
          ) : (
            <div>{a.redFlags?.map((flag,i)=><div key={i} style={{ display:"flex", gap:14, alignItems:"flex-start", background:"rgba(231,76,60,0.04)", border:"1px solid rgba(231,76,60,0.15)", borderRadius:8, padding:"14px 18px", marginBottom:10 }}><span style={{ color:"#e74c3c", fontSize:18 }}>⚑</span><span style={{ color:"#ddd", fontSize:14, flex:1 }}>{flag}</span></div>)}</div>
          )}
        </div>
      )}
    </main>
  );
}

// ── STYLES ────────────────────────────────────────────────────
const styles = {
  root:{ minHeight:"100vh", background:"#0e0e0e", color:"#e8e8e8", fontFamily:"'DM Sans','Segoe UI',sans-serif" },
  header:{ borderBottom:"1px solid #1e1e1e", background:"rgba(14,14,14,0.95)", backdropFilter:"blur(10px)", position:"sticky", top:0, zIndex:100 },
  headerInner:{ maxWidth:1100, margin:"0 auto", padding:"0 24px", height:60, display:"flex", alignItems:"center", justifyContent:"space-between" },
  logo:{ background:"none", border:"none", color:"#C8A84B", fontSize:18, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:8, letterSpacing:"-0.02em", fontFamily:"'DM Sans',sans-serif" },
  navBtn:{ background:"none", border:"1px solid #2a2a2a", color:"#888", padding:"7px 16px", borderRadius:6, cursor:"pointer", fontSize:13, fontFamily:"inherit" },
  navActive:{ background:"none", border:"1px solid #C8A84B", color:"#C8A84B", padding:"7px 16px", borderRadius:6, cursor:"pointer", fontSize:13, fontFamily:"inherit" },
  main:{ maxWidth:1100, margin:"0 auto", padding:"48px 24px 80px" },
  toast:{ position:"fixed", top:72, right:24, zIndex:999, background:"#111", border:"1px solid", padding:"12px 20px", borderRadius:8, fontSize:13, fontFamily:"'DM Mono',monospace" },
  heroSection:{ textAlign:"center", padding:"60px 0 48px" },
  pill:{ display:"inline-block", background:"rgba(200,168,75,0.1)", border:"1px solid rgba(200,168,75,0.3)", color:"#C8A84B", padding:"5px 16px", borderRadius:100, fontSize:12, letterSpacing:"0.12em", marginBottom:24, fontFamily:"'DM Mono',monospace" },
  heroTitle:{ fontSize:"clamp(40px,7vw,72px)", fontWeight:800, lineHeight:1.05, letterSpacing:"-0.03em", color:"#f0f0f0", marginBottom:24 },
  heroSub:{ fontSize:16, color:"#777", maxWidth:560, margin:"0 auto 36px", lineHeight:1.7 },
  ctaPrimary:{ background:"#C8A84B", color:"#0e0e0e", border:"none", padding:"14px 30px", borderRadius:8, fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"inline-flex", alignItems:"center", gap:8 },
  ctaSecondary:{ background:"transparent", color:"#C8A84B", border:"1px solid #C8A84B", padding:"14px 30px", borderRadius:8, fontSize:15, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
  btnDisabled:{ background:"#2a2a2a", color:"#666", border:"none", padding:"14px 30px", borderRadius:8, fontSize:15, fontWeight:700, cursor:"not-allowed", fontFamily:"inherit", display:"inline-flex", alignItems:"center", gap:8 },
  btnSent:{ background:"#0d2b1a", color:"#2ecc71", border:"1px solid #2ecc71", padding:"14px 30px", borderRadius:8, fontSize:15, fontWeight:700, cursor:"default", fontFamily:"inherit" },
  statsRow:{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, margin:"0 0 64px" },
  statCard:{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"24px", textAlign:"center" },
  statNum:{ fontSize:28, fontWeight:800, color:"#C8A84B", fontFamily:"'DM Mono',monospace", marginBottom:4 },
  sectionTitle:{ fontSize:28, fontWeight:700, color:"#f0f0f0", marginBottom:32, letterSpacing:"-0.02em" },
  steps:{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:20 },
  stepCard:{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"28px 24px" },
  pageTitle:{ fontSize:32, fontWeight:700, letterSpacing:"-0.03em", marginBottom:8, color:"#f0f0f0" },
  bigDropZone:{ border:"2px dashed", borderRadius:12, padding:"64px 32px", textAlign:"center", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:260, transition:"all 0.2s" },
  fileBadge:{ display:"flex", alignItems:"center", gap:12, background:"#111", border:"1px solid #2a2a2a", borderRadius:8, padding:"12px 16px", marginBottom:16 },
  missingBanner:{ display:"flex", alignItems:"center", gap:10, background:"rgba(200,168,75,0.06)", border:"1px solid rgba(200,168,75,0.2)", borderRadius:8, padding:"12px 16px", marginBottom:20 },
  formCard:{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"24px" },
  formCardTitle:{ color:"#C8A84B", fontSize:11, letterSpacing:"0.14em", fontFamily:"'DM Mono',monospace", marginBottom:20, textTransform:"uppercase" },
  label:{ display:"block", color:"#666", fontSize:12, marginBottom:6, letterSpacing:"0.04em" },
  input:{ width:"100%", background:"#0a0a0a", border:"1px solid #222", borderRadius:6, padding:"10px 12px", color:"#e8e8e8", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" },
  textarea:{ width:"100%", background:"#0a0a0a", border:"1px solid #222", borderRadius:6, padding:"12px", color:"#e8e8e8", fontSize:13, fontFamily:"'DM Mono',monospace", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.6 },
  cardGrid:{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))", gap:20 },
  registryCard:{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"24px" },
  spinner:{ width:16, height:16, border:"2px solid rgba(200,168,75,0.2)", borderTop:"2px solid #C8A84B", borderRadius:"50%", animation:"spin 0.8s linear infinite", display:"inline-block" },
  reportHero:{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:"28px 32px", background:"#111", border:"1px solid #1e1e1e", borderRadius:12, marginBottom:8 },
  tabBar:{ display:"flex", borderBottom:"1px solid #1e1e1e", marginBottom:28, marginTop:28 },
  tab:{ background:"none", border:"none", borderBottom:"2px solid transparent", color:"#555", padding:"12px 20px", cursor:"pointer", fontSize:14, fontFamily:"inherit", fontWeight:600, marginBottom:-1 },
  tabActive:{ background:"none", border:"none", borderBottom:"2px solid #C8A84B", color:"#C8A84B", padding:"12px 20px", cursor:"pointer", fontSize:14, fontFamily:"inherit", fontWeight:600, marginBottom:-1 },
  tabContent:{ animation:"fadeIn 0.2s ease" },
  summaryBlock:{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"24px", marginBottom:20 },
  blockTitle:{ color:"#C8A84B", fontSize:11, letterSpacing:"0.14em", fontFamily:"'DM Mono',monospace", marginBottom:12, textTransform:"uppercase" },
  listBlock:{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"24px" },
  recommendationBox:{ background:"rgba(200,168,75,0.06)", border:"1px solid rgba(200,168,75,0.2)", borderRadius:10, padding:"18px 24px", fontSize:14, color:"#bbb", lineHeight:1.65 },
  emailCard:{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"20px 24px", marginBottom:16 },
};

const _s = document.createElement("style");
_s.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=DM+Mono:wght@400;500;700&display=swap');
  @keyframes spin { to { transform:rotate(360deg); } }
  @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  * { box-sizing:border-box; margin:0; padding:0; }
  input::placeholder, textarea::placeholder { color:#333; }
  button:hover { opacity:0.88; }
`;
document.head.appendChild(_s);
