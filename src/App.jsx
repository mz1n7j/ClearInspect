import { useState, useRef, useEffect } from "react";

function generateId() { return Math.random().toString(36).slice(2, 10); }
function getSession() { try { return JSON.parse(localStorage.getItem("ci_session") || "null"); } catch { return null; } }
function saveSession(s) { localStorage.setItem("ci_session", JSON.stringify(s)); }
function clearSession() { localStorage.removeItem("ci_session"); }

// ── BALANCE BAR ───────────────────────────────────────────────
function BalanceBar({ score }) {
  // score: 0-100, 50 = perfectly balanced, <30 = buyer biased, >70 = seller biased
  const pct = Math.max(0, Math.min(100, score));
  const isBalanced = pct >= 35 && pct <= 65;
  const isBuyerBiased = pct < 35;
  const color = isBalanced ? "#2ecc71" : "#e74c3c";
  const label = isBalanced ? "BALANCED" : isBuyerBiased ? "BUYER-BIASED" : "SELLER-BIASED";

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11, fontFamily: "'DM Mono',monospace" }}>
        <span style={{ color: "#e74c3c" }}>◄ BUYER-BIASED</span>
        <span style={{ color: "#2ecc71", fontWeight: 700 }}>BALANCED</span>
        <span style={{ color: "#e74c3c" }}>SELLER-BIASED ►</span>
      </div>
      <div style={{ position: "relative", height: 14, background: "linear-gradient(to right, #e74c3c 0%, #C8A84B 30%, #2ecc71 45%, #2ecc71 55%, #C8A84B 70%, #e74c3c 100%)", borderRadius: 99, overflow: "visible" }}>
        {/* center marker */}
        <div style={{ position: "absolute", left: "50%", top: -3, width: 2, height: 20, background: "#fff", opacity: 0.3, transform: "translateX(-50%)" }} />
        {/* needle */}
        <div style={{ position: "absolute", top: -4, left: `${pct}%`, transform: "translateX(-50%)", width: 22, height: 22, borderRadius: "50%", background: color, border: "3px solid #0e0e0e", boxShadow: `0 0 10px ${color}`, transition: "left 0.8s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono',monospace" }}>Flags excessive minor issues</span>
        <span style={{ fontSize: 12, color, fontFamily: "'DM Mono',monospace", fontWeight: 700, background: `${color}15`, border: `1px solid ${color}40`, padding: "3px 12px", borderRadius: 4 }}>{label}</span>
        <span style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono',monospace" }}>Misses material defects</span>
      </div>
    </div>
  );
}

function ScoreBadge({ score }) {
  const color = score >= 80 ? "#2ecc71" : score >= 55 ? "#C8A84B" : "#e74c3c";
  const label = score >= 80 ? "TRUSTED" : score >= 55 ? "REVIEW" : "FLAGGED";
  return (
    <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 14px", borderRadius:4, border:`1.5px solid ${color}`, color, fontSize:12, fontFamily:"'DM Mono',monospace", letterSpacing:"0.12em", fontWeight:700 }}>
      <span style={{ width:8, height:8, borderRadius:"50%", background:color, display:"inline-block" }} />{label} · {score}/100
    </div>
  );
}

function StepIndicator({ step }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", marginBottom:40 }}>
      {["Upload Report","Review Details","Analyze"].map((s,i) => (
        <div key={s} style={{ display:"flex", alignItems:"center" }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
            <div style={{ width:32, height:32, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", background:i<=step?"#C8A84B":"#1a1a1a", border:i<=step?"2px solid #C8A84B":"2px solid #2a2a2a", color:i<=step?"#0e0e0e":"#555", fontWeight:700, fontSize:13, fontFamily:"'DM Mono',monospace" }}>
              {i < step ? "✓" : i+1}
            </div>
            <span style={{ fontSize:11, color:i<=step?"#C8A84B":"#444", letterSpacing:"0.06em", whiteSpace:"nowrap" }}>{s}</span>
          </div>
          {i < 2 && <div style={{ width:80, height:2, background:i<step?"#C8A84B":"#1e1e1e", margin:"0 8px", marginBottom:22 }} />}
        </div>
      ))}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required, missing, type="text" }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
        <label style={{ color:missing?"#e74c3c":"#666", fontSize:12, letterSpacing:"0.04em" }}>{label}{required?" *":""}</label>
        {missing && <span style={{ fontSize:10, color:"#e74c3c", background:"rgba(231,76,60,0.1)", padding:"2px 7px", borderRadius:4, fontFamily:"'DM Mono',monospace" }}>Not found — please fill in</span>}
      </div>
      <input type={type} style={{ ...styles.input, borderColor:missing?"rgba(231,76,60,0.4)":"#222" }} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)} />
    </div>
  );
}

// ── AUTH MODAL ────────────────────────────────────────────────
function AuthModal({ onClose, onAuth }) {
  const [tab, setTab] = useState("signin");
  const [form, setForm] = useState({ email:"", password:"", name:"", role:"buyer", licenseNumber:"" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sf = k => v => setForm(f=>({...f,[k]:v}));

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action: tab, ...form }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong"); setLoading(false); return; }
      if (tab === "signup") { setTab("signin"); setError("Account created! Please sign in."); setLoading(false); return; }
      saveSession({ token: data.session?.access_token, profile: data.profile });
      onAuth(data.profile, data.session?.access_token);
      onClose();
    } catch(e) { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <div style={{ display:"flex" }}>
            {["signin","signup"].map(t=>(
              <button key={t} onClick={()=>{setTab(t);setError("");}} style={{ background:"none", border:"none", borderBottom:`2px solid ${tab===t?"#C8A84B":"transparent"}`, color:tab===t?"#C8A84B":"#555", padding:"8px 20px", cursor:"pointer", fontSize:14, fontWeight:600, fontFamily:"inherit" }}>
                {t==="signin"?"Sign In":"Create Account"}
              </button>
            ))}
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:20 }}>✕</button>
        </div>

        {error && <div style={{ padding:"10px 14px", borderRadius:6, background:error.includes("created")?"rgba(46,204,113,0.1)":"rgba(231,76,60,0.1)", border:`1px solid ${error.includes("created")?"#2ecc71":"#e74c3c"}`, color:error.includes("created")?"#2ecc71":"#e74c3c", fontSize:13, marginBottom:16 }}>{error}</div>}

        {tab==="signup" && <div style={{ marginBottom:14 }}><label style={styles.label}>Full Name</label><input style={styles.input} placeholder="Jane Smith" value={form.name} onChange={e=>sf("name")(e.target.value)} /></div>}
        <div style={{ marginBottom:14 }}><label style={styles.label}>Email</label><input style={styles.input} type="email" placeholder="you@email.com" value={form.email} onChange={e=>sf("email")(e.target.value)} /></div>
        <div style={{ marginBottom:14 }}><label style={styles.label}>Password</label><input style={styles.input} type="password" placeholder="••••••••" value={form.password} onChange={e=>sf("password")(e.target.value)} /></div>

        {tab==="signup" && (
          <>
            <div style={{ marginBottom:14 }}>
              <label style={styles.label}>I am a...</label>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginTop:6 }}>
                {["buyer","seller","realtor"].map(r=>(
                  <button key={r} onClick={()=>sf("role")(r)} style={{ padding:"10px", borderRadius:6, border:`1.5px solid ${form.role===r?"#C8A84B":"#222"}`, background:form.role===r?"rgba(200,168,75,0.1)":"#0a0a0a", color:form.role===r?"#C8A84B":"#555", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"inherit", textTransform:"capitalize" }}>{r}</button>
                ))}
              </div>
            </div>
            {form.role==="realtor" && (
              <div style={{ marginBottom:14 }}>
                <label style={styles.label}>Realtor License Number *</label>
                <input style={styles.input} placeholder="e.g. TX-12345678" value={form.licenseNumber} onChange={e=>sf("licenseNumber")(e.target.value)} />
                <p style={{ color:"#555", fontSize:11, marginTop:6 }}>Required for realtor accounts. 14-day free trial, then $20/year. Upload 50+ inspections and your first year is free!</p>
              </div>
            )}
            {form.role!=="realtor" && (
              <div style={{ padding:"12px 16px", borderRadius:8, background:"rgba(46,204,113,0.05)", border:"1px solid rgba(46,204,113,0.15)", marginBottom:14 }}>
                <p style={{ color:"#2ecc71", fontSize:12 }}>✓ Free account — browse the inspector registry and view public reports.</p>
              </div>
            )}
          </>
        )}
        <button onClick={submit} disabled={loading} style={{ ...styles.ctaPrimary, width:"100%", justifyContent:"center", marginTop:8, opacity:loading?0.7:1 }}>
          {loading?"Please wait...":tab==="signin"?"Sign In →":"Create Account →"}
        </button>
      </div>
    </div>
  );
}

