import { useState, useRef, useEffect } from "react";

// ── helpers ───────────────────────────────────────────────────
function generateId() { return Math.random().toString(36).slice(2, 10); }

function getSession() {
  try { return JSON.parse(localStorage.getItem("ci_session") || "null"); } catch { return null; }
}
function saveSession(s) { localStorage.setItem("ci_session", JSON.stringify(s)); }
function clearSession() { localStorage.removeItem("ci_session"); }

// ── sub-components ────────────────────────────────────────────
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
      if (!res.ok) { setError(data.error || "Something went wrong"); return; }
      if (tab === "signup") {
        setTab("signin");
        setError("Account created! Please sign in.");
        return;
      }
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
          <div style={{ display:"flex", gap:0 }}>
            {["signin","signup"].map(t=>(
              <button key={t} onClick={()=>{setTab(t);setError("");}} style={{ background:"none", border:"none", borderBottom:`2px solid ${tab===t?"#C8A84B":"transparent"}`, color:tab===t?"#C8A84B":"#555", padding:"8px 20px", cursor:"pointer", fontSize:14, fontWeight:600, fontFamily:"inherit" }}>
                {t==="signin"?"Sign In":"Create Account"}
              </button>
            ))}
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:20, lineHeight:1 }}>✕</button>
        </div>

        {error && <div style={{ padding:"10px 14px", borderRadius:6, background:error.includes("created")?"rgba(46,204,113,0.1)":"rgba(231,76,60,0.1)", border:`1px solid ${error.includes("created")?"#2ecc71":"#e74c3c"}`, color:error.includes("created")?"#2ecc71":"#e74c3c", fontSize:13, marginBottom:16 }}>{error}</div>}

        {tab==="signup" && (
          <div style={{ marginBottom:14 }}>
            <label style={styles.label}>Full Name</label>
            <input style={styles.input} placeholder="Jane Smith" value={form.name} onChange={e=>sf("name")(e.target.value)} />
          </div>
        )}

        <div style={{ marginBottom:14 }}>
          <label style={styles.label}>Email</label>
          <input style={styles.input} type="email" placeholder="you@email.com" value={form.email} onChange={e=>sf("email")(e.target.value)} />
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={styles.label}>Password</label>
          <input style={styles.input} type="password" placeholder="••••••••" value={form.password} onChange={e=>sf("password")(e.target.value)} />
        </div>

        {tab==="signup" && (
          <>
            <div style={{ marginBottom:14 }}>
              <label style={styles.label}>I am a...</label>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginTop:6 }}>
                {["buyer","seller","realtor"].map(r=>(
                  <button key={r} onClick={()=>sf("role")(r)} style={{ padding:"10px", borderRadius:6, border:`1.5px solid ${form.role===r?"#C8A84B":"#222"}`, background:form.role===r?"rgba(200,168,75,0.1)":"#0a0a0a", color:form.role===r?"#C8A84B":"#555", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"inherit", textTransform:"capitalize" }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {form.role==="realtor" && (
              <div style={{ marginBottom:14 }}>
                <label style={styles.label}>Realtor License Number *</label>
                <input style={styles.input} placeholder="e.g. TX-12345678" value={form.licenseNumber} onChange={e=>sf("licenseNumber")(e.target.value)} />
                <p style={{ color:"#555", fontSize:11, marginTop:6 }}>Required for realtor accounts. Get 14-day free trial, then $20/year. Upload 20+ inspections and your first year is free!</p>
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
          {loading ? "Please wait..." : tab==="signin" ? "Sign In →" : "Create Account →"}
        </button>
      </div>
    </div>
  );
}

// ── ACCOUNT PAGE ──────────────────────────────────────────────
function AccountPage({ profile, token, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const trialStart = profile?.trial_started_at ? new Date(profile.trial_started_at) : null;
  const daysLeft = trialStart ? Math.max(0, 14 - Math.floor((Date.now()-trialStart)/(1000*60*60*24))) : null;
  const isRealtor = profile?.role === "realtor";
  const status = profile?.subscription_status;
  const inspCount = profile?.inspection_count || 0;
  const freeByVolume = inspCount >= 20;

  const startCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing", {
        method:"POST", headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},
        body: JSON.stringify({ action:"checkout" }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setMsg(data.error || "Could not start checkout");
    } catch { setMsg("Network error"); }
    finally { setLoading(false); }
  };

  const openPortal = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing", {
        method:"POST", headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},
        body: JSON.stringify({ action:"portal" }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setMsg(data.error || "Could not open billing portal");
    } catch { setMsg("Network error"); }
    finally { setLoading(false); }
  };

  const statusColor = status==="active"?"#2ecc71":status==="trial"?"#C8A84B":"#e74c3c";
  const statusLabel = status==="active"?"Active":status==="trial"?`Trial (${daysLeft} days left)`:"Expired";

  return (
    <main style={styles.main}>
      <h2 style={styles.pageTitle}>My Account</h2>
      {msg && <div style={{ padding:"12px 16px", borderRadius:8, background:"rgba(231,76,60,0.1)", border:"1px solid #e74c3c", color:"#e74c3c", fontSize:13, marginBottom:20 }}>{msg}</div>}

      {/* Profile card */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
        <div style={styles.formCard}>
          <div style={styles.formCardTitle}>Profile</div>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {[["Name", profile?.name],["Email", profile?.email],["Role", profile?.role],["License", profile?.license_number||"N/A"]].map(([l,v])=>(
              <div key={l}>
                <div style={{ color:"#555", fontSize:11, letterSpacing:"0.08em", marginBottom:3 }}>{l.toUpperCase()}</div>
                <div style={{ color:"#e8e8e8", fontSize:14, fontFamily:l==="License"?"'DM Mono',monospace":"inherit", textTransform:l==="Role"?"capitalize":"none" }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Subscription card */}
        {isRealtor && (
          <div style={styles.formCard}>
            <div style={styles.formCardTitle}>Subscription</div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:statusColor }} />
              <span style={{ color:statusColor, fontWeight:700, fontSize:15 }}>{statusLabel}</span>
            </div>

            {/* Inspection progress bar */}
            <div style={{ marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <span style={{ color:"#666", fontSize:12 }}>Inspections uploaded</span>
                <span style={{ color:"#C8A84B", fontFamily:"'DM Mono',monospace", fontSize:12 }}>{inspCount}/20</span>
              </div>
              <div style={{ height:6, background:"#1e1e1e", borderRadius:99, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${Math.min(100,(inspCount/20)*100)}%`, background:freeByVolume?"#2ecc71":"#C8A84B", borderRadius:99 }} />
              </div>
              {freeByVolume
                ? <p style={{ color:"#2ecc71", fontSize:11, marginTop:6 }}>✓ Free for your first year — thank you for contributing!</p>
                : <p style={{ color:"#555", fontSize:11, marginTop:6 }}>Upload {20-inspCount} more inspections to earn a free first year.</p>
              }
            </div>

            {status==="active" && (
              <button onClick={openPortal} disabled={loading} style={styles.ctaSecondary}>
                {loading?"Loading...":"Manage Billing →"}
              </button>
            )}
            {(status==="trial"||status==="expired") && !freeByVolume && (
              <div>
                {status==="expired" && <div style={{ padding:"10px 14px", borderRadius:6, background:"rgba(231,76,60,0.1)", border:"1px solid #e74c3c", color:"#e74c3c", fontSize:12, marginBottom:14 }}>Your trial has expired. Subscribe to continue uploading reports.</div>}
                <button onClick={startCheckout} disabled={loading} style={styles.ctaPrimary}>
                  {loading?"Loading...":"Subscribe — $20/year →"}
                </button>
              </div>
            )}
          </div>
        )}

        {!isRealtor && (
          <div style={styles.formCard}>
            <div style={styles.formCardTitle}>Your Plan</div>
            <div style={{ padding:"16px", borderRadius:8, background:"rgba(46,204,113,0.05)", border:"1px solid rgba(46,204,113,0.15)" }}>
              <p style={{ color:"#2ecc71", fontSize:14, fontWeight:600 }}>✓ Free — Buyer/Seller</p>
              <p style={{ color:"#555", fontSize:13, marginTop:8, lineHeight:1.6 }}>Browse the inspector registry and view public performance reviews. Uploading reports requires a Realtor account.</p>
            </div>
          </div>
        )}
      </div>

      {/* Pricing info */}
      {isRealtor && (
        <div style={{ ...styles.formCard, background:"rgba(200,168,75,0.04)", border:"1px solid rgba(200,168,75,0.15)" }}>
          <div style={styles.formCardTitle}>Pricing Summary</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
            {[
              { label:"14-Day Trial", desc:"Full access, no credit card needed", color:"#C8A84B" },
              { label:"$20 / Year", desc:"After trial ends — full realtor access", color:"#3498db" },
              { label:"Free First Year", desc:"Upload 20+ inspections and year 1 is on us", color:"#2ecc71" },
            ].map(p=>(
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
  const [session, setSession] = useState(null); // { token, profile }
  const fileRef = useRef();

  const [form, setForm] = useState({ inspectorName:"", companyName:"", licenseNo:"", street:"", city:"", state:"", zip:"", buyerEmail:"", sellerEmail:"", realtorEmail:"", reportText:"", fileName:"" });
  const [missing, setMissing] = useState({});

  // Load session on mount
  useEffect(() => {
    const s = getSession();
    if (s) setSession(s);
  }, []);

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };
  const setField = k => v => setForm(f=>({...f,[k]:v}));

  const onAuth = (profile, token) => { const s={token,profile}; saveSession(s); setSession(s); };
  const signOut = () => { clearSession(); setSession(null); setView("home"); showToast("Signed out."); };

  // ── Extract text from PDF using PDF.js ──────────────────────
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
      const res = await fetch("/api/analyze", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ mode:"parse", reportText: text.slice(0,4000) }),
      });
      const data = await res.json();
      const p = data.parsed || {};
      const newForm = {
        inspectorName: p.inspectorName||"", companyName: p.companyName||"", licenseNo: p.licenseNo||"",
        street: p.street||"", city: p.city||"", state: p.state||"", zip: p.zip||"",
        buyerEmail: p.buyerEmail||"", sellerEmail: p.sellerEmail||"", realtorEmail: p.realtorEmail||"",
        reportText: text, fileName,
      };
      setForm(newForm);
      const m = {};
      ["inspectorName","street","city","state","zip"].forEach(k => { if (!newForm[k]) m[k]=true; });
      setMissing(m);
      setUploadStep(1);
    } catch {
      showToast("Could not auto-parse report. Please fill in details manually.", "error");
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
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        text = await extractPdfText(file);
      } else {
        text = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = ev => res(ev.target.result);
          reader.onerror = rej;
          reader.readAsText(file);
        });
      }
      if (!text || text.trim().length < 20) {
        showToast("Could not read text from this file. Try pasting the report text instead.", "error");
        setParsing(false);
        return;
      }
      await parseReport(text, file.name);
    } catch(e) {
      showToast("File read failed. Please paste the report text instead.", "error");
      setParsing(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleAnalyze = async () => {
    if (!session?.token) { setShowAuth(true); return; }
    const profile = session.profile;
    if (profile?.role === "realtor" && profile?.subscription_status === "expired") {
      setView("account"); showToast("Your trial has expired. Please subscribe to continue.", "error"); return;
    }
    if (!form.inspectorName || !form.street || !form.reportText) {
      showToast("Inspector name and street address are required.", "error"); return;
    }
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
        throw new Error(data.error||"Analysis failed");
      }
      const newReport = { id:generateId(), ...form, propertyAddress:addr, analysis:data.analysis, date:new Date().toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}) };
      setReports(r=>[newReport,...r]);
      setAnalysisResult(newReport);
      setView("report"); setUploadStep(0);
      setForm({inspectorName:"",companyName:"",licenseNo:"",street:"",city:"",state:"",zip:"",buyerEmail:"",sellerEmail:"",realtorEmail:"",reportText:"",fileName:""});
      showToast("Report analyzed successfully.");
      // Update local profile inspection count
      if (session.profile) {
        const updated = {...session.profile, inspection_count:(session.profile.inspection_count||0)+1};
        const newSession = {...session, profile:updated};
        saveSession(newSession); setSession(newSession);
      }
    } catch(err) { showToast("Analysis failed: "+err.message,"error"); setUploadStep(1); }
    finally { setUploading(false); }
  };

  const sendEmails = async () => { setEmailSending(true); await new Promise(r=>setTimeout(r,1800)); setEmailSending(false); setEmailSent(true); showToast("Email summaries dispatched."); };
  const viewReport = (r) => { setAnalysisResult(r); setEmailSent(false); setView("report"); };

  const canUpload = !session || session.profile?.role !== "realtor" || ["trial","active"].includes(session.profile?.subscription_status) || (session.profile?.inspection_count||0)>=20;

  return (
    <div style={styles.root}>
      {toast && <div style={{...styles.toast,borderColor:toast.type==="error"?"#e74c3c":"#C8A84B",color:toast.type==="error"?"#e74c3c":"#C8A84B"}}>{toast.msg}</div>}
      {showAuth && <AuthModal onClose={()=>setShowAuth(false)} onAuth={onAuth} />}

      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <button onClick={()=>setView("home")} style={styles.logo}>▲ ClearInspect</button>
          <nav style={{display:"flex",gap:8,alignItems:"center"}}>
            <button style={view==="upload"?styles.navActive:styles.navBtn} onClick={()=>{setView("upload");setUploadStep(0);}}>Upload Report</button>
            <button style={view==="database"?styles.navActive:styles.navBtn} onClick={()=>setView("database")}>Registry ({reports.length})</button>
            {session ? (
              <>
                <button style={view==="account"?styles.navActive:styles.navBtn} onClick={()=>setView("account")}>
                  Account {session.profile?.subscription_status==="trial"?"🕐":session.profile?.subscription_status==="expired"?"⚠️":""}
                </button>
                <button style={{...styles.navBtn,color:"#555"}} onClick={signOut}>Sign Out</button>
              </>
            ) : (
              <button style={styles.ctaPrimary} onClick={()=>setShowAuth(true)}>Sign In →</button>
            )}
          </nav>
        </div>
      </header>

      {/* HOME */}
      {view==="home" && (
        <main style={styles.main}>
          <div style={styles.heroSection}>
            <div style={styles.pill}>AI-Powered · Real Estate Transparency</div>
            <h1 style={styles.heroTitle}>The Truth About<br /><span style={{color:"#C8A84B",display:"block"}}>Your Inspector</span></h1>
            <p style={styles.heroSub}>Upload any inspection report. Our AI reads it, extracts all the details automatically, and generates a full fraud-risk performance review — no typing required.</p>
            <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap"}}>
              <button style={styles.ctaPrimary} onClick={()=>{session?setView("upload"):setShowAuth(true);}}>
                {session?"Analyze a Report →":"Sign In to Analyze →"}
              </button>
              <button style={styles.ctaSecondary} onClick={()=>setView("database")}>View Registry</button>
            </div>
          </div>

          <div style={styles.statsRow}>
            {[{n:"1 in 4",l:"inspectors flagged for bias"},{n:"14-day",l:"free trial for realtors"},{n:"$20/yr",l:"after trial"},{n:"Free",l:"upload 20+ inspections"}].map(s=>(
              <div key={s.l} style={styles.statCard}><div style={styles.statNum}>{s.n}</div><div style={{color:"#555",fontSize:12,letterSpacing:"0.08em"}}>{s.l}</div></div>
            ))}
          </div>

          {/* Pricing section */}
          <div style={{marginBottom:64}}>
            <h2 style={styles.sectionTitle}>Simple Pricing</h2>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:20}}>
              {[
                {title:"Buyer / Seller",price:"Free",color:"#2ecc71",features:["Browse inspector registry","View public reports","No account required to search"]},
                {title:"Realtor Trial",price:"14 Days Free",color:"#C8A84B",features:["Upload & analyze reports","Full AI performance reviews","Auto email all parties","PDF export"]},
                {title:"Realtor Annual",price:"$20 / year",color:"#3498db",features:["Everything in trial","Unlimited reports","Upload 20+ reports = free first year","Priority support"]},
              ].map(p=>(
                <div key={p.title} style={{...styles.stepCard,border:`1px solid ${p.color}33`}}>
                  <div style={{color:p.color,fontSize:11,letterSpacing:"0.14em",fontFamily:"'DM Mono',monospace",marginBottom:8}}>{p.title.toUpperCase()}</div>
                  <div style={{fontSize:24,fontWeight:800,color:"#f0f0f0",marginBottom:16}}>{p.price}</div>
                  {p.features.map(f=><div key={f} style={{color:"#777",fontSize:13,marginBottom:8,display:"flex",gap:8}}><span style={{color:p.color}}>✓</span>{f}</div>)}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 style={styles.sectionTitle}>How It Works</h2>
            <div style={styles.steps}>
              {[{n:"01",t:"Drop Your Report",b:"Upload any inspection report. Our AI reads it instantly — PDF, Word, or text."},{n:"02",t:"Confirm Details",b:"We auto-fill everything we find. You only fill in what's missing."},{n:"03",t:"Get the Review",b:"Full inspector performance dossier with fraud risk score, grade, and analysis."},{n:"04",t:"Notify All Parties",b:"Buyer, seller, and realtor each get a tailored AI-written email summary."}].map(s=>(
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

      {/* UPLOAD */}
      {view==="upload" && (
        <main style={styles.main}>
          <div style={{maxWidth:700,margin:"0 auto"}}>
            <h2 style={styles.pageTitle}>Submit Inspection Report</h2>
            <p style={{color:"#666",fontSize:14,marginBottom:36}}>
              {uploadStep===0?"Drop your report and we'll handle the rest.":uploadStep===1?"We've extracted what we could. Fill in anything missing.":"Analyzing with AI..."}
            </p>

            {/* Trial warning banner */}
            {session?.profile?.role==="realtor" && session?.profile?.subscription_status==="trial" && (
              <div style={{display:"flex",alignItems:"center",gap:12,background:"rgba(200,168,75,0.06)",border:"1px solid rgba(200,168,75,0.2)",borderRadius:8,padding:"12px 16px",marginBottom:24}}>
                <span>🕐</span>
                <span style={{color:"#C8A84B",fontSize:13}}>
                  Trial active — {Math.max(0,14-Math.floor((Date.now()-new Date(session.profile.trial_started_at))/(1000*60*60*24)))} days remaining.
                  {" "}<button onClick={()=>setView("account")} style={{background:"none",border:"none",color:"#C8A84B",cursor:"pointer",fontSize:13,textDecoration:"underline"}}>Manage subscription →</button>
                </span>
              </div>
            )}

            <StepIndicator step={uploadStep} />

            {uploadStep===0 && (
              <div>
                <div
                  style={{...styles.bigDropZone,borderColor:dragOver?"#C8A84B":"#2a2a2a",background:dragOver?"rgba(200,168,75,0.05)":"#0a0a0a"}}
                  onDragOver={e=>{e.preventDefault();setDragOver(true);}}
                  onDragLeave={()=>setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={()=>fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" accept=".txt,.pdf,.doc,.docx" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])} />
                  {parsing?(
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
                      <span style={{...styles.spinner,width:32,height:32,borderWidth:3}}/>
                      <span style={{color:"#C8A84B",fontSize:14,fontFamily:"'DM Mono',monospace"}}>Reading report...</span>
                    </div>
                  ):(
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
                      <span style={{fontSize:52}}>📋</span>
                      <span style={{color:"#C8A84B",fontSize:16,fontWeight:700}}>Drop your inspection report here</span>
                      <span style={{color:"#555",fontSize:13}}>or click to browse · .txt .pdf .doc .docx</span>
                      <span style={{color:"#333",fontSize:12,marginTop:8}}>AI auto-extracts inspector, company, license & address</span>
                    </div>
                  )}
                </div>
                <div style={{margin:"24px 0",display:"flex",alignItems:"center",gap:16}}>
                  <div style={{flex:1,height:1,background:"#1e1e1e"}}/>
                  <span style={{color:"#444",fontSize:12}}>or paste report text</span>
                  <div style={{flex:1,height:1,background:"#1e1e1e"}}/>
                </div>
                <textarea style={{...styles.textarea,minHeight:160}} placeholder="Paste the full inspection report text here..." onChange={e=>{if(e.target.value.length>50)parseReport(e.target.value,"pasted report");}} />
              </div>
            )}

            {uploadStep===1 && (
              <div>
                {form.fileName && (
                  <div style={styles.fileBadge}>
                    <span style={{fontSize:18}}>📄</span>
                    <span style={{color:"#C8A84B",fontSize:13}}>{form.fileName}</span>
                    <button onClick={()=>{setUploadStep(0);setForm(f=>({...f,reportText:"",fileName:""}));}} style={{marginLeft:"auto",background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:12}}>✕ Remove</button>
                  </div>
                )}
                {Object.keys(missing).length>0 && (
                  <div style={styles.missingBanner}>
                    <span>⚠️</span>
                    <span style={{color:"#C8A84B",fontSize:13}}>We couldn't find {Object.keys(missing).length} field{Object.keys(missing).length>1?"s":""} in the report. Please fill them in.</span>
                  </div>
                )}
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

            {uploadStep===2 && (
              <div style={{textAlign:"center",padding:"60px 0"}}>
                <span style={{...styles.spinner,width:48,height:48,borderWidth:4,display:"inline-block"}}/>
                <p style={{color:"#C8A84B",fontSize:16,marginTop:24,fontFamily:"'DM Mono',monospace"}}>Analyzing report with AI...</p>
                <p style={{color:"#555",fontSize:13,marginTop:8}}>Scoring completeness, objectivity, fraud risk, and generating email summaries</p>
              </div>
            )}
          </div>
        </main>
      )}

      {/* REPORT */}
      {view==="report" && analysisResult && (
        <ReportView report={analysisResult} onSendEmails={sendEmails} emailSending={emailSending} emailSent={emailSent} onBack={()=>setView("database")} />
      )}

      {/* DATABASE */}
      {view==="database" && (
        <main style={styles.main}>
          <h2 style={styles.pageTitle}>Inspector Registry</h2>
          <p style={{color:"#666",fontSize:14,marginBottom:36}}>Public database of AI-analyzed inspection reports.</p>
          {reports.length===0?(
            <div style={{textAlign:"center",padding:"80px 0",borderRadius:12,border:"1px dashed #1e1e1e"}}>
              <div style={{fontSize:48,marginBottom:16}}>🔍</div>
              <p style={{color:"#666"}}>No reports submitted yet.</p>
              <button style={{...styles.ctaPrimary,marginTop:16}} onClick={()=>{session?setView("upload"):setShowAuth(true);}}>
                {session?"Submit the first report":"Sign In to Submit"}
              </button>
            </div>
          ):(
            <div style={styles.cardGrid}>
              {reports.map(r=>(
                <div key={r.id} style={styles.registryCard}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{fontSize:18,fontWeight:700,color:"#f0f0f0",marginBottom:2}}>{r.inspectorName}</div>
                      <div style={{color:"#555",fontSize:13}}>{r.companyName||"Independent"}</div>
                    </div>
                    <ScoreBadge score={r.analysis.trustScore}/>
                  </div>
                  <div style={{color:"#666",fontSize:12,margin:"14px 0 10px"}}>📍 {r.propertyAddress}</div>
                  <p style={{color:"#888",fontSize:13,lineHeight:1.6}}>{r.analysis.summary?.slice(0,120)}…</p>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:16}}>
                    <div style={{display:"flex",gap:8}}>
                      <span style={{fontSize:11,fontFamily:"'DM Mono',monospace",padding:"3px 10px",borderRadius:4,border:"1px solid",fontWeight:700,letterSpacing:"0.06em",background:r.analysis.fraudRisk==="High"?"#3a1010":r.analysis.fraudRisk==="Moderate"?"#2d2000":"#0d2b1a",color:r.analysis.fraudRisk==="High"?"#e74c3c":r.analysis.fraudRisk==="Moderate"?"#C8A84B":"#2ecc71",borderColor:r.analysis.fraudRisk==="High"?"#e74c3c":r.analysis.fraudRisk==="Moderate"?"#C8A84B":"#2ecc71"}}>{r.analysis.fraudRisk} Risk</span>
                      <span style={{background:"#1a1a1a",color:"#C8A84B",fontSize:11,fontFamily:"'DM Mono',monospace",padding:"3px 10px",borderRadius:4,fontWeight:700,border:"1px solid #2a2a2a"}}>Grade {r.analysis.inspectorGrade}</span>
                    </div>
                    <button style={{background:"none",border:"none",color:"#C8A84B",cursor:"pointer",fontSize:13,fontFamily:"inherit",fontWeight:600}} onClick={()=>viewReport(r)}>View Review →</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* ACCOUNT */}
      {view==="account" && session && (
        <AccountPage profile={session.profile} token={session.token} onUpdate={p=>{const s={...session,profile:p};saveSession(s);setSession(s);}} />
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
      await new Promise((resolve,reject)=>{
        if(window.jspdf){resolve();return;}
        const s=document.createElement("script");
        s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        s.onload=resolve;s.onerror=reject;document.head.appendChild(s);
      });
      const {jsPDF}=window.jspdf;
      const doc=new jsPDF({orientation:"portrait",unit:"mm",format:"letter"});
      const W=215.9,margin=18,contentW=W-margin*2;let y=0;
      const hex2rgb=h=>{const x=h.replace("#","");return[parseInt(x.slice(0,2),16),parseInt(x.slice(2,4),16),parseInt(x.slice(4,6),16)];};
      const setColor=(hex,type="text")=>{const[r,g,b]=hex2rgb(hex);type==="fill"?doc.setFillColor(r,g,b):type==="draw"?doc.setDrawColor(r,g,b):doc.setTextColor(r,g,b);};
      const addPage=()=>{doc.addPage();y=margin;};
      const checkY=(n=12)=>{if(y+n>265)addPage();};
      const bar=(label,value,color,barY)=>{
        doc.setFontSize(9);doc.setFont("helvetica","normal");
        setColor("#888888");doc.text(label,margin,barY);
        setColor(value>=80?"#2ecc71":value>=55?"#C8A84B":"#e74c3c");doc.text(`${value}/100`,W-margin,barY,{align:"right"});
        setColor("#222222","fill");doc.roundedRect(margin,barY+2,contentW,4,1,1,"F");
        setColor(color,"fill");doc.roundedRect(margin,barY+2,contentW*(value/100),4,1,1,"F");
      };
      setColor("#0e0e0e","fill");doc.rect(0,0,W,279.4,"F");
      setColor("#C8A84B","fill");doc.rect(0,0,W,2,"F");
      doc.setFontSize(72);doc.setFont("helvetica","bold");setColor("#1a1a1a");doc.text("CI",W/2,120,{align:"center"});
      y=52;doc.setFontSize(9);doc.setFont("helvetica","normal");setColor("#C8A84B");doc.text("CLEARINSPECT · INSPECTOR PERFORMANCE REVIEW",W/2,y,{align:"center"});
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
      const riskColor=a.fraudRisk==="High"?"#e74c3c":a.fraudRisk==="Moderate"?"#C8A84B":"#2ecc71";
      doc.setFontSize(8);doc.setFont("helvetica","bold");setColor(riskColor);doc.text(`${a.fraudRisk.toUpperCase()} FRAUD RISK`,cx-26,cy+5,{align:"center"});
      setColor("#111111","fill");setColor("#2a2a2a","draw");doc.setLineWidth(0.3);doc.roundedRect(margin,190,contentW,32,3,3,"FD");
      doc.setFontSize(8);doc.setFont("helvetica","normal");setColor("#888888");
      doc.text("PROPERTY",margin+6,199);doc.text("LICENSE",margin+6,209);doc.text("DATE",margin+6,219);
      setColor("#cccccc");doc.text(report.propertyAddress||"N/A",margin+44,199);doc.text(report.licenseNo||"Not Provided",margin+44,209);doc.text(report.date,margin+44,219);
      doc.setFontSize(6.5);doc.setFont("helvetica","italic");setColor("#444444");
      doc.text(doc.splitTextToSize("DISCLAIMER: AI-generated analysis and opinion. Not a legal determination or background check.",contentW),W/2,258,{align:"center"});
      setColor("#C8A84B","fill");doc.rect(0,277,W,2,"F");
      addPage();
      const sectionHeader=(title)=>{checkY(14);setColor("#C8A84B","fill");doc.rect(margin,y-4,3,10,"F");doc.setFontSize(8);doc.setFont("helvetica","bold");setColor("#C8A84B");doc.text(title,margin+6,y+3);y+=12;setColor("#1e1e1e","draw");doc.setLineWidth(0.2);doc.line(margin,y-2,W-margin,y-2);y+=4;};
      doc.setFontSize(7);doc.setFont("helvetica","normal");setColor("#444444");
      doc.text("CLEARINSPECT PERFORMANCE REVIEW",margin,y);doc.text(`${report.inspectorName} · ${report.date}`,W-margin,y,{align:"right"});
      setColor("#C8A84B","fill");doc.rect(margin,y+2,contentW,0.4,"F");y+=10;
      sectionHeader("AI SUMMARY");
      doc.setFontSize(10);doc.setFont("helvetica","italic");setColor("#aaaaaa");
      const sumLines=doc.splitTextToSize(a.summary,contentW);doc.text(sumLines,margin,y);y+=sumLines.length*5.5+10;
      sectionHeader("STRENGTHS");
      (a.strengths||[]).forEach(s=>{checkY(10);setColor("#2ecc71","fill");doc.circle(margin+2,y-1,1.2,"F");doc.setFontSize(9.5);doc.setFont("helvetica","normal");setColor("#aaaaaa");const ls=doc.splitTextToSize(s,contentW-8);doc.text(ls,margin+7,y);y+=ls.length*5+3;});
      y+=4;sectionHeader("CONCERNS");
      (a.concerns||[]).forEach(c=>{checkY(10);setColor("#e74c3c","fill");doc.rect(margin+0.5,y-3.5,2.5,2.5,"F");doc.setFontSize(9.5);doc.setFont("helvetica","normal");setColor("#aaaaaa");const lc=doc.splitTextToSize(c,contentW-8);doc.text(lc,margin+7,y);y+=lc.length*5+3;});
      addPage();
      doc.setFontSize(7);doc.setFont("helvetica","normal");setColor("#444444");
      doc.text("CLEARINSPECT PERFORMANCE REVIEW",margin,y);doc.text(`${report.inspectorName} · ${report.date}`,W-margin,y,{align:"right"});
      setColor("#C8A84B","fill");doc.rect(margin,y+2,contentW,0.4,"F");y+=10;
      sectionHeader("PERFORMANCE SCORECARD");
      [{label:"Trust Score",val:a.trustScore,color:"#C8A84B"},{label:"Completeness",val:a.completenessScore,color:"#3498db"},{label:"Technical Rigor",val:a.technicalScore,color:"#9b59b6"},{label:"Objectivity",val:a.objectivityScore,color:"#2ecc71"}].forEach(item=>{checkY(16);bar(item.label,item.val,item.color,y);y+=14;});
      doc.save(`ClearInspect_${report.inspectorName.replace(/\s+/g,"_")}.pdf`);
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
        </div>
      </div>

      <div style={styles.tabBar}>
        {["overview","scores","emails","flags"].map(t=>(
          <button key={t} style={activeTab===t?styles.tabActive:styles.tab} onClick={()=>setActiveTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>

      {activeTab==="overview" && (
        <div style={styles.tabContent}>
          <div style={styles.summaryBlock}><h3 style={styles.blockTitle}>AI Summary</h3><p style={{color:"#aaa",fontSize:15,lineHeight:1.75}}>{a.summary}</p></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
            <div style={styles.listBlock}><h4 style={{color:"#2ecc71",fontSize:13,letterSpacing:"0.1em",marginBottom:12}}>✓ STRENGTHS</h4>{a.strengths?.map((s,i)=><div key={i} style={{color:"#aaa",fontSize:13,lineHeight:1.6,display:"flex",gap:10,marginBottom:10}}><span style={{color:"#2ecc71"}}>+</span>{s}</div>)}</div>
            <div style={styles.listBlock}><h4 style={{color:"#e74c3c",fontSize:13,letterSpacing:"0.1em",marginBottom:12}}>⚠ CONCERNS</h4>{a.concerns?.map((s,i)=><div key={i} style={{color:"#aaa",fontSize:13,lineHeight:1.6,display:"flex",gap:10,marginBottom:10}}><span style={{color:"#e74c3c"}}>!</span>{s}</div>)}</div>
          </div>
          <div style={styles.recommendationBox}><span style={{color:"#C8A84B",fontWeight:700,marginRight:8}}>Recommendation:</span>{a.recommendation}</div>
        </div>
      )}
      {activeTab==="scores" && (
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
      {activeTab==="emails" && (
        <div style={styles.tabContent}>
          <h3 style={styles.blockTitle}>Auto-Generated Email Summaries</h3>
          <p style={{color:"#666",fontSize:13,marginBottom:24}}>AI-drafted emails ready to dispatch.</p>
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
      {activeTab==="flags" && (
        <div style={styles.tabContent}>
          <h3 style={styles.blockTitle}>Red Flag Analysis</h3>
          {!a.redFlags||a.redFlags.length===0?(
            <div style={{...styles.summaryBlock,borderColor:"#2ecc71"}}><span style={{color:"#2ecc71",fontSize:22}}>✓</span><p style={{color:"#2ecc71",marginTop:8}}>No red flags detected.</p></div>
          ):(
            <div>{a.redFlags?.map((flag,i)=><div key={i} style={{display:"flex",gap:14,alignItems:"flex-start",background:"rgba(231,76,60,0.04)",border:"1px solid rgba(231,76,60,0.15)",borderRadius:8,padding:"14px 18px",marginBottom:10}}><span style={{color:"#e74c3c",fontSize:18}}>⚑</span><span style={{color:"#ddd",fontSize:14,flex:1}}>{flag}</span></div>)}</div>
          )}
        </div>
      )}
    </main>
  );
}

// ── STYLES ────────────────────────────────────────────────────
const styles = {
  root:{minHeight:"100vh",background:"#0e0e0e",color:"#e8e8e8",fontFamily:"'DM Sans','Segoe UI',sans-serif"},
  header:{borderBottom:"1px solid #1e1e1e",background:"rgba(14,14,14,0.95)",backdropFilter:"blur(10px)",position:"sticky",top:0,zIndex:100},
  headerInner:{maxWidth:1100,margin:"0 auto",padding:"0 24px",height:60,display:"flex",alignItems:"center",justifyContent:"space-between"},
  logo:{background:"none",border:"none",color:"#C8A84B",fontSize:18,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:8,letterSpacing:"-0.02em",fontFamily:"'DM Sans',sans-serif"},
  navBtn:{background:"none",border:"1px solid #2a2a2a",color:"#888",padding:"7px 16px",borderRadius:6,cursor:"pointer",fontSize:13,fontFamily:"inherit"},
  navActive:{background:"none",border:"1px solid #C8A84B",color:"#C8A84B",padding:"7px 16px",borderRadius:6,cursor:"pointer",fontSize:13,fontFamily:"inherit"},
  main:{maxWidth:1100,margin:"0 auto",padding:"48px 24px 80px"},
  toast:{position:"fixed",top:72,right:24,zIndex:999,background:"#111",border:"1px solid",padding:"12px 20px",borderRadius:8,fontSize:13,fontFamily:"'DM Mono',monospace"},
  heroSection:{textAlign:"center",padding:"60px 0 48px"},
  pill:{display:"inline-block",background:"rgba(200,168,75,0.1)",border:"1px solid rgba(200,168,75,0.3)",color:"#C8A84B",padding:"5px 16px",borderRadius:100,fontSize:12,letterSpacing:"0.12em",marginBottom:24,fontFamily:"'DM Mono',monospace"},
  heroTitle:{fontSize:"clamp(40px,7vw,72px)",fontWeight:800,lineHeight:1.05,letterSpacing:"-0.03em",color:"#f0f0f0",marginBottom:24},
  heroSub:{fontSize:16,color:"#777",maxWidth:560,margin:"0 auto 36px",lineHeight:1.7},
  ctaPrimary:{background:"#C8A84B",color:"#0e0e0e",border:"none",padding:"14px 30px",borderRadius:8,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:8},
  ctaSecondary:{background:"transparent",color:"#C8A84B",border:"1px solid #C8A84B",padding:"14px 30px",borderRadius:8,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit"},
  btnDisabled:{background:"#2a2a2a",color:"#666",border:"none",padding:"14px 30px",borderRadius:8,fontSize:15,fontWeight:700,cursor:"not-allowed",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:8},
  btnSent:{background:"#0d2b1a",color:"#2ecc71",border:"1px solid #2ecc71",padding:"14px 30px",borderRadius:8,fontSize:15,fontWeight:700,cursor:"default",fontFamily:"inherit"},
  statsRow:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,margin:"0 0 64px"},
  statCard:{background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:"24px",textAlign:"center"},
  statNum:{fontSize:28,fontWeight:800,color:"#C8A84B",fontFamily:"'DM Mono',monospace",marginBottom:4},
  sectionTitle:{fontSize:28,fontWeight:700,color:"#f0f0f0",marginBottom:32,letterSpacing:"-0.02em"},
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
  modalOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(6px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px"},
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