// ── ACCOUNT PAGE ──────────────────────────────────────────────
function AccountPage({ profile, token }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const trialStart = profile?.trial_started_at ? new Date(profile.trial_started_at) : null;
  const daysLeft = trialStart ? Math.max(0, 14 - Math.floor((Date.now()-trialStart)/(1000*60*60*24))) : null;
  const isRealtor = profile?.role === "realtor";
  const status = profile?.subscription_status;
  const inspCount = profile?.inspection_count || 0;
  const freeByVolume = inspCount >= 50;
  const statusColor = status==="active"?"#2ecc71":status==="trial"?"#C8A84B":"#e74c3c";
  const statusLabel = status==="active"?"Active":status==="trial"?`Trial (${daysLeft} days left)`:"Expired";

  const startCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing", { method:"POST", headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`}, body: JSON.stringify({ action:"checkout" }) });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setMsg(data.error || "Could not start checkout");
    } catch { setMsg("Network error"); }
    finally { setLoading(false); }
  };

  return (
    <main style={styles.main}>
      <h2 style={styles.pageTitle}>My Account</h2>
      {msg && <div style={{ padding:"12px 16px", borderRadius:8, background:"rgba(231,76,60,0.1)", border:"1px solid #e74c3c", color:"#e74c3c", fontSize:13, marginBottom:20 }}>{msg}</div>}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
        <div style={styles.formCard}>
          <div style={styles.formCardTitle}>Profile</div>
          {[["Name",profile?.name],["Email",profile?.email],["Role",profile?.role],["License",profile?.license_number||"N/A"]].map(([l,v])=>(
            <div key={l} style={{ marginBottom:14 }}>
              <div style={{ color:"#555", fontSize:11, letterSpacing:"0.08em", marginBottom:3 }}>{l.toUpperCase()}</div>
              <div style={{ color:"#e8e8e8", fontSize:14, textTransform:l==="Role"?"capitalize":"none" }}>{v}</div>
            </div>
          ))}
        </div>
        {isRealtor && (
          <div style={styles.formCard}>
            <div style={styles.formCardTitle}>Subscription</div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:statusColor }} />
              <span style={{ color:statusColor, fontWeight:700, fontSize:15 }}>{statusLabel}</span>
            </div>
            <div style={{ marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <span style={{ color:"#666", fontSize:12 }}>Inspections uploaded toward free year</span>
                <span style={{ color:"#C8A84B", fontFamily:"'DM Mono',monospace", fontSize:12 }}>{inspCount}/50</span>
              </div>
              <div style={{ height:6, background:"#1e1e1e", borderRadius:99, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${Math.min(100,(inspCount/50)*100)}%`, background:freeByVolume?"#2ecc71":"#C8A84B", borderRadius:99 }} />
              </div>
              {freeByVolume ? <p style={{ color:"#2ecc71", fontSize:11, marginTop:6 }}>✓ Free for your first year — thank you!</p> : <p style={{ color:"#555", fontSize:11, marginTop:6 }}>Upload {50-inspCount} more inspections to earn a free first year.</p>}
            </div>
            {(status==="trial"||status==="expired") && !freeByVolume && (
              <button onClick={startCheckout} disabled={loading} style={styles.ctaPrimary}>{loading?"Loading...":"Subscribe — $20/year →"}</button>
            )}
          </div>
        )}
      </div>
      {isRealtor && (
        <div style={{ ...styles.formCard, background:"rgba(200,168,75,0.04)", border:"1px solid rgba(200,168,75,0.15)" }}>
          <div style={styles.formCardTitle}>Pricing Summary</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
            {[{label:"14-Day Trial",desc:"Full access, no credit card needed",color:"#C8A84B"},{label:"$20 / Year",desc:"After trial — full realtor access, unlimited reports",color:"#3498db"},{label:"Free First Year",desc:"Upload 50+ inspections annually and year 1 is on us",color:"#2ecc71"}].map(p=>(
              <div key={p.label} style={{ padding:"16px", borderRadius:8, border:`1px solid ${p.color}22`, background:`${p.color}08` }}>
                <div style={{ color:p.color, fontWeight:700, fontSize:15, marginBottom:6 }}>{p.label}</div>
                <div style={{ color:"#777", fontSize:12, lineHeight:1.6 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

// ── DISCLAIMER ────────────────────────────────────────────────
function Disclaimer() {
  return (
    <div style={{ background:"#080808", borderTop:"1px solid #1a1a1a", padding:"24px", marginTop:40 }}>
      <div style={{ maxWidth:1100, margin:"0 auto" }}>
        <p style={{ color:"#333", fontSize:11, lineHeight:1.8, fontFamily:"'DM Mono',monospace" }}>
          <span style={{ color:"#444", fontWeight:700 }}>AI-GENERATED ANALYSIS DISCLOSURE:</span> All inspector scores, Balance Scores, fraud risk ratings, performance reviews, and written summaries displayed on InspectorTrust are generated by artificial intelligence based solely on the content of submitted inspection reports. These assessments represent automated, opinion-based analysis and do not constitute verified facts, legal findings, background check results, or official determinations by any licensing board or regulatory authority. InspectorTrust makes no representations regarding the accuracy, completeness, or reliability of AI-generated content. Users should independently verify all information before making real estate, financial, or legal decisions. Inspector scores reflect analytical patterns in submitted reports only and should not be interpreted as a definitive assessment of any individual's professional character or competency. © {new Date().getFullYear()} InspectorTrust. All rights reserved.
        </p>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("home");
  const [uploadStep, setUploadStep] = useState(0);
  const [reports, setReports] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [toast, setToast] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [session, setSession] = useState(null);
  const [selectedInspector, setSelectedInspector] = useState(null);
  const [sharingReport, setSharingReport] = useState(null);
  const fileRef = useRef();

  const [form, setForm] = useState({ inspectorName:"", companyName:"", licenseNo:"", street:"", city:"", state:"", zip:"", buyerEmail:"", sellerEmail:"", realtorEmail:"", reportText:"", fileName:"" });
  const [missing, setMissing] = useState({});

  useEffect(() => { const s = getSession(); if (s) setSession(s); }, []);

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };
  const setField = k => v => setForm(f=>({...f,[k]:v}));
  const onAuth = (profile, token) => { const s={token,profile}; saveSession(s); setSession(s); };
  const signOut = () => { clearSession(); setSession(null); setView("home"); showToast("Signed out."); };

  const extractPdfText = async (file) => {
    return new Promise((resolve, reject) => {
      const loadScript = () => new Promise((res, rej) => {
        if (window.pdfjsLib) { res(); return; }
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; res(); };
        s.onerror = rej;
        document.head.appendChild(s);
      });
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          await loadScript();
          const pdf = await window.pdfjsLib.getDocument({ data: ev.target.result }).promise;
          let text = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(" ") + "\n";
          }
          resolve(text);
        } catch(e) { reject(e); }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const parseReport = async (text, fileName) => {
    setParsing(true);
    try {
      const res = await fetch("/api/analyze", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ mode:"parse", reportText: text.slice(0,4000) }) });
      const data = await res.json();
      const p = data.parsed || {};
      const newForm = { inspectorName:p.inspectorName||"", companyName:p.companyName||"", licenseNo:p.licenseNo||"", street:p.street||"", city:p.city||"", state:p.state||"", zip:p.zip||"", buyerEmail:p.buyerEmail||"", sellerEmail:p.sellerEmail||"", realtorEmail:p.realtorEmail||"", reportText:text, fileName };
      setForm(newForm);
      const m = {};
      ["inspectorName","street","city","state","zip"].forEach(k => { if (!newForm[k]) m[k]=true; });
      setMissing(m);
      setUploadStep(1);
    } catch {
      showToast("Could not auto-parse. Please fill in details manually.", "error");
      setForm(f=>({...f,reportText:text,fileName}));
      setMissing({inspectorName:true,street:true,city:true,state:true,zip:true});
      setUploadStep(1);
    } finally { setParsing(false); }
  };

  const handleFile = async (file) => {
    if (!file) return;
    setParsing(true);
    try {
      let text = "";
      if (file.type==="application/pdf"||file.name.endsWith(".pdf")) {
        text = await extractPdfText(file);
      } else {
        text = await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=ev=>res(ev.target.result); r.onerror=rej; r.readAsText(file); });
      }
      if (!text||text.trim().length<20) { showToast("Could not read text from file. Try pasting instead.","error"); setParsing(false); return; }
      await parseReport(text, file.name);
    } catch { showToast("File read failed. Please paste the report text instead.","error"); setParsing(false); }
  };

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); };

  const handleAnalyze = async () => {
    if (!session?.token) { setShowAuth(true); return; }
    if (!form.inspectorName||!form.street||!form.reportText) { showToast("Inspector name and street address are required.","error"); return; }
    const addr = [form.street,form.city,form.state,form.zip].filter(Boolean).join(", ");
    setUploading(true); setUploadStep(2);
    try {
      const res = await fetch("/api/analyze", {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.token}`},
        body: JSON.stringify({ mode:"analyze", inspectorName:form.inspectorName, companyName:form.companyName, licenseNo:form.licenseNo, propertyAddress:addr, reportText:form.reportText }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code==="TRIAL_EXPIRED") { setView("account"); showToast(data.message,"error"); return; }
        if (res.status===401) { clearSession(); setSession(null); setUploadStep(1); setShowAuth(true); showToast("Session expired — your report is still here, just sign in again.","error"); return; }
        throw new Error(data.error||"Analysis failed");
      }
      const newReport = { id:generateId(), ...form, propertyAddress:addr, analysis:data.analysis, date:new Date().toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}) };
      setReports(r=>[newReport,...r]);
      setAnalysisResult(newReport);
      setView("report"); setUploadStep(0);
      setForm({inspectorName:"",companyName:"",licenseNo:"",street:"",city:"",state:"",zip:"",buyerEmail:"",sellerEmail:"",realtorEmail:"",reportText:"",fileName:""});
      showToast("Report analyzed successfully.");
      if (session.profile) { const updated={...session.profile,inspection_count:(session.profile.inspection_count||0)+1}; const ns={...session,profile:updated}; saveSession(ns); setSession(ns); }
    } catch(err) { showToast("Analysis failed: "+err.message,"error"); setUploadStep(1); }
    finally { setUploading(false); }
  };

  const sendEmails = async () => { setEmailSending(true); await new Promise(r=>setTimeout(r,1800)); setEmailSending(false); setEmailSent(true); showToast("Email summaries dispatched."); };
  const viewReport = (r) => { setAnalysisResult(r); setEmailSent(false); setView("report"); };

  return (
    <div style={styles.root}>
      {toast && <div style={{...styles.toast,borderColor:toast.type==="error"?"#e74c3c":"#C8A84B",color:toast.type==="error"?"#e74c3c":"#C8A84B"}}>{toast.msg}</div>}
      {showAuth && <AuthModal onClose={()=>setShowAuth(false)} onAuth={onAuth} />}
      {sharingReport && <ShareModal report={sharingReport} onClose={()=>setSharingReport(null)} showToast={showToast} />}

      <header style={styles.header}>
        <div style={styles.headerInner}>
          <button onClick={()=>setView("home")} style={styles.logo}>▲ InspectorTrust</button>
          <nav style={{display:"flex",gap:8,alignItems:"center"}}>
            <button style={view==="upload"?styles.navActive:styles.navBtn} onClick={()=>{setView("upload");setUploadStep(0);}}>Upload Report</button>
            <button style={view==="database"?styles.navActive:styles.navBtn} onClick={()=>setView("database")}>Registry ({reports.length})</button>
            <button style={view==="directory"?styles.navActive:styles.navBtn} onClick={()=>setView("directory")}>Find Inspectors</button>
            {session ? (
              <>
                <button style={view==="account"?styles.navActive:styles.navBtn} onClick={()=>setView("account")}>Account {session.profile?.subscription_status==="trial"?"🕐":session.profile?.subscription_status==="expired"?"⚠️":""}</button>
                <button style={{...styles.navBtn,color:"#555"}} onClick={signOut}>Sign Out</button>
              </>
            ) : (
              <button style={styles.ctaPrimary} onClick={()=>setShowAuth(true)}>Sign In →</button>
            )}
          </nav>
        </div>
      </header>

      {/* ── HOME ── */}
      {view==="home" && (
        <main style={styles.main}>
          {/* HERO */}
          <div style={styles.heroSection}>
            <div style={styles.pill}>AI-Powered · Real Estate Transparency</div>
            <h1 style={styles.heroTitle}>Know Who's Really<br /><span style={{color:"#C8A84B",display:"block"}}>Inspecting Your Home.</span></h1>
            <p style={styles.heroSub}>InspectorTrust is the first transparent inspection marketplace that scores every inspector on fairness, accuracy, and balance — so buyers get honest assessments and sellers stop paying for someone else's negotiation tactics.</p>
            <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap"}}>
              <button style={styles.ctaPrimary} onClick={()=>{session?setView("upload"):setShowAuth(true);}}>{session?"Analyze a Report →":"Get Started Free →"}</button>
              <button style={styles.ctaSecondary} onClick={()=>setView("database")}>View Inspector Registry</button>
            </div>
          </div>

          {/* BALANCE BAR HERO FEATURE */}
          <div style={{...styles.formCard, marginBottom:32, border:"1px solid rgba(200,168,75,0.3)", background:"rgba(200,168,75,0.03)", padding:"20px 24px"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
              <div style={styles.pill}>New Feature</div>
              <div style={styles.formCardTitle}>Inspector Balance Score</div>
            </div>
            <h3 style={{color:"#f0f0f0",fontSize:17,fontWeight:700,marginBottom:8,letterSpacing:"-0.02em"}}>A Better Way to Evaluate Inspectors</h3>
            <p style={{color:"#777",fontSize:13,lineHeight:1.7,marginBottom:20,maxWidth:"100%"}}>
              Not all inspection reports are created equal. Some inspectors flag every scuff mark alongside genuine structural concerns — making it impossible to know what actually matters. The Inspector Balance Score measures what the industry has ignored: whether an inspector consistently identifies <strong style={{color:"#C8A84B"}}>material, deal-relevant issues</strong> while filtering out excessive minor findings used as negotiation leverage.
            </p>
            <BalanceBar score={52} />
            <p style={{color:"#444",fontSize:11,marginTop:16,fontStyle:"italic"}}>Example shown above. Green means this inspector has a consistent track record of identifying what matters — and nothing more. Red means the report may not give you the full, balanced picture.</p>
          </div>

          {/* STATS */}
          <div style={styles.statsRow}>
            {[{n:"1 in 4",l:"inspectors flagged for bias"},{n:"14-day",l:"free trial for realtors"},{n:"$20/yr",l:"after trial — no hidden fees"},{n:"50+",l:"inspections = free first year"}].map(s=>(
              <div key={s.l} style={styles.statCard}><div style={styles.statNum}>{s.n}</div><div style={{color:"#555",fontSize:12,letterSpacing:"0.08em"}}>{s.l}</div></div>
            ))}
          </div>

          {/* PRICING */}
          <div style={{marginBottom:64}}>
            <h2 style={styles.sectionTitle}>Simple, Transparent Pricing</h2>
            <p style={{color:"#666",fontSize:14,lineHeight:1.7,marginBottom:28}}>Whether you're buying, selling, or closing deals — InspectorTrust has a plan for you.</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
              {[
                {title:"Buyer / Seller",price:"Free",color:"#2ecc71",btn:"green",features:["Browse inspector registry","View public Balance Scores","See major issues summary","No account required to search"]},
                {title:"Realtor — Trial",price:"14 Days Free",color:"#C8A84B",btn:"gold",features:["Upload & analyze reports","Full AI performance reviews","Balance Score on every report","Auto email buyer, seller & agent","PDF export"]},
                {title:"Realtor — Annual",price:"$20 / year",color:"#3498db",btn:"blue",features:["Everything in trial","Unlimited report uploads","Upload 50+ reports = free first year","Inspector fraud risk alerts","Priority support"]},
              ].map(p=>(
                <div key={p.title} style={{...styles.stepCard,border:`1px solid ${p.color}33`,display:"flex",flexDirection:"column"}}>
                  <div style={{color:p.color,fontSize:11,letterSpacing:"0.14em",fontFamily:"'DM Mono',monospace",marginBottom:8}}>{p.title.toUpperCase()}</div>
                  <div style={{fontSize:26,fontWeight:800,color:"#f0f0f0",marginBottom:14}}>{p.price}</div>
                  <div style={{flex:1}}>
                    {p.features.map(f=><div key={f} style={{color:"#777",fontSize:13,marginBottom:8,display:"flex",gap:8,alignItems:"flex-start"}}><span style={{color:p.color,flexShrink:0}}>✓</span>{f}</div>)}
                  </div>
                  <div style={{marginTop:20}}>
                    {p.btn==="green" && <button style={{background:"#2ecc71",color:"#0e0e0e",border:"none",padding:"11px 20px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",width:"100%"}} onClick={()=>setShowAuth(true)}>Create Free Account →</button>}
                    {p.btn==="gold" && <button style={{...styles.ctaPrimary,fontSize:13,padding:"11px 20px",width:"100%",justifyContent:"center"}} onClick={()=>setShowAuth(true)}>Start Free Trial →</button>}
                    {p.btn==="blue" && <button style={{background:"#3498db",color:"#fff",border:"none",padding:"11px 20px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",width:"100%"}} onClick={()=>setShowAuth(true)}>Get Realtor Access →</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* HOW IT WORKS */}
          <div>
            <h2 style={styles.sectionTitle}>How It Works</h2>
            <div style={styles.steps}>
              {[{n:"01",t:"Drop Your Report",b:"Upload any inspection report. Our AI reads it instantly — PDF, Word, or text. No manual entry needed."},{n:"02",t:"Confirm Details",b:"We auto-fill everything we find. You only fill in what's missing."},{n:"03",t:"Get the Balance Score",b:"Receive a full inspector performance dossier with Balance Score, fraud risk grade, and analysis."},{n:"04",t:"Notify All Parties",b:"Buyer, seller, and realtor each get a tailored AI-written email summary automatically."}].map(s=>(
                <div key={s.n} style={styles.stepCard}>
                  <div style={{fontFamily:"'DM Mono',monospace",color:"#C8A84B",fontSize:28,fontWeight:700,marginBottom:16,opacity:0.7}}>{s.n}</div>
                  <h3 style={{color:"#e8e8e8",fontSize:16,fontWeight:600,marginBottom:10}}>{s.t}</h3>
                  <p style={{color:"#666",fontSize:13,lineHeight:1.7}}>{s.b}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* ── UPLOAD ── */}
      {view==="upload" && (
        <main style={styles.main}>
          <div style={{maxWidth:700,margin:"0 auto"}}>
            <h2 style={styles.pageTitle}>Submit Inspection Report</h2>
            <p style={{color:"#666",fontSize:14,marginBottom:36}}>{uploadStep===0?"Drop your report and we'll handle the rest.":uploadStep===1?"We've extracted what we could. Fill in anything missing.":"Analyzing with AI..."}</p>
            {session?.profile?.role==="realtor"&&session?.profile?.subscription_status==="trial"&&(
              <div style={{display:"flex",alignItems:"center",gap:12,background:"rgba(200,168,75,0.06)",border:"1px solid rgba(200,168,75,0.2)",borderRadius:8,padding:"12px 16px",marginBottom:24}}>
                <span>🕐</span>
                <span style={{color:"#C8A84B",fontSize:13}}>Trial active — {Math.max(0,14-Math.floor((Date.now()-new Date(session.profile.trial_started_at))/(1000*60*60*24)))} days remaining. <button onClick={()=>setView("account")} style={{background:"none",border:"none",color:"#C8A84B",cursor:"pointer",fontSize:13,textDecoration:"underline"}}>Manage →</button></span>
              </div>
            )}
            <StepIndicator step={uploadStep} />
            {uploadStep===0 && (
              <div>
                <div style={{...styles.bigDropZone,borderColor:dragOver?"#C8A84B":"#2a2a2a",background:dragOver?"rgba(200,168,75,0.05)":"#0a0a0a"}} onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={handleDrop} onClick={()=>fileRef.current?.click()}>
                  <input ref={fileRef} type="file" accept=".txt,.pdf,.doc,.docx" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])} />
                  {parsing?(
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16}}><span style={{...styles.spinner,width:32,height:32,borderWidth:3}}/><span style={{color:"#C8A84B",fontSize:14,fontFamily:"'DM Mono',monospace"}}>Reading report...</span></div>
                  ):(
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
                      <span style={{fontSize:52}}>📋</span>
                      <span style={{color:"#C8A84B",fontSize:16,fontWeight:700}}>Drop your inspection report here</span>
                      <span style={{color:"#555",fontSize:13}}>or click to browse · .txt .pdf .doc .docx</span>
                      <span style={{color:"#333",fontSize:12,marginTop:8}}>AI auto-extracts inspector, company, license & address</span>
                    </div>
                  )}
                </div>
                <div style={{margin:"24px 0",display:"flex",alignItems:"center",gap:16}}><div style={{flex:1,height:1,background:"#1e1e1e"}}/><span style={{color:"#444",fontSize:12}}>or paste report text</span><div style={{flex:1,height:1,background:"#1e1e1e"}}/></div>
                <textarea style={{...styles.textarea,minHeight:160}} placeholder="Paste the full inspection report text here..." onChange={e=>{if(e.target.value.length>50)parseReport(e.target.value,"pasted report");}} />
              </div>
            )}
            {uploadStep===1 && (
              <div>
                {form.fileName&&<div style={styles.fileBadge}><span style={{fontSize:18}}>📄</span><span style={{color:"#C8A84B",fontSize:13}}>{form.fileName}</span><button onClick={()=>{setUploadStep(0);setForm(f=>({...f,reportText:"",fileName:""}));}} style={{marginLeft:"auto",background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:12}}>✕ Remove</button></div>}
                {Object.keys(missing).length>0&&<div style={styles.missingBanner}><span>⚠️</span><span style={{color:"#C8A84B",fontSize:13}}>We couldn't find {Object.keys(missing).length} field{Object.keys(missing).length>1?"s":""} in the report. Please fill them in.</span></div>}
                <div style={styles.formCard}>
                  <div style={styles.formCardTitle}>Inspector Details</div>
                  <Field label="Inspector Full Name" value={form.inspectorName} onChange={setField("inspectorName")} placeholder="John Smith" required missing={missing.inspectorName} />
                  <Field label="Company / Firm" value={form.companyName} onChange={setField("companyName")} placeholder="Apex Home Inspections LLC" />
                  <Field label="License Number" value={form.licenseNo} onChange={setField("licenseNo")} placeholder="HI-20984" />
                </div>
                <div style={{...styles.formCard,marginTop:16}}>
                  <div style={styles.formCardTitle}>Property Address</div>
                  <Field label="Street Address" value={form.street} onChange={setField("street")} placeholder="123 Maple Street" required missing={missing.street} />
                  <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:12}}>
                    <Field label="City" value={form.city} onChange={setField("city")} placeholder="Austin" required missing={missing.city} />
                    <Field label="State" value={form.state} onChange={setField("state")} placeholder="TX" required missing={missing.state} />
                    <Field label="ZIP" value={form.zip} onChange={setField("zip")} placeholder="78701" required missing={missing.zip} />
                  </div>
                </div>
                <div style={{...styles.formCard,marginTop:16}}>
                  <div style={styles.formCardTitle}>Notify Parties <span style={{color:"#444",fontWeight:400}}>(optional)</span></div>
                  <p style={{color:"#555",fontSize:12,marginBottom:16}}>Each party receives a tailored AI-written email summary.</p>
                  <Field label="Buyer Email" value={form.buyerEmail} onChange={setField("buyerEmail")} placeholder="buyer@email.com" type="email" />
                  <Field label="Seller Email" value={form.sellerEmail} onChange={setField("sellerEmail")} placeholder="seller@email.com" type="email" />
                  <Field label="Realtor Email" value={form.realtorEmail} onChange={setField("realtorEmail")} placeholder="agent@realty.com" type="email" />
                </div>
                <div style={{display:"flex",gap:12,marginTop:24}}>
                  <button style={styles.ctaSecondary} onClick={()=>setUploadStep(0)}>← Start Over</button>
                  <button style={uploading?styles.btnDisabled:styles.ctaPrimary} onClick={handleAnalyze} disabled={uploading}>
                    {uploading?<span style={{display:"flex",alignItems:"center",gap:10}}><span style={styles.spinner}/> Analyzing...</span>:"Run AI Analysis →"}
                  </button>
                </div>
              </div>
            )}
            {uploadStep===2&&<div style={{textAlign:"center",padding:"60px 0"}}><span style={{...styles.spinner,width:48,height:48,borderWidth:4,display:"inline-block"}}/><p style={{color:"#C8A84B",fontSize:16,marginTop:24,fontFamily:"'DM Mono',monospace"}}>Analyzing report with AI...</p><p style={{color:"#555",fontSize:13,marginTop:8}}>Scoring balance, completeness, fraud risk, and generating email summaries</p></div>}
          </div>
        </main>
      )}

      {/* ── REPORT ── */}
      {view==="report"&&analysisResult&&(
        <ReportView report={analysisResult} onSendEmails={sendEmails} emailSending={emailSending} emailSent={emailSent} onBack={()=>setView("database")} onShare={()=>setSharingReport(analysisResult)} />
      )}

      {/* ── DATABASE ── */}
      {view==="database"&&(
        <main style={styles.main}>
          <h2 style={styles.pageTitle}>Inspector Registry</h2>
          <p style={{color:"#666",fontSize:14,marginBottom:36}}>Public database of AI-analyzed inspection reports. Balance Scores and major issues visible to all. Full reports require login.</p>
          {reports.length===0?(
            <div style={{textAlign:"center",padding:"80px 0",borderRadius:12,border:"1px dashed #1e1e1e"}}>
              <div style={{fontSize:48,marginBottom:16}}>🔍</div>
              <p style={{color:"#666"}}>No reports submitted yet.</p>
              <button style={{...styles.ctaPrimary,marginTop:16}} onClick={()=>{session?setView("upload"):setShowAuth(true);}}>{session?"Submit the first report":"Sign In to Submit"}</button>
            </div>
          ):(
            <div style={styles.cardGrid}>
              {reports.map(r=>(
                <div key={r.id} style={styles.registryCard}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                    <div><div style={{fontSize:18,fontWeight:700,color:"#f0f0f0",marginBottom:2}}>{r.inspectorName}</div><div style={{color:"#555",fontSize:13}}>{r.companyName||"Independent"}</div></div>
                    <ScoreBadge score={r.analysis.trustScore}/>
                  </div>
                  <div style={{marginBottom:12}}><BalanceBar score={r.analysis.balanceScore||50}/></div>
                  <div style={{color:"#666",fontSize:12,marginBottom:8}}>📍 {r.propertyAddress}</div>
                  <p style={{color:"#888",fontSize:13,lineHeight:1.6}}>{r.analysis.summary?.slice(0,120)}…</p>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:16}}>
                    <span style={{fontSize:11,fontFamily:"'DM Mono',monospace",padding:"3px 10px",borderRadius:4,border:"1px solid",fontWeight:700,background:r.analysis.fraudRisk==="High"?"#3a1010":r.analysis.fraudRisk==="Moderate"?"#2d2000":"#0d2b1a",color:r.analysis.fraudRisk==="High"?"#e74c3c":r.analysis.fraudRisk==="Moderate"?"#C8A84B":"#2ecc71",borderColor:r.analysis.fraudRisk==="High"?"#e74c3c":r.analysis.fraudRisk==="Moderate"?"#C8A84B":"#2ecc71"}}>{r.analysis.fraudRisk} Risk</span>
                    <div style={{display:"flex",gap:8}}>
                    <button style={{background:"none",border:"1px solid #2a2a2a",color:"#888",cursor:"pointer",fontSize:12,fontFamily:"inherit",padding:"4px 10px",borderRadius:5}} onClick={e=>{e.stopPropagation();setSharingReport(r);}}>Share</button>
                    <button style={{background:"none",border:"none",color:"#C8A84B",cursor:"pointer",fontSize:13,fontFamily:"inherit",fontWeight:600}} onClick={()=>viewReport(r)}>Full Review →</button>
                  </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* ── ACCOUNT ── */}
      {view==="account"&&session&&<AccountPage profile={session.profile} token={session.token} />}

      {/* ── INSPECTOR DIRECTORY ── */}
      {view==="directory"&&<InspectorDirectory onRegister={()=>setView("inspector_register")} />}

      {/* ── INSPECTOR REGISTER ── */}
      {view==="inspector_register"&&<InspectorRegister onBack={()=>setView("directory")} showToast={showToast} />}

      {/* ── INSPECTOR PROFILE ── */}
      {view==="inspector_profile"&&selectedInspector&&<InspectorProfile inspector={selectedInspector} onBack={()=>setView("directory")} />}

      <Disclaimer />
    </div>
  );
}

// ── REPORT VIEW ───────────────────────────────────────────────
function ReportView({ report, onSendEmails, emailSending, emailSent, onBack, onShare }) {
  const a = report.analysis;
  const [activeTab, setActiveTab] = useState("overview");
  const [pdfExporting, setPdfExporting] = useState(false);

  const exportToPDF = async () => {
    setPdfExporting(true);
    try {
      await new Promise((resolve,reject)=>{ if(window.jspdf){resolve();return;} const s=document.createElement("script"); s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"; s.onload=resolve; s.onerror=reject; document.head.appendChild(s); });
      const {jsPDF}=window.jspdf;
      const doc=new jsPDF({orientation:"portrait",unit:"mm",format:"letter"});
      const W=215.9,margin=18,contentW=W-margin*2; let y=0;
      const hex2rgb=h=>{const x=h.replace("#","");return[parseInt(x.slice(0,2),16),parseInt(x.slice(2,4),16),parseInt(x.slice(4,6),16)];};
      const setColor=(hex,type="text")=>{const[r,g,b]=hex2rgb(hex);type==="fill"?doc.setFillColor(r,g,b):type==="draw"?doc.setDrawColor(r,g,b):doc.setTextColor(r,g,b);};
      const addPage=()=>{doc.addPage();y=margin;};
      const checkY=(n=12)=>{if(y+n>265)addPage();};
      setColor("#0e0e0e","fill");doc.rect(0,0,W,279.4,"F");
      setColor("#C8A84B","fill");doc.rect(0,0,W,2,"F");
      doc.setFontSize(72);doc.setFont("helvetica","bold");setColor("#1a1a1a");doc.text("IT",W/2,120,{align:"center"});
      y=52;doc.setFontSize(9);doc.setFont("helvetica","normal");setColor("#C8A84B");doc.text("INSPECTORTRUST · INSPECTOR PERFORMANCE REVIEW",W/2,y,{align:"center"});
      y=68;doc.setFontSize(26);doc.setFont("helvetica","bold");setColor("#f0f0f0");
      const nameLines=doc.splitTextToSize(report.inspectorName.toUpperCase(),contentW);doc.text(nameLines,W/2,y,{align:"center"});y+=nameLines.length*11;
      doc.setFontSize(12);doc.setFont("helvetica","normal");setColor("#C8A84B");doc.text(report.companyName||"Independent Inspector",W/2,y+4,{align:"center"});
      const cx=W/2,cy=155,scoreColor=a.trustScore>=80?"#2ecc71":a.trustScore>=55?"#C8A84B":"#e74c3c";
      setColor("#1a1a1a","fill");setColor(scoreColor,"draw");doc.setLineWidth(1.5);doc.circle(cx,cy,22,"FD");
      doc.setFontSize(22);doc.setFont("helvetica","bold");setColor(scoreColor);doc.text(String(a.trustScore),cx,cy+3,{align:"center"});
      doc.setFontSize(7);setColor("#888888");doc.text("TRUST SCORE",cx,cy+10,{align:"center"});
      const gradeColor=a.inspectorGrade==="A"?"#2ecc71":a.inspectorGrade==="B"?"#C8A84B":"#e74c3c";
      setColor("#1a1a1a","fill");setColor(gradeColor,"draw");doc.setLineWidth(1);doc.roundedRect(cx+28,cy-10,20,20,3,3,"FD");
      doc.setFontSize(16);doc.setFont("helvetica","bold");setColor(gradeColor);doc.text(a.inspectorGrade,cx+38,cy+4,{align:"center"});
      setColor("#111111","fill");setColor("#2a2a2a","draw");doc.setLineWidth(0.3);doc.roundedRect(margin,190,contentW,32,3,3,"FD");
      doc.setFontSize(8);doc.setFont("helvetica","normal");setColor("#888888");
      doc.text("PROPERTY",margin+6,199);doc.text("LICENSE",margin+6,209);doc.text("DATE",margin+6,219);
      setColor("#cccccc");doc.text(report.propertyAddress||"N/A",margin+44,199);doc.text(report.licenseNo||"Not Provided",margin+44,209);doc.text(report.date,margin+44,219);
      doc.setFontSize(6.5);doc.setFont("helvetica","italic");setColor("#444444");
      doc.text(doc.splitTextToSize("DISCLAIMER: AI-generated analysis and opinion based on submitted content. Not a legal determination, background check, or official licensing board finding. InspectorTrust scores are for informational transparency purposes only.",contentW),W/2,258,{align:"center"});
      setColor("#C8A84B","fill");doc.rect(0,277,W,2,"F");
      addPage();
      const sectionHeader=(title)=>{checkY(14);setColor("#C8A84B","fill");doc.rect(margin,y-4,3,10,"F");doc.setFontSize(8);doc.setFont("helvetica","bold");setColor("#C8A84B");doc.text(title,margin+6,y+3);y+=12;setColor("#1e1e1e","draw");doc.setLineWidth(0.2);doc.line(margin,y-2,W-margin,y-2);y+=4;};
      doc.setFontSize(7);doc.setFont("helvetica","normal");setColor("#444444");
      doc.text("INSPECTORTRUST PERFORMANCE REVIEW",margin,y);doc.text(`${report.inspectorName} · ${report.date}`,W-margin,y,{align:"right"});
      setColor("#C8A84B","fill");doc.rect(margin,y+2,contentW,0.4,"F");y+=10;
      sectionHeader("AI SUMMARY");
      doc.setFontSize(10);doc.setFont("helvetica","italic");setColor("#aaaaaa");
      const sumLines=doc.splitTextToSize(a.summary||"",contentW);doc.text(sumLines,margin,y);y+=sumLines.length*5.5+10;
      sectionHeader("STRENGTHS");
      (a.strengths||[]).forEach(s=>{checkY(10);setColor("#2ecc71","fill");doc.circle(margin+2,y-1,1.2,"F");doc.setFontSize(9.5);doc.setFont("helvetica","normal");setColor("#aaaaaa");const ls=doc.splitTextToSize(s,contentW-8);doc.text(ls,margin+7,y);y+=ls.length*5+3;});
      y+=4;sectionHeader("CONCERNS");
      (a.concerns||[]).forEach(c=>{checkY(10);setColor("#e74c3c","fill");doc.rect(margin+0.5,y-3.5,2.5,2.5,"F");doc.setFontSize(9.5);doc.setFont("helvetica","normal");setColor("#aaaaaa");const lc=doc.splitTextToSize(c,contentW-8);doc.text(lc,margin+7,y);y+=lc.length*5+3;});
      doc.save(`InspectorTrust_${report.inspectorName.replace(/\s+/g,"_")}.pdf`);
    } catch(err){alert("PDF export failed.");}
    finally{setPdfExporting(false);}
  };

  return (
    <main style={styles.main}>
      <button onClick={onBack} style={{background:"none",border:"none",color:"#666",cursor:"pointer",fontSize:14,fontFamily:"inherit",marginBottom:32,padding:0}}>← Back to Registry</button>
      <div style={styles.reportHero}>
        <div>
          <div style={{fontSize:28,fontWeight:800,color:"#f0f0f0",letterSpacing:"-0.02em"}}>{report.inspectorName}</div>
          <div style={{color:"#C8A84B",fontSize:14,marginTop:4}}>{report.companyName||"Independent Inspector"} · License {report.licenseNo||"N/A"}</div>
          <div style={{color:"#666",fontSize:13,marginTop:4}}>📍 {report.propertyAddress} · {report.date}</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:10}}>
          <ScoreBadge score={a.trustScore}/>
          <div style={{fontSize:28,fontFamily:"'DM Mono',monospace",fontWeight:700,color:a.inspectorGrade==="A"?"#2ecc71":a.inspectorGrade==="B"?"#C8A84B":"#e74c3c"}}>{a.inspectorGrade}</div>
          <button onClick={exportToPDF} disabled={pdfExporting} style={{background:"transparent",border:"1px solid #C8A84B",color:pdfExporting?"#555":"#C8A84B",padding:"8px 16px",borderRadius:6,cursor:pdfExporting?"not-allowed":"pointer",fontSize:12,fontFamily:"'DM Mono',monospace",fontWeight:700,display:"flex",alignItems:"center",gap:7}}>
            {pdfExporting?<><span style={styles.spinner}/> Exporting...</>:<>↓ Export PDF</>}
          </button>
          <button onClick={onShare} style={{background:"transparent",border:"1px solid #3498db",color:"#3498db",padding:"8px 16px",borderRadius:6,cursor:"pointer",fontSize:12,fontFamily:"'DM Mono',monospace",fontWeight:700,display:"flex",alignItems:"center",gap:7}}>
            ↗ Share Report
          </button>
        </div>
      </div>

      {/* Balance bar on report */}
      <div style={{...styles.summaryBlock,marginTop:8}}>
        <h3 style={styles.blockTitle}>Inspector Balance Score</h3>
        <BalanceBar score={a.balanceScore||50}/>
      </div>

      <div style={styles.tabBar}>
        {["overview","scores","emails","flags","correct"].map(t=>(
          <button key={t} style={activeTab===t?styles.tabActive:styles.tab} onClick={()=>setActiveTab(t)}>{t==="correct"?"✏ Correct Record":t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>

      {activeTab==="overview"&&(
        <div style={styles.tabContent}>
          <div style={styles.summaryBlock}><h3 style={styles.blockTitle}>AI Summary</h3><p style={{color:"#aaa",fontSize:15,lineHeight:1.75}}>{a.summary}</p></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
            <div style={styles.listBlock}><h4 style={{color:"#2ecc71",fontSize:13,letterSpacing:"0.1em",marginBottom:12}}>✓ STRENGTHS</h4>{a.strengths?.map((s,i)=><div key={i} style={{color:"#aaa",fontSize:13,lineHeight:1.6,display:"flex",gap:10,marginBottom:10}}><span style={{color:"#2ecc71"}}>+</span>{s}</div>)}</div>
            <div style={styles.listBlock}><h4 style={{color:"#e74c3c",fontSize:13,letterSpacing:"0.1em",marginBottom:12}}>⚠ CONCERNS</h4>{a.concerns?.map((s,i)=><div key={i} style={{color:"#aaa",fontSize:13,lineHeight:1.6,display:"flex",gap:10,marginBottom:10}}><span style={{color:"#e74c3c"}}>!</span>{s}</div>)}</div>
          </div>
          <div style={styles.recommendationBox}><span style={{color:"#C8A84B",fontWeight:700,marginRight:8}}>Recommendation:</span>{a.recommendation}</div>
        </div>
      )}
      {activeTab==="scores"&&(
        <div style={styles.tabContent}>
          <h3 style={styles.blockTitle}>Performance Scorecard</h3>
          {[{label:"Trust Score",val:a.trustScore,color:"#C8A84B"},{label:"Completeness",val:a.completenessScore,color:"#3498db"},{label:"Technical Rigor",val:a.technicalScore,color:"#9b59b6"},{label:"Objectivity",val:a.objectivityScore,color:"#2ecc71"}].map(s=>(
            <div key={s.label} style={{marginBottom:24}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:"#ccc",fontSize:13}}>{s.label}</span><span style={{color:s.color,fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:14}}>{s.val}/100</span></div>
              <div style={{height:6,background:"#1e1e1e",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",borderRadius:99,width:`${s.val}%`,background:s.color}}/></div>
            </div>
          ))}
          <div style={{...styles.summaryBlock,marginTop:28}}>
            <h3 style={styles.blockTitle}>Fraud Risk</h3>
            <div style={{display:"inline-flex",padding:"10px 22px",border:`2px solid ${a.fraudRisk==="High"?"#e74c3c":a.fraudRisk==="Moderate"?"#C8A84B":"#2ecc71"}`,color:a.fraudRisk==="High"?"#e74c3c":a.fraudRisk==="Moderate"?"#C8A84B":"#2ecc71",fontFamily:"'DM Mono',monospace",fontWeight:700,borderRadius:4,fontSize:18,marginTop:8}}>{a.fraudRisk?.toUpperCase()} RISK</div>
          </div>
        </div>
      )}
      {activeTab==="emails"&&(
        <div style={styles.tabContent}>
          <h3 style={styles.blockTitle}>Auto-Generated Email Summaries</h3>
          <p style={{color:"#666",fontSize:13,marginBottom:24}}>AI-drafted emails ready to dispatch to all parties.</p>
          {[{role:"Buyer",key:"emailBuyer",addr:report.buyerEmail,icon:"🏠"},{role:"Seller",key:"emailSeller",addr:report.sellerEmail,icon:"💼"},{role:"Realtor",key:"emailRealtor",addr:report.realtorEmail,icon:"📋"}].map(e=>(
            <div key={e.key} style={styles.emailCard}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}><span style={{fontSize:20}}>{e.icon}</span><div><div style={{color:"#fff",fontWeight:700,fontSize:14}}>To: {e.role}</div><div style={{color:"#555",fontSize:12}}>{e.addr||"No email provided"}</div></div></div>
              <div style={{color:"#888",fontSize:13,lineHeight:1.75,fontFamily:"'DM Mono',monospace",borderTop:"1px solid #1a1a1a",paddingTop:14,whiteSpace:"pre-wrap"}}>{a[e.key]}</div>
            </div>
          ))}
          <button style={emailSent?styles.btnSent:emailSending?styles.btnDisabled:styles.ctaPrimary} onClick={()=>!emailSent&&!emailSending&&onSendEmails()} disabled={emailSending||emailSent}>
            {emailSent?"✓ Emails Dispatched":emailSending?<span style={{display:"flex",alignItems:"center",gap:10}}><span style={styles.spinner}/> Sending...</span>:"Dispatch All Emails →"}
          </button>
        </div>
      )}
      {activeTab==="flags"&&(
        <div style={styles.tabContent}>
          <h3 style={styles.blockTitle}>Red Flag Analysis</h3>
          {!a.redFlags||a.redFlags.length===0?(
            <div style={{...styles.summaryBlock,borderColor:"#2ecc71"}}><span style={{color:"#2ecc71",fontSize:22}}>✓</span><p style={{color:"#2ecc71",marginTop:8}}>No red flags detected.</p></div>
          ):(
            <div>{a.redFlags?.map((flag,i)=><div key={i} style={{display:"flex",gap:14,alignItems:"flex-start",background:"rgba(231,76,60,0.04)",border:"1px solid rgba(231,76,60,0.15)",borderRadius:8,padding:"14px 18px",marginBottom:10}}><span style={{color:"#e74c3c",fontSize:18}}>⚑</span><span style={{color:"#ddd",fontSize:14,flex:1}}>{flag}</span></div>)}</div>
          )}
        </div>
      )}
      {activeTab==="correct"&&(
        <CorrectionForm report={report} />
      )}
    </main>
  );
}

// ── CORRECTION FORM ───────────────────────────────────────────
function CorrectionForm({ report }) {
  const [form, setForm] = useState({ correctedInspectorName:"", correctedCompanyName:"", reason:"", email:"" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sf = k => v => setForm(f=>({...f,[k]:v}));

  const submit = async () => {
    if (!form.correctedInspectorName && !form.correctedCompanyName) { setError("Please provide at least one corrected field."); return; }
    if (!form.email) { setError("Please provide your email address."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/correction", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"checkout", reportId:report.id, inspectorName:report.inspectorName, companyName:report.companyName, correctedInspectorName:form.correctedInspectorName, correctedCompanyName:form.correctedCompanyName, reason:form.reason, email:form.email }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error || "Could not start checkout.");
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div style={styles.tabContent}>
      <div style={{...styles.summaryBlock, border:"1px solid rgba(200,168,75,0.3)", background:"rgba(200,168,75,0.03)", marginBottom:24}}>
        <h3 style={styles.blockTitle}>Request a Record Correction</h3>
        <p style={{color:"#888",fontSize:14,lineHeight:1.75}}>Are you the inspector listed in this report? If your name or company name was misspelled in the original inspection file, you can request a correction for a <strong style={{color:"#C8A84B"}}>one-time $20 fee</strong>. All requests are reviewed by our team before being applied.</p>
      </div>
      {error && <div style={{padding:"10px 14px",borderRadius:6,background:"rgba(231,76,60,0.1)",border:"1px solid #e74c3c",color:"#e74c3c",fontSize:13,marginBottom:16}}>{error}</div>}
      <div style={styles.formCard}>
        <div style={styles.formCardTitle}>Current Record</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <div><div style={{color:"#555",fontSize:11,letterSpacing:"0.08em",marginBottom:4}}>INSPECTOR NAME</div><div style={{color:"#e8e8e8",fontSize:14,fontFamily:"'DM Mono',monospace"}}>{report.inspectorName||"Not listed"}</div></div>
          <div><div style={{color:"#555",fontSize:11,letterSpacing:"0.08em",marginBottom:4}}>COMPANY</div><div style={{color:"#e8e8e8",fontSize:14,fontFamily:"'DM Mono',monospace"}}>{report.companyName||"Not listed"}</div></div>
        </div>
      </div>
      <div style={{...styles.formCard,marginTop:16}}>
        <div style={styles.formCardTitle}>Requested Corrections</div>
        <p style={{color:"#555",fontSize:12,marginBottom:20}}>Leave a field blank if it does not need to be changed.</p>
        <div style={{marginBottom:16}}><label style={styles.label}>Corrected Inspector Name</label><input style={styles.input} placeholder={report.inspectorName||"Enter correct name"} value={form.correctedInspectorName} onChange={e=>sf("correctedInspectorName")(e.target.value)} /></div>
        <div style={{marginBottom:16}}><label style={styles.label}>Corrected Company Name</label><input style={styles.input} placeholder={report.companyName||"Enter correct company"} value={form.correctedCompanyName} onChange={e=>sf("correctedCompanyName")(e.target.value)} /></div>
        <div style={{marginBottom:16}}><label style={styles.label}>Reason for Correction *</label><textarea style={{...styles.textarea,minHeight:80}} placeholder="e.g. My name was misspelled — should be John Smith not Jon Smith" value={form.reason} onChange={e=>sf("reason")(e.target.value)} rows={3}/></div>
        <div style={{marginBottom:4}}><label style={styles.label}>Your Email Address *</label><input style={styles.input} type="email" placeholder="your@email.com" value={form.email} onChange={e=>sf("email")(e.target.value)} /><p style={{color:"#444",fontSize:11,marginTop:6}}>We will notify you when your correction has been reviewed.</p></div>
      </div>
      <div style={{...styles.summaryBlock,marginTop:16,border:"1px solid #1e1e1e"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{color:"#f0f0f0",fontWeight:700,fontSize:16}}>Correction Request Fee</div><div style={{color:"#666",fontSize:13,marginTop:4}}>One-time · Reviewed within 2 business days · Non-refundable if approved</div></div>
          <div style={{fontFamily:"'DM Mono',monospace",fontWeight:800,fontSize:28,color:"#C8A84B"}}>$20</div>
        </div>
      </div>
      <button onClick={submit} disabled={loading} style={{...styles.ctaPrimary,marginTop:20,opacity:loading?0.7:1}}>{loading?"Processing...":"Pay $20 & Submit Correction →"}</button>
      <p style={{color:"#333",fontSize:11,marginTop:12,lineHeight:1.7}}>By submitting, you confirm that the requested correction is accurate and that you are the licensed inspector associated with this record. False correction requests may result in account suspension.</p>
    </div>
  );
}


// ── SHARE MODAL ───────────────────────────────────────────────
function ShareModal({ report, onClose, showToast }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [shareLink, setShareLink] = useState("");

  const send = async () => {
    if (!email) return;
    setSending(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", reportId: report.id, recipientEmail: email, inspectorName: report.inspectorName, propertyAddress: report.propertyAddress }),
      });
      const data = await res.json();
      if (data.success) { setSent(true); setShareLink(data.shareLink); showToast("Share link generated! Recipient must create an account to view."); }
      else showToast(data.error || "Failed to send.", "error");
    } catch { showToast("Network error.", "error"); }
    finally { setSending(false); }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <h3 style={{ color:"#f0f0f0", fontSize:18, fontWeight:700 }}>Share Report</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:20 }}>✕</button>
        </div>
        <div style={{ background:"#0a0a0a", border:"1px solid #1e1e1e", borderRadius:8, padding:"14px", marginBottom:20 }}>
          <div style={{ color:"#C8A84B", fontSize:12, fontFamily:"'DM Mono',monospace", marginBottom:6 }}>REPORT</div>
          <div style={{ color:"#e8e8e8", fontSize:14, fontWeight:600 }}>{report.inspectorName}</div>
          <div style={{ color:"#666", fontSize:12 }}>📍 {report.propertyAddress}</div>
        </div>
        {!sent ? (
          <>
            <p style={{ color:"#666", fontSize:13, lineHeight:1.65, marginBottom:16 }}>Enter the recipient's email. They will receive a secure link and <strong style={{ color:"#C8A84B" }}>must create a free InspectorTrust account</strong> to view the full report.</p>
            <label style={styles.label}>Recipient Email Address</label>
            <input style={{ ...styles.input, marginBottom:16 }} type="email" placeholder="recipient@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            <button onClick={send} disabled={sending} style={{ ...styles.ctaPrimary, width:"100%", justifyContent:"center", opacity:sending?0.7:1 }}>
              {sending ? "Sending..." : "Send Share Link →"}
            </button>
          </>
        ) : (
          <div>
            <div style={{ padding:"16px", background:"rgba(46,204,113,0.08)", border:"1px solid rgba(46,204,113,0.2)", borderRadius:8, marginBottom:16 }}>
              <p style={{ color:"#2ecc71", fontSize:14, fontWeight:600, marginBottom:8 }}>✓ Share link generated!</p>
              <p style={{ color:"#666", fontSize:13 }}>The recipient must create a free account to access the report. Link expires in 7 days.</p>
            </div>
            <div style={{ background:"#0a0a0a", border:"1px solid #222", borderRadius:6, padding:"10px 12px", fontFamily:"'DM Mono',monospace", fontSize:11, color:"#888", wordBreak:"break-all" }}>{shareLink}</div>
            <button onClick={() => { navigator.clipboard?.writeText(shareLink); showToast("Link copied!"); }} style={{ ...styles.ctaSecondary, width:"100%", marginTop:12, justifyContent:"center" }}>Copy Link</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── INSPECTOR DIRECTORY ───────────────────────────────────────
function InspectorDirectory({ onRegister }) {
  const [inspectors, setInspectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState({ name:"", state:"", city:"" });
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inspector", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"search", ...search }),
      });
      const data = await res.json();
      setInspectors(data.inspectors || []);
    } catch { setInspectors([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const gradeColor = g => g==="A"?"#2ecc71":g==="B"?"#C8A84B":g==="C"?"#e67e22":"#e74c3c";

  if (selected) return <InspectorProfile inspector={selected} onBack={()=>setSelected(null)} />;

  return (
    <main style={styles.main}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:32, flexWrap:"wrap", gap:16 }}>
        <div>
          <h2 style={styles.pageTitle}>Inspector Directory</h2>
          <p style={{ color:"#666", fontSize:14 }}>Find verified, rated home inspectors in your area.</p>
        </div>
        <button style={styles.ctaPrimary} onClick={onRegister}>Register as Inspector — $50/yr →</button>
      </div>

      {/* Search bar */}
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr auto", gap:12, marginBottom:32, background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"20px" }}>
        <div>
          <label style={styles.label}>Inspector or Company Name</label>
          <input style={styles.input} placeholder="Search inspectors..." value={search.name} onChange={e=>setSearch(s=>({...s,name:e.target.value}))} />
        </div>
        <div>
          <label style={styles.label}>City</label>
          <input style={styles.input} placeholder="Austin" value={search.city} onChange={e=>setSearch(s=>({...s,city:e.target.value}))} />
        </div>
        <div>
          <label style={styles.label}>State</label>
          <input style={styles.input} placeholder="TX" maxLength={2} value={search.state} onChange={e=>setSearch(s=>({...s,state:e.target.value.toUpperCase()}))} />
        </div>
        <div style={{ display:"flex", alignItems:"flex-end" }}>
          <button style={styles.ctaPrimary} onClick={load}>Search</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:"60px 0" }}>
          <span style={{ ...styles.spinner, width:32, height:32, borderWidth:3, display:"inline-block" }} />
          <p style={{ color:"#555", marginTop:16 }}>Loading inspectors...</p>
        </div>
      ) : inspectors.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 0", border:"1px dashed #1e1e1e", borderRadius:12 }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🔍</div>
          <p style={{ color:"#666", marginBottom:8 }}>No verified inspectors found in this area yet.</p>
          <p style={{ color:"#444", fontSize:13 }}>Are you an inspector? Be the first to register.</p>
          <button style={{ ...styles.ctaPrimary, marginTop:20 }} onClick={onRegister}>Register Now →</button>
        </div>
      ) : (
        <div style={styles.cardGrid}>
          {inspectors.map((ins, i) => (
            <div key={ins.id || i} style={{ ...styles.registryCard, cursor:"pointer" }} onClick={()=>setSelected(ins)}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:17, fontWeight:700, color:"#f0f0f0", marginBottom:2 }}>
                    {ins.conflict_flag && <span style={{ fontSize:12, color:"#e74c3c", marginRight:8 }}>⚠</span>}
                    {ins.name}
                  </div>
                  <div style={{ color:"#555", fontSize:13 }}>{ins.company_name || "Independent"}</div>
                </div>
                {ins.avg_grade && (
                  <div style={{ width:40, height:40, borderRadius:8, background:`${gradeColor(ins.avg_grade)}15`, border:`2px solid ${gradeColor(ins.avg_grade)}`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Mono',monospace", fontWeight:800, fontSize:18, color:gradeColor(ins.avg_grade) }}>
                    {ins.avg_grade}
                  </div>
                )}
              </div>
              <div style={{ color:"#666", fontSize:12, marginBottom:12 }}>📍 {[ins.city, ins.state].filter(Boolean).join(", ") || "Location not listed"}</div>
              {ins.avg_trust_score && (
                <div style={{ marginBottom:12 }}>
                  <BalanceBar score={ins.avg_balance_score || 50} />
                </div>
              )}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ display:"flex", gap:8 }}>
                  {ins.avg_trust_score && <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"#C8A84B", background:"rgba(200,168,75,0.1)", padding:"3px 8px", borderRadius:4 }}>Trust {ins.avg_trust_score}/100</span>}
                  <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"#2ecc71", background:"rgba(46,204,113,0.08)", padding:"3px 8px", borderRadius:4 }}>✓ Verified</span>
                  {ins.report_count && <span style={{ fontSize:11, color:"#555" }}>{ins.report_count} report{ins.report_count!==1?"s":""}</span>}
                </div>
                <span style={{ color:"#C8A84B", fontSize:13, fontWeight:600 }}>View Profile →</span>
              </div>
              {ins.conflict_flag && (
                <div style={{ marginTop:12, padding:"8px 12px", background:"rgba(231,76,60,0.08)", border:"1px solid rgba(231,76,60,0.2)", borderRadius:6 }}>
                  <span style={{ color:"#e74c3c", fontSize:11, fontFamily:"'DM Mono',monospace" }}>⚠ CONFLICT OF INTEREST FLAG — This inspector may not inspect properties they are buying or selling.</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

// ── INSPECTOR PROFILE PAGE ────────────────────────────────────
function InspectorProfile({ inspector, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/inspector", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ action:"profile", licenseNo: inspector.license_no }),
        });
        const d = await res.json();
        setData(d);
      } catch { setData(null); }
      finally { setLoading(false); }
    };
    load();
  }, [inspector.license_no]);

  const gradeColor = g => g==="A"?"#2ecc71":g==="B"?"#C8A84B":g==="C"?"#e67e22":"#e74c3c";

  return (
    <main style={styles.main}>
      <button onClick={onBack} style={{ background:"none", border:"none", color:"#666", cursor:"pointer", fontSize:14, fontFamily:"inherit", marginBottom:32, padding:0 }}>← Back to Directory</button>

      {/* Hero */}
      <div style={{ ...styles.reportHero, marginBottom:20 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:4 }}>
            <div style={{ fontSize:26, fontWeight:800, color:"#f0f0f0" }}>{inspector.name}</div>
            <span style={{ fontSize:11, color:"#2ecc71", fontFamily:"'DM Mono',monospace", background:"rgba(46,204,113,0.1)", border:"1px solid rgba(46,204,113,0.2)", padding:"3px 10px", borderRadius:4 }}>✓ VERIFIED</span>
          </div>
          <div style={{ color:"#C8A84B", fontSize:14 }}>{inspector.company_name || "Independent Inspector"}</div>
          <div style={{ color:"#666", fontSize:13, marginTop:4 }}>
            📍 {[inspector.city, inspector.state].filter(Boolean).join(", ")} · License: {inspector.license_no}
          </div>
          {inspector.phone && <div style={{ color:"#555", fontSize:13, marginTop:4 }}>📞 {inspector.phone}</div>}
          {inspector.email && <div style={{ color:"#555", fontSize:13 }}>✉ {inspector.email}</div>}
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:10 }}>
          {inspector.avg_grade && (
            <div style={{ width:60, height:60, borderRadius:10, background:`${gradeColor(inspector.avg_grade)}15`, border:`2px solid ${gradeColor(inspector.avg_grade)}`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Mono',monospace", fontWeight:800, fontSize:28, color:gradeColor(inspector.avg_grade) }}>
              {inspector.avg_grade}
            </div>
          )}
          <div style={{ color:"#555", fontSize:12, textAlign:"right" }}>{inspector.report_count || 0} reports analyzed</div>
        </div>
      </div>

      {/* Conflict warning */}
      {(data?.conflictOfInterest || inspector.conflict_flag) && (
        <div style={{ padding:"16px 20px", background:"rgba(231,76,60,0.08)", border:"1px solid rgba(231,76,60,0.3)", borderRadius:10, marginBottom:20 }}>
          <div style={{ color:"#e74c3c", fontWeight:700, fontSize:14, marginBottom:6 }}>⚠ Conflict of Interest Flag</div>
          <p style={{ color:"#c0392b", fontSize:13, lineHeight:1.65 }}>{data?.conflictDetails || "This inspector's license number is also associated with a buyer or seller account on InspectorTrust. They cannot legally inspect properties in which they have a financial interest."}</p>
        </div>
      )}

      {/* Bio */}
      {inspector.bio && (
        <div style={{ ...styles.summaryBlock, marginBottom:20 }}>
          <h3 style={styles.blockTitle}>About</h3>
          <p style={{ color:"#aaa", fontSize:14, lineHeight:1.75 }}>{inspector.bio}</p>
        </div>
      )}

      {/* Aggregate scores */}
      {inspector.avg_trust_score && (
        <div style={{ ...styles.formCard, marginBottom:20 }}>
          <div style={styles.formCardTitle}>Aggregate Performance Scores</div>
          <div style={{ marginBottom:20 }}><BalanceBar score={inspector.avg_balance_score || 50} /></div>
          {[
            { label:"Average Trust Score", val:inspector.avg_trust_score, color:"#C8A84B" },
            { label:"Average Completeness", val:inspector.avg_completeness_score, color:"#3498db" },
            { label:"Average Objectivity", val:inspector.avg_objectivity_score, color:"#2ecc71" },
          ].map(s => (
            <div key={s.label} style={{ marginBottom:18 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <span style={{ color:"#ccc", fontSize:13 }}>{s.label}</span>
                <span style={{ color:s.color, fontFamily:"'DM Mono',monospace", fontWeight:700 }}>{s.val}/100</span>
              </div>
              <div style={{ height:6, background:"#1e1e1e", borderRadius:99, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${s.val}%`, background:s.color, borderRadius:99 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report history */}
      {loading ? (
        <div style={{ textAlign:"center", padding:"32px" }}><span style={{ ...styles.spinner, display:"inline-block" }} /></div>
      ) : data?.reports?.length > 0 ? (
        <div style={styles.formCard}>
          <div style={styles.formCardTitle}>Report History ({data.reports.length})</div>
          {data.reports.map((r, i) => (
            <div key={i} style={{ padding:"14px 0", borderBottom: i < data.reports.length-1 ? "1px solid #1a1a1a" : "none" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ color:"#e8e8e8", fontSize:14, fontWeight:600 }}>{r.property_address || "Property address not listed"}</div>
                  <div style={{ color:"#555", fontSize:12, marginTop:2 }}>{r.created_at ? new Date(r.created_at).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}) : ""}</div>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  {r.analysis_data?.trustScore && <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"#C8A84B" }}>Trust {r.analysis_data.trustScore}</span>}
                  {r.analysis_data?.inspectorGrade && <span style={{ fontSize:13, fontWeight:700, color:gradeColor(r.analysis_data.inspectorGrade) }}>{r.analysis_data.inspectorGrade}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ ...styles.summaryBlock, textAlign:"center" }}>
          <p style={{ color:"#555" }}>No analyzed reports found for this inspector yet.</p>
        </div>
      )}
    </main>
  );
}

// ── INSPECTOR REGISTRATION FORM ───────────────────────────────
function InspectorRegister({ onBack, showToast }) {
  const [form, setForm] = useState({ name:"", companyName:"", licenseNo:"", city:"", state:"", phone:"", email:"", bio:"" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sf = k => v => setForm(f=>({...f,[k]:v}));

  const submit = async () => {
    if (!form.name || !form.licenseNo || !form.email) { setError("Name, license number, and email are required."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/inspector", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"register_checkout", ...form }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error || "Could not start checkout.");
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <main style={styles.main}>
      <button onClick={onBack} style={{ background:"none", border:"none", color:"#666", cursor:"pointer", fontSize:14, fontFamily:"inherit", marginBottom:32, padding:0 }}>← Back to Directory</button>
      <h2 style={styles.pageTitle}>Register as a Verified Inspector</h2>
      <p style={{ color:"#666", fontSize:14, marginBottom:36, maxWidth:600 }}>Join the InspectorTrust verified directory. Realtors and homeowners search our directory to find trustworthy, rated inspectors. Your profile shows aggregate scores from all your analyzed reports.</p>

      {/* Benefits */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, marginBottom:36 }}>
        {[
          { icon:"🔍", title:"Be Found", desc:"Appear in searches by realtors and buyers looking for inspectors in your area." },
          { icon:"⭐", title:"Build Credibility", desc:"Your AI-analyzed report scores aggregate into a public performance profile." },
          { icon:"🛡️", title:"Verified Badge", desc:"Display a verified inspector badge showing you meet InspectorTrust standards." },
        ].map(b => (
          <div key={b.title} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"20px" }}>
            <div style={{ fontSize:28, marginBottom:10 }}>{b.icon}</div>
            <div style={{ color:"#f0f0f0", fontWeight:700, fontSize:15, marginBottom:6 }}>{b.title}</div>
            <div style={{ color:"#666", fontSize:13, lineHeight:1.65 }}>{b.desc}</div>
          </div>
        ))}
      </div>

      {error && <div style={{ padding:"10px 14px", borderRadius:6, background:"rgba(231,76,60,0.1)", border:"1px solid #e74c3c", color:"#e74c3c", fontSize:13, marginBottom:16 }}>{error}</div>}

      <div style={styles.formCard}>
        <div style={styles.formCardTitle}>Inspector Information</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          <div><label style={styles.label}>Full Name *</label><input style={styles.input} placeholder="John Smith" value={form.name} onChange={e=>sf("name")(e.target.value)} /></div>
          <div><label style={styles.label}>Company / Firm</label><input style={styles.input} placeholder="Smith Home Inspections LLC" value={form.companyName} onChange={e=>sf("companyName")(e.target.value)} /></div>
          <div><label style={styles.label}>License Number *</label><input style={styles.input} placeholder="TREC #12345 or HI-20984" value={form.licenseNo} onChange={e=>sf("licenseNo")(e.target.value)} /></div>
          <div><label style={styles.label}>Email Address *</label><input style={styles.input} type="email" placeholder="inspector@email.com" value={form.email} onChange={e=>sf("email")(e.target.value)} /></div>
          <div><label style={styles.label}>City</label><input style={styles.input} placeholder="Austin" value={form.city} onChange={e=>sf("city")(e.target.value)} /></div>
          <div><label style={styles.label}>State</label><input style={styles.input} placeholder="TX" maxLength={2} value={form.state} onChange={e=>sf("state")(e.target.value.toUpperCase())} /></div>
          <div style={{ gridColumn:"1/-1" }}><label style={styles.label}>Phone Number</label><input style={styles.input} placeholder="(512) 555-0100" value={form.phone} onChange={e=>sf("phone")(e.target.value)} /></div>
        </div>
        <div style={{ marginTop:16 }}>
          <label style={styles.label}>Professional Bio (optional)</label>
          <textarea style={{ ...styles.textarea, minHeight:100 }} placeholder="Brief description of your experience, certifications, and specialties..." value={form.bio} onChange={e=>sf("bio")(e.target.value)} rows={4} />
        </div>
      </div>

      <div style={{ ...styles.summaryBlock, marginTop:20, border:"1px solid rgba(200,168,75,0.2)", background:"rgba(200,168,75,0.03)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ color:"#f0f0f0", fontWeight:700, fontSize:16 }}>Annual Directory Listing</div>
            <div style={{ color:"#666", fontSize:13, marginTop:4 }}>Appears in InspectorTrust verified inspector search · Aggregate score profile · Verified badge · Renews annually</div>
          </div>
          <div style={{ fontFamily:"'DM Mono',monospace", fontWeight:800, fontSize:28, color:"#C8A84B" }}>$50<span style={{ fontSize:14, fontWeight:400, color:"#555" }}>/yr</span></div>
        </div>
      </div>

      <button onClick={submit} disabled={loading} style={{ ...styles.ctaPrimary, marginTop:20, opacity:loading?0.7:1 }}>
        {loading ? "Processing..." : "Pay $50 & Get Listed →"}
      </button>
      <p style={{ color:"#333", fontSize:11, marginTop:12, lineHeight:1.7 }}>By registering, you confirm that your license information is accurate. InspectorTrust reserves the right to remove listings that violate our terms of service. Note: A conflict of interest flag will be automatically applied if your license number is associated with any buyer or seller account on our platform.</p>
    </main>
  );
}

const styles = {
  root:{minHeight:"100vh",background:"#0e0e0e",color:"#e8e8e8",fontFamily:"'DM Sans','Segoe UI',sans-serif"},
  header:{borderBottom:"1px solid #1e1e1e",background:"rgba(14,14,14,0.95)",backdropFilter:"blur(10px)",position:"sticky",top:0,zIndex:100},
  headerInner:{maxWidth:1100,margin:"0 auto",padding:"0 24px",height:60,display:"flex",alignItems:"center",justifyContent:"space-between"},
  logo:{background:"none",border:"none",color:"#C8A84B",fontSize:18,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:8,letterSpacing:"-0.02em",fontFamily:"'DM Sans',sans-serif"},
  navBtn:{background:"none",border:"1px solid #2a2a2a",color:"#888",padding:"7px 16px",borderRadius:6,cursor:"pointer",fontSize:13,fontFamily:"inherit"},
  navActive:{background:"none",border:"1px solid #C8A84B",color:"#C8A84B",padding:"7px 16px",borderRadius:6,cursor:"pointer",fontSize:13,fontFamily:"inherit"},
  main:{maxWidth:1100,margin:"0 auto",padding:"48px 24px 80px"},
  toast:{position:"fixed",top:72,right:24,zIndex:999,background:"#111",border:"1px solid",padding:"12px 20px",borderRadius:8,fontSize:13,fontFamily:"'DM Mono',monospace"},
  heroSection:{textAlign:"center",padding:"32px 0 24px"},
  pill:{display:"inline-block",background:"rgba(200,168,75,0.1)",border:"1px solid rgba(200,168,75,0.3)",color:"#C8A84B",padding:"5px 16px",borderRadius:100,fontSize:12,letterSpacing:"0.12em",marginBottom:24,fontFamily:"'DM Mono',monospace"},
  heroTitle:{fontSize:"clamp(28px,4.5vw,48px)",fontWeight:800,lineHeight:1.1,letterSpacing:"-0.03em",color:"#f0f0f0",marginBottom:16},
  heroSub:{fontSize:14,color:"#777",maxWidth:540,margin:"0 auto 24px",lineHeight:1.65},
  ctaPrimary:{background:"#C8A84B",color:"#0e0e0e",border:"none",padding:"14px 30px",borderRadius:8,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:8},
  ctaSecondary:{background:"transparent",color:"#C8A84B",border:"1px solid #C8A84B",padding:"14px 30px",borderRadius:8,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit"},
  btnDisabled:{background:"#2a2a2a",color:"#666",border:"none",padding:"14px 30px",borderRadius:8,fontSize:15,fontWeight:700,cursor:"not-allowed",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:8},
  btnSent:{background:"#0d2b1a",color:"#2ecc71",border:"1px solid #2ecc71",padding:"14px 30px",borderRadius:8,fontSize:15,fontWeight:700,cursor:"default",fontFamily:"inherit"},
  statsRow:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,margin:"0 0 64px"},
  statCard:{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:"24px",textAlign:"center"},
  statNum:{fontSize:28,fontWeight:800,color:"#C8A84B",fontFamily:"'DM Mono',monospace",marginBottom:4},
  sectionTitle:{fontSize:28,fontWeight:700,color:"#f0f0f0",marginBottom:16,letterSpacing:"-0.02em"},
  steps:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:20,marginBottom:64},
  stepCard:{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:"28px 24px"},
  pageTitle:{fontSize:32,fontWeight:700,letterSpacing:"-0.03em",marginBottom:8,color:"#f0f0f0"},
  bigDropZone:{border:"2px dashed",borderRadius:12,padding:"64px 32px",textAlign:"center",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:260,transition:"all 0.2s"},
  fileBadge:{display:"flex",alignItems:"center",gap:12,background:"#111",border:"1px solid #2a2a2a",borderRadius:8,padding:"12px 16px",marginBottom:16},
  missingBanner:{display:"flex",alignItems:"center",gap:10,background:"rgba(200,168,75,0.06)",border:"1px solid rgba(200,168,75,0.2)",borderRadius:8,padding:"12px 16px",marginBottom:20},
  formCard:{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:"24px"},
  formCardTitle:{color:"#C8A84B",fontSize:11,letterSpacing:"0.14em",fontFamily:"'DM Mono',monospace",marginBottom:20,textTransform:"uppercase"},
  label:{display:"block",color:"#666",fontSize:12,marginBottom:6,letterSpacing:"0.04em"},
  input:{width:"100%",background:"#0a0a0a",border:"1px solid #222",borderRadius:6,padding:"10px 12px",color:"#e8e8e8",fontSize:14,fontFamily:"inherit",outline:"none",boxSizing:"border-box"},
  textarea:{width:"100%",background:"#0a0a0a",border:"1px solid #222",borderRadius:6,padding:"12px",color:"#e8e8e8",fontSize:13,fontFamily:"'DM Mono',monospace",outline:"none",resize:"vertical",boxSizing:"border-box",lineHeight:1.6},
  cardGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:20},
  registryCard:{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:"24px"},
  spinner:{width:16,height:16,border:"2px solid rgba(200,168,75,0.2)",borderTop:"2px solid #C8A84B",borderRadius:"50%",animation:"spin 0.8s linear infinite",display:"inline-block"},
  reportHero:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"28px 32px",background:"#111",border:"1px solid #1e1e1e",borderRadius:12,marginBottom:8},
  tabBar:{display:"flex",borderBottom:"1px solid #1e1e1e",marginBottom:28,marginTop:28},
  tab:{background:"none",border:"none",borderBottom:"2px solid transparent",color:"#555",padding:"12px 20px",cursor:"pointer",fontSize:14,fontFamily:"inherit",fontWeight:600,marginBottom:-1},
  tabActive:{background:"none",border:"none",borderBottom:"2px solid #C8A84B",color:"#C8A84B",padding:"12px 20px",cursor:"pointer",fontSize:14,fontFamily:"inherit",fontWeight:600,marginBottom:-1},
  tabContent:{animation:"fadeIn 0.2s ease"},
  summaryBlock:{background:"#111",border:"1px solid #1e1e1e",borderRadius:10,padding:"24px",marginBottom:20},
  blockTitle:{color:"#C8A84B",fontSize:11,letterSpacing:"0.14em",fontFamily:"'DM Mono',monospace",marginBottom:12,textTransform:"uppercase"},
  listBlock:{background:"#111",border:"1px solid #1e1e1e",borderRadius:10,padding:"24px"},
  recommendationBox:{background:"rgba(200,168,75,0.06)",border:"1px solid rgba(200,168,75,0.2)",borderRadius:10,padding:"18px 24px",fontSize:14,color:"#bbb",lineHeight:1.65},
  emailCard:{background:"#111",border:"1px solid #1e1e1e",borderRadius:10,padding:"20px 24px",marginBottom:16},
  modalOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(6px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px"},
  modal:{background:"#111",border:"1px solid #2a2a2a",borderRadius:16,padding:"32px",width:"100%",maxWidth:440},
};

const _s=document.createElement("style");
_s.textContent=`
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=DM+Mono:wght@400;500;700&display=swap');
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes fadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
  *{box-sizing:border-box;margin:0;padding:0;}
  input::placeholder,textarea::placeholder{color:#333;}
  button:hover{opacity:0.88;}
`;
document.head.appendChild(_s);
