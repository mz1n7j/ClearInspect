import { useState, useRef, useEffect } from "react";

// ── Helpers ───────────────────────────────────────────────────
const genId = () => Math.random().toString(36).slice(2, 10);
const getSession = () => { try { return JSON.parse(localStorage.getItem("it_session") || "null"); } catch { return null; } };
const saveSession = (s) => localStorage.setItem("it_session", JSON.stringify(s));
const clearSession = () => localStorage.removeItem("it_session");

// ── Balance Bar ───────────────────────────────────────────────
function BalanceBar({ score = 50, size = "md" }) {
  const pct = Math.max(0, Math.min(100, score));
  const balanced = pct >= 35 && pct <= 65;
  const buyerBiased = pct < 35;
  const color = balanced ? "#2ecc71" : "#e74c3c";
  const label = balanced ? "BALANCED" : buyerBiased ? "BUYER-BIASED" : "SELLER-BIASED";
  const h = size === "sm" ? "h-2" : "h-3";

  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] font-mono mb-1.5 text-[#555]">
        <span>◄ Buyer-biased</span>
        <span className="text-[#2ecc71]">Balanced</span>
        <span>Seller-biased ►</span>
      </div>
      <div className={`relative ${h} bg-[#1a1a1a] rounded-full overflow-visible`} style={{ background: "linear-gradient(to right, #e74c3c 0%, #C8A84B 30%, #2ecc71 45%, #2ecc71 55%, #C8A84B 70%, #e74c3c 100%)" }}>
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-[#0e0e0e] shadow-lg transition-all duration-700"
          style={{ left: `${pct}%`, transform: "translate(-50%, -50%)", background: color }}
        />
      </div>
      <div className="flex justify-between items-center mt-2">
        <span className="text-[10px] text-[#444]">Flags cosmetic items as major</span>
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded" style={{ color, background: `${color}15`, border: `1px solid ${color}40` }}>{label}</span>
        <span className="text-[10px] text-[#444]">Misses real defects</span>
      </div>
    </div>
  );
}

// ── Score Badge ───────────────────────────────────────────────
function ScoreBadge({ score }) {
  const color = score >= 80 ? "#2ecc71" : score >= 55 ? "#C8A84B" : "#e74c3c";
  const label = score >= 80 ? "TRUSTED" : score >= 55 ? "REVIEW" : "FLAGGED";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold px-3 py-1 rounded border"
      style={{ color, borderColor: color, background: `${color}10` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label} · {score}/100
    </span>
  );
}

// ── Toast ─────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  const borderColor = toast.type === "error" ? "#e74c3c" : "#C8A84B";
  const textColor = toast.type === "error" ? "#e74c3c" : "#C8A84B";
  return (
    <div className="toast" style={{ borderColor, color: textColor }}>
      {toast.msg}
    </div>
  );
}

// ── Step Indicator ────────────────────────────────────────────
function StepIndicator({ step }) {
  const steps = ["Upload", "Review", "Analyze"];
  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-all
              ${i <= step ? "bg-[#C8A84B] text-[#0e0e0e]" : "bg-[#1a1a1a] text-[#555] border border-[#2a2a2a]"}`}>
              {i < step ? "✓" : i + 1}
            </div>
            <span className={`text-[10px] whitespace-nowrap ${i <= step ? "text-[#C8A84B]" : "text-[#444]"}`}>{s}</span>
          </div>
          {i < 2 && <div className={`w-12 md:w-20 h-0.5 mb-4 mx-1 transition-all ${i < step ? "bg-[#C8A84B]" : "bg-[#1e1e1e]"}`} />}
        </div>
      ))}
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, missing, type = "text", required }) {
  return (
    <div className="field">
      <label className="field-label">
        {label}{required && " *"}
        {missing && <span className="ml-2 text-[10px] text-[#e74c3c] bg-[rgba(231,76,60,0.1)] px-1.5 py-0.5 rounded font-mono">Not found — fill in</span>}
      </label>
      <input
        type={type}
        className={`field-input ${missing ? "field-missing" : ""}`}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

// ── Auth Modal ────────────────────────────────────────────────
function AuthModal({ onClose, onAuth }) {
  const [tab, setTab] = useState("signin");
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "buyer", licenseNumber: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sf = k => v => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: tab, ...form }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong"); setLoading(false); return; }
      if (tab === "signup") { setTab("signin"); setError("Account created! Please sign in."); setLoading(false); return; }
      saveSession({ token: data.session?.access_token, profile: data.profile });
      onAuth(data.profile, data.session?.access_token);
      onClose();
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <div className="flex border-b border-[#1e1e1e] -mx-6 px-6 w-full">
            {["signin", "signup"].map(t => (
              <button key={t} onClick={() => { setTab(t); setError(""); }}
                className={`tab-btn pb-3 ${tab === t ? "tab-active" : ""}`}>
                {t === "signin" ? "Sign In" : "Create Account"}
              </button>
            ))}
            <button onClick={onClose} className="ml-auto text-[#555] text-xl pb-3">✕</button>
          </div>
        </div>

        {error && (
          <div className={`p-3 rounded-lg text-sm mb-4 ${error.includes("created") ? "bg-[rgba(46,204,113,0.1)] text-[#2ecc71] border border-[#2ecc71]" : "bg-[rgba(231,76,60,0.1)] text-[#e74c3c] border border-[#e74c3c]"}`}>
            {error}
          </div>
        )}

        {tab === "signup" && (
          <div className="field">
            <label className="field-label">Full Name</label>
            <input className="field-input" placeholder="Jane Smith" value={form.name} onChange={e => sf("name")(e.target.value)} />
          </div>
        )}
        <div className="field">
          <label className="field-label">Email</label>
          <input className="field-input" type="email" placeholder="you@email.com" value={form.email} onChange={e => sf("email")(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Password</label>
          <input className="field-input" type="password" placeholder="••••••••" value={form.password} onChange={e => sf("password")(e.target.value)} />
        </div>

        {tab === "signup" && (
          <>
            <div className="field">
              <label className="field-label">I am a...</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {["buyer", "seller", "realtor"].map(r => (
                  <button key={r} onClick={() => sf("role")(r)}
                    className={`py-2.5 text-sm font-semibold rounded-lg border transition-all capitalize ${form.role === r ? "border-[#C8A84B] text-[#C8A84B] bg-[rgba(200,168,75,0.1)]" : "border-[#222] text-[#555] bg-[#0a0a0a]"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            {form.role === "realtor" && (
              <div className="field">
                <label className="field-label">Realtor License Number *</label>
                <input className="field-input" placeholder="TX-12345678" value={form.licenseNumber} onChange={e => sf("licenseNumber")(e.target.value)} />
                <p className="text-[11px] text-[#444] mt-1.5">14-day free trial · $20/year · Upload 50+ reports = free first year</p>
              </div>
            )}
            {form.role !== "realtor" && (
              <div className="bg-[rgba(46,204,113,0.05)] border border-[rgba(46,204,113,0.15)] rounded-lg p-3 mb-4">
                <p className="text-[#2ecc71] text-xs">✓ Free account — browse the inspector registry and view public reports</p>
              </div>
            )}
          </>
        )}

        <button onClick={submit} disabled={loading}
          className="btn-gold w-full mt-2"
          style={{ opacity: loading ? 0.7 : 1 }}>
          {loading ? <><span className="spinner" /> Please wait...</> : tab === "signin" ? "Sign In →" : "Create Account →"}
        </button>
      </div>
    </div>
  );
}

// ── Account Page ──────────────────────────────────────────────
function AccountPage({ profile, token, showToast }) {
  const [loading, setLoading] = useState(false);
  const trialStart = profile?.trial_started_at ? new Date(profile.trial_started_at) : null;
  const daysLeft = trialStart ? Math.max(0, 14 - Math.floor((Date.now() - trialStart) / (1000 * 60 * 60 * 24))) : null;
  const isRealtor = profile?.role === "realtor";
  const status = profile?.subscription_status;
  const inspCount = profile?.inspection_count || 0;
  const statusColor = status === "active" ? "#2ecc71" : status === "trial" ? "#C8A84B" : "#e74c3c";
  const statusLabel = status === "active" ? "Active" : status === "trial" ? `Trial — ${daysLeft} days left` : "Expired";

  const startCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing", {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ action: "checkout" }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else showToast(data.error || "Could not start checkout", "error");
    } catch { showToast("Network error", "error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold tracking-tight mb-6">My Account</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="card card-pad">
          <div className="card-title">Profile</div>
          {[["Name", profile?.name], ["Email", profile?.email], ["Role", profile?.role], ["License", profile?.license_number || "N/A"]].map(([l, v]) => (
            <div key={l} className="mb-3">
              <div className="text-[11px] text-[#555] uppercase tracking-wide mb-0.5">{l}</div>
              <div className="text-sm capitalize">{v}</div>
            </div>
          ))}
        </div>
        {isRealtor && (
          <div className="card card-pad">
            <div className="card-title">Subscription</div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: statusColor }} />
              <span className="font-bold" style={{ color: statusColor }}>{statusLabel}</span>
            </div>
            <div className="mb-4">
              <div className="flex justify-between text-xs text-[#666] mb-1.5">
                <span>Reports toward free year</span>
                <span className="text-[#C8A84B] font-mono">{inspCount}/50</span>
              </div>
              <div className="score-bar-track">
                <div className="score-bar-fill" style={{ width: `${Math.min(100, (inspCount / 50) * 100)}%`, background: inspCount >= 50 ? "#2ecc71" : "#C8A84B" }} />
              </div>
              {inspCount >= 50
                ? <p className="text-[#2ecc71] text-xs mt-1.5">✓ Free for first year — thank you!</p>
                : <p className="text-[#555] text-xs mt-1.5">Upload {50 - inspCount} more to earn a free first year</p>}
            </div>
            {(status === "trial" || status === "expired") && inspCount < 50 && (
              <button onClick={startCheckout} disabled={loading} className="btn-gold w-full text-sm">
                {loading ? <><span className="spinner" /> Loading...</> : "Subscribe — $20/year →"}
              </button>
            )}
          </div>
        )}
      </div>

      {isRealtor && (
        <div className="card card-pad bg-[rgba(200,168,75,0.03)] border-[rgba(200,168,75,0.15)]">
          <div className="card-title">Pricing</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: "14-Day Trial", desc: "Full access, no card needed", color: "#C8A84B" },
              { label: "$20 / Year", desc: "After trial ends", color: "#3498db" },
              { label: "Free First Year", desc: "Upload 50+ inspections", color: "#2ecc71" },
            ].map(p => (
              <div key={p.label} className="p-3 rounded-lg" style={{ border: `1px solid ${p.color}20`, background: `${p.color}08` }}>
                <div className="font-bold text-sm mb-1" style={{ color: p.color }}>{p.label}</div>
                <div className="text-xs text-[#666]">{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Disclaimer Footer ─────────────────────────────────────────
function Disclaimer() {
  return (
    <div className="border-t border-[#1a1a1a] mt-16 py-6 px-4 md:px-6">
      <div className="max-w-5xl mx-auto">
        <p className="text-[10px] text-[#2a2a2a] font-mono leading-relaxed">
          <span className="text-[#333] font-bold">AI-GENERATED ANALYSIS DISCLOSURE:</span>{" "}
          All inspector scores, Balance Scores, fraud risk ratings, and summaries on InspectorTrust are generated by artificial intelligence based solely on submitted inspection report content. These assessments represent automated, opinion-based analysis and do not constitute verified facts, legal findings, background check results, or official determinations by any licensing board or regulatory authority. Users should independently verify all information before making real estate, financial, or legal decisions. © {new Date().getFullYear()} InspectorTrust.
        </p>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const fileRef = useRef();

  const [form, setForm] = useState({
    inspectorName: "", companyName: "", licenseNo: "",
    street: "", city: "", state: "", zip: "",
    buyerEmail: "", sellerEmail: "", realtorEmail: "",
    reportText: "", fileName: "",
  });
  const [missing, setMissing] = useState({});

  useEffect(() => { const s = getSession(); if (s) setSession(s); }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const setField = k => v => setForm(f => ({ ...f, [k]: v }));
  const onAuth = (profile, token) => { const s = { token, profile }; saveSession(s); setSession(s); };
  const signOut = () => { clearSession(); setSession(null); setView("home"); showToast("Signed out."); setMobileMenuOpen(false); };

  const navTo = (v) => { setView(v); setMobileMenuOpen(false); if (v === "upload") setUploadStep(0); };

  // PDF extraction
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
          for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(" ") + "\n";
          }
          resolve(text);
        } catch (e) { reject(e); }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const parseReport = async (text, fileName) => {
    setParsing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "parse", reportText: text.slice(0, 5000) }),
      });
      const data = await res.json();
      const p = data.parsed || {};
      const newForm = {
        inspectorName: p.inspectorName || "", companyName: p.companyName || "",
        licenseNo: p.licenseNo || "", street: p.street || "",
        city: p.city || "", state: p.state || "", zip: p.zip || "",
        buyerEmail: p.buyerEmail || "", sellerEmail: p.sellerEmail || "",
        realtorEmail: p.realtorEmail || "", reportText: text, fileName,
      };
      setForm(newForm);
      const m = {};
      ["inspectorName", "street", "city", "state", "zip"].forEach(k => { if (!newForm[k]) m[k] = true; });
      setMissing(m);
      setUploadStep(1);
    } catch {
      showToast("Could not auto-parse. Please fill in details manually.", "error");
      setForm(f => ({ ...f, reportText: text, fileName }));
      setMissing({ inspectorName: true, street: true, city: true, state: true, zip: true });
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
          const r = new FileReader();
          r.onload = ev => res(ev.target.result);
          r.onerror = rej;
          r.readAsText(file);
        });
      }
      if (!text || text.trim().length < 20) {
        showToast("Could not read text from file. Try pasting the report text instead.", "error");
        setParsing(false); return;
      }
      await parseReport(text, file.name);
    } catch {
      showToast("File read failed. Please paste the report text instead.", "error");
      setParsing(false);
    }
  };

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); };

  const handleAnalyze = async () => {
    if (!session?.token) { setShowAuth(true); return; }
    if (!form.inspectorName || !form.street || !form.reportText) {
      showToast("Inspector name and address are required.", "error"); return;
    }
    const addr = [form.street, form.city, form.state, form.zip].filter(Boolean).join(", ");
    setUploading(true); setUploadStep(2);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.token}` },
        body: JSON.stringify({
          mode: "analyze",
          inspectorName: form.inspectorName,
          companyName: form.companyName,
          licenseNo: form.licenseNo,
          propertyAddress: addr,
          reportText: form.reportText,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "TRIAL_EXPIRED") { setView("account"); showToast(data.message, "error"); return; }
        if (res.status === 401) {
          clearSession(); setSession(null); setUploadStep(1);
          setShowAuth(true); showToast("Session expired — sign in again, your report is saved.", "error"); return;
        }
        throw new Error(data.error || "Analysis failed");
      }

      const newReport = {
        id: data.reportId || genId(), ...form,
        propertyAddress: addr,
        analysis: data.analysis,
        savedToDb: data.saved,
        date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
      };
      setReports(r => [newReport, ...r]);
      setAnalysisResult(newReport);
      setView("report"); setUploadStep(0);
      setForm({ inspectorName: "", companyName: "", licenseNo: "", street: "", city: "", state: "", zip: "", buyerEmail: "", sellerEmail: "", realtorEmail: "", reportText: "", fileName: "" });
      if (data.saved) showToast("Report analyzed and saved permanently ✓");
      else showToast("Report analyzed successfully.");
      if (session.profile) {
        const updated = { ...session.profile, inspection_count: (session.profile.inspection_count || 0) + 1 };
        const ns = { ...session, profile: updated };
        saveSession(ns); setSession(ns);
      }
    } catch (err) {
      showToast("Analysis failed: " + err.message, "error");
      setUploadStep(1);
    } finally { setUploading(false); }
  };

  const sendEmails = async () => {
    setEmailSending(true);
    await new Promise(r => setTimeout(r, 1800));
    setEmailSending(false); setEmailSent(true);
    showToast("Email summaries dispatched to all parties.");
  };

  const viewReport = (r) => { setAnalysisResult(r); setEmailSent(false); setView("report"); };

  // ── NAV ──────────────────────────────────────────────────────
  const trialDays = session?.profile?.trial_started_at
    ? Math.max(0, 14 - Math.floor((Date.now() - new Date(session.profile.trial_started_at)) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-[#e8e8e8] font-sans">
      <Toast toast={toast} />
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onAuth={onAuth} />}

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-40 bg-[rgba(14,14,14,0.95)] border-b border-[#1e1e1e] backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navTo("home")} className="text-[#C8A84B] font-bold text-base flex items-center gap-1.5">
            ▲ InspectorTrust
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {[["upload", "Upload Report"], ["database", `Registry (${reports.length})`], ["directory", "Find Inspectors"]].map(([v, l]) => (
              <button key={v} onClick={() => navTo(v)}
                className={`nav-link text-sm ${view === v ? "nav-link-active" : ""}`}>{l}</button>
            ))}
            {session ? (
              <>
                <button onClick={() => navTo("account")}
                  className={`nav-link text-sm ${view === "account" ? "nav-link-active" : ""}`}>
                  Account {session.profile?.subscription_status === "trial" ? "🕐" : session.profile?.subscription_status === "expired" ? "⚠️" : ""}
                </button>
                <button onClick={signOut} className="nav-link text-sm text-[#555]">Sign Out</button>
              </>
            ) : (
              <button onClick={() => setShowAuth(true)} className="btn-gold text-sm px-4 py-2">Sign In →</button>
            )}
          </nav>

          {/* Mobile hamburger */}
          <button className="md:hidden text-[#888] text-xl p-1" onClick={() => setMobileMenuOpen(m => !m)}>
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0e0e0e] border-t border-[#1e1e1e] animate-fadeIn">
            {[["upload", "Upload Report"], ["database", `Registry (${reports.length})`], ["directory", "Find Inspectors"]].map(([v, l]) => (
              <button key={v} onClick={() => navTo(v)}
                className={`mobile-menu-item ${view === v ? "active" : ""}`}>{l}</button>
            ))}
            {session ? (
              <>
                <button onClick={() => navTo("account")} className={`mobile-menu-item ${view === "account" ? "active" : ""}`}>
                  Account {session.profile?.subscription_status === "trial" ? `(${trialDays}d left)` : ""}
                </button>
                <button onClick={signOut} className="mobile-menu-item text-[#555]">Sign Out</button>
              </>
            ) : (
              <button onClick={() => { setShowAuth(true); setMobileMenuOpen(false); }}
                className="mobile-menu-item text-[#C8A84B] font-semibold">Sign In →</button>
            )}
          </div>
        )}
      </header>

      {/* ── HOME ── */}
      {view === "home" && (
        <main className="max-w-5xl mx-auto px-4 pb-20">
          {/* Hero */}
          <div className="text-center pt-10 pb-8">
            <div className="pill mb-4">AI-Powered · Real Estate Transparency</div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-3 leading-tight">
              Know Who's Really<br />
              <span className="text-[#C8A84B]">Inspecting Your Home.</span>
            </h1>
            <p className="text-sm md:text-base text-[#666] max-w-lg mx-auto mb-6 leading-relaxed">
              The first transparent inspection platform that scores every inspector on fairness, balance, and accuracy — separating real defects from negotiation tactics.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button className="btn-gold px-6 py-3" onClick={() => session ? navTo("upload") : setShowAuth(true)}>
                {session ? "Analyze a Report →" : "Get Started Free →"}
              </button>
              <button className="btn-outline px-6 py-3" onClick={() => navTo("database")}>View Registry</button>
            </div>
          </div>

          {/* Balance Bar Feature */}
          <div className="card card-pad mb-8 border-[rgba(200,168,75,0.25)] bg-[rgba(200,168,75,0.02)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="pill text-[10px]">New</div>
              <div className="card-title mb-0">Inspector Balance Score</div>
            </div>
            <h3 className="text-base md:text-lg font-bold text-white mb-2">A Better Way to Evaluate Inspectors</h3>
            <p className="text-xs md:text-sm text-[#666] leading-relaxed mb-5">
              Our AI separates inspectors who flag real material defects from those who pad reports with cosmetic items to create negotiation leverage. Major findings (structural, electrical, HVAC, plumbing) are <strong className="text-[#C8A84B]">expected and balanced</strong>. Excessive cosmetic items flagged as urgent concerns = buyer bias.
            </p>
            <BalanceBar score={52} />
            <p className="text-[10px] text-[#333] mt-3 italic">Example. Green = balanced inspector. Red = biased toward one party.</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { n: "1 in 4", l: "inspectors flagged for bias" },
              { n: "14-day", l: "free trial for realtors" },
              { n: "$20/yr", l: "after trial, no hidden fees" },
              { n: "50+", l: "inspections = free first year" },
            ].map(s => (
              <div key={s.l} className="card card-pad text-center">
                <div className="text-xl md:text-2xl font-extrabold text-[#C8A84B] font-mono mb-1">{s.n}</div>
                <div className="text-[11px] text-[#555] leading-tight">{s.l}</div>
              </div>
            ))}
          </div>

          {/* Pricing */}
          <div className="mb-10">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-2">Simple, Transparent Pricing</h2>
            <p className="text-sm text-[#666] mb-5">Whether you're buying, selling, or closing deals.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  title: "Buyer / Seller", price: "Free", color: "#2ecc71",
                  features: ["Browse inspector registry", "View public Balance Scores", "See major issues summary"],
                  btn: "green", btnLabel: "Create Free Account →",
                },
                {
                  title: "Realtor Trial", price: "14 Days Free", color: "#C8A84B",
                  features: ["Upload & analyze reports", "Full AI performance reviews", "Balance Score on every report", "Auto email all parties", "PDF export"],
                  btn: "gold", btnLabel: "Start Free Trial →",
                },
                {
                  title: "Realtor Annual", price: "$20 / year", color: "#3498db",
                  features: ["Everything in trial", "Unlimited reports", "50+ reports = free first year", "Fraud risk alerts"],
                  btn: "blue", btnLabel: "Get Realtor Access →",
                },
              ].map(p => (
                <div key={p.title} className="card card-pad flex flex-col" style={{ borderColor: `${p.color}30` }}>
                  <div className="text-[10px] font-mono tracking-widest uppercase mb-2" style={{ color: p.color }}>{p.title}</div>
                  <div className="text-2xl font-extrabold text-white mb-4">{p.price}</div>
                  <div className="flex-1 space-y-2 mb-5">
                    {p.features.map(f => (
                      <div key={f} className="flex gap-2 items-start text-xs text-[#777]">
                        <span style={{ color: p.color }} className="flex-shrink-0 mt-0.5">✓</span>{f}
                      </div>
                    ))}
                  </div>
                  {p.btn === "green" && <button className="btn-green text-sm py-2.5" onClick={() => setShowAuth(true)}>{p.btnLabel}</button>}
                  {p.btn === "gold" && <button className="btn-gold w-full text-sm py-2.5 justify-center" onClick={() => setShowAuth(true)}>{p.btnLabel}</button>}
                  {p.btn === "blue" && <button className="btn-blue text-sm py-2.5" onClick={() => setShowAuth(true)}>{p.btnLabel}</button>}
                </div>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-5">How It Works</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { n: "01", t: "Drop Your Report", b: "Upload any PDF inspection report. Our AI reads it instantly and extracts all details automatically." },
                { n: "02", t: "Confirm Details", b: "We auto-fill everything found. You only fill in what's missing." },
                { n: "03", t: "Get the Review", b: "Receive a balanced performance review with Balance Score, fraud risk, and categorized findings." },
                { n: "04", t: "Notify All Parties", b: "Buyer, seller, and realtor each receive a tailored AI-written email summary." },
              ].map(s => (
                <div key={s.n} className="card card-pad">
                  <div className="text-2xl font-extrabold text-[#C8A84B] font-mono opacity-60 mb-3">{s.n}</div>
                  <h3 className="text-sm font-bold text-white mb-2">{s.t}</h3>
                  <p className="text-xs text-[#666] leading-relaxed">{s.b}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* ── UPLOAD ── */}
      {view === "upload" && (
        <main className="max-w-2xl mx-auto px-4 py-8 pb-20">
          <h2 className="text-2xl font-bold tracking-tight mb-2">Submit Inspection Report</h2>
          <p className="text-sm text-[#666] mb-6">
            {uploadStep === 0 ? "Drop your report and we'll extract everything automatically."
              : uploadStep === 1 ? "We've extracted what we could. Fill in anything missing below."
              : "Analyzing with AI — this takes about 30 seconds..."}
          </p>

          {/* Trial banner */}
          {session?.profile?.subscription_status === "trial" && (
            <div className="flex items-center gap-2 bg-[rgba(200,168,75,0.06)] border border-[rgba(200,168,75,0.2)] rounded-lg p-3 mb-5 text-sm">
              <span>🕐</span>
              <span className="text-[#C8A84B]">Trial active — {trialDays} days remaining.</span>
              <button onClick={() => navTo("account")} className="ml-auto text-[#C8A84B] text-xs underline">Manage →</button>
            </div>
          )}

          <StepIndicator step={uploadStep} />

          {/* Step 0: Drop zone */}
          {uploadStep === 0 && (
            <div>
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all flex flex-col items-center gap-3 min-h-48 justify-center
                  ${dragOver ? "border-[#C8A84B] bg-[rgba(200,168,75,0.05)]" : "border-[#2a2a2a] bg-[#0a0a0a] hover:border-[#3a3a3a]"}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept=".txt,.pdf,.doc,.docx" className="hidden" onChange={e => handleFile(e.target.files[0])} />
                {parsing ? (
                  <>
                    <span className="spinner spinner-lg" />
                    <span className="text-[#C8A84B] text-sm font-mono">Reading report...</span>
                    <span className="text-xs text-[#555]">Extracting inspector details and address</span>
                  </>
                ) : (
                  <>
                    <span className="text-5xl">📋</span>
                    <span className="text-[#C8A84B] font-bold">Drop your inspection report here</span>
                    <span className="text-sm text-[#555]">or tap to browse · PDF, Word, or text</span>
                    <span className="text-xs text-[#333] mt-1">AI auto-extracts inspector name, company, license & address</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-[#1e1e1e]" />
                <span className="text-xs text-[#444]">or paste report text</span>
                <div className="flex-1 h-px bg-[#1e1e1e]" />
              </div>

              <textarea
                className="field-input w-full font-mono text-xs leading-relaxed min-h-36 resize-none"
                placeholder="Paste the full inspection report text here — we'll extract all the details..."
                onChange={e => { if (e.target.value.length > 50) parseReport(e.target.value, "pasted report"); }}
              />
            </div>
          )}

          {/* Step 1: Review details */}
          {uploadStep === 1 && (
            <div className="animate-fadeIn">
              {form.fileName && (
                <div className="flex items-center gap-3 card p-3 mb-4">
                  <span className="text-lg">📄</span>
                  <span className="text-sm text-[#C8A84B] flex-1 truncate">{form.fileName}</span>
                  <button onClick={() => { setUploadStep(0); setForm(f => ({ ...f, reportText: "", fileName: "" })); }}
                    className="text-xs text-[#555]">✕ Remove</button>
                </div>
              )}

              {Object.keys(missing).length > 0 && (
                <div className="flex items-center gap-2 bg-[rgba(200,168,75,0.06)] border border-[rgba(200,168,75,0.2)] rounded-lg p-3 mb-5">
                  <span>⚠️</span>
                  <span className="text-[#C8A84B] text-sm">
                    {Object.keys(missing).length} field{Object.keys(missing).length > 1 ? "s" : ""} not found — please fill them in below.
                  </span>
                </div>
              )}

              <div className="card card-pad mb-4">
                <div className="card-title">Inspector Details</div>
                <Field label="Inspector Full Name" value={form.inspectorName} onChange={setField("inspectorName")} placeholder="John Smith" required missing={missing.inspectorName} />
                <Field label="Company / Firm" value={form.companyName} onChange={setField("companyName")} placeholder="Apex Home Inspections LLC" />
                <Field label="License Number" value={form.licenseNo} onChange={setField("licenseNo")} placeholder="HI-20984 or TREC #12345" />
              </div>

              <div className="card card-pad mb-4">
                <div className="card-title">Property Address</div>
                <Field label="Street Address" value={form.street} onChange={setField("street")} placeholder="123 Maple Street" required missing={missing.street} />
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="col-span-2 md:col-span-2">
                    <Field label="City" value={form.city} onChange={setField("city")} placeholder="Austin" required missing={missing.city} />
                  </div>
                  <Field label="State" value={form.state} onChange={setField("state")} placeholder="TX" required missing={missing.state} />
                  <Field label="ZIP" value={form.zip} onChange={setField("zip")} placeholder="78701" required missing={missing.zip} />
                </div>
              </div>

              <div className="card card-pad mb-5">
                <div className="card-title">
                  Notify Parties
                  <span className="text-[#444] font-normal ml-1">(optional)</span>
                </div>
                <p className="text-xs text-[#555] mb-4">Each party receives a tailored AI-written email summary distinguishing major findings from cosmetic observations.</p>
                <div className="mb-4">
                  <label className="field-label">✉ Buyer Email</label>
                  <input className="field-input" type="email" placeholder="buyer@email.com" value={form.buyerEmail} onChange={e => setField("buyerEmail")(e.target.value)} />
                </div>
                <div className="mb-4">
                  <label className="field-label">✉ Seller Email</label>
                  <input className="field-input" type="email" placeholder="seller@email.com" value={form.sellerEmail} onChange={e => setField("sellerEmail")(e.target.value)} />
                </div>
                <div className="mb-1">
                  <label className="field-label">✉ Realtor Email</label>
                  <input className="field-input" type="email" placeholder="agent@realty.com" value={form.realtorEmail} onChange={e => setField("realtorEmail")(e.target.value)} />
                </div>
                <p className="text-[10px] text-[#333] mt-2">By providing these emails, you confirm you have consent to contact these parties.</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button className="btn-outline" onClick={() => setUploadStep(0)}>← Start Over</button>
                <button
                  className="btn-gold flex-1 justify-center"
                  onClick={handleAnalyze}
                  disabled={uploading}
                  style={{ opacity: uploading ? 0.7 : 1 }}>
                  {uploading
                    ? <><span className="spinner" /> Analyzing report...</>
                    : "Run AI Analysis →"}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Analyzing */}
          {uploadStep === 2 && (
            <div className="text-center py-16 animate-fadeIn">
              <span className="spinner spinner-lg mb-6 block mx-auto" />
              <p className="text-[#C8A84B] font-mono text-base mb-2">Analyzing report with AI...</p>
              <p className="text-sm text-[#555] max-w-sm mx-auto">
                Scoring completeness, objectivity, and balance. Identifying major vs minor findings. Generating email summaries.
              </p>
              <p className="text-xs text-[#333] mt-3">This typically takes 20–40 seconds for full reports</p>
            </div>
          )}
        </main>
      )}

      {/* ── REPORT ── */}
      {view === "report" && analysisResult && (
        <ReportView
          report={analysisResult}
          onSendEmails={sendEmails}
          emailSending={emailSending}
          emailSent={emailSent}
          onBack={() => navTo("database")}
        />
      )}

      {/* ── DATABASE ── */}
      {view === "database" && (
        <main className="max-w-5xl mx-auto px-4 py-8 pb-20">
          <h2 className="text-2xl font-bold tracking-tight mb-1">Inspector Registry</h2>
          <p className="text-sm text-[#666] mb-6">All analyzed inspection reports. Balance Scores and major findings are public.</p>
          {reports.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-[#1e1e1e] rounded-xl">
              <div className="text-5xl mb-4">🔍</div>
              <p className="text-[#666] mb-2">No reports submitted yet.</p>
              <button className="btn-gold mt-4 text-sm" onClick={() => session ? navTo("upload") : setShowAuth(true)}>
                {session ? "Submit the first report" : "Sign In to Submit"}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reports.map(r => (
                <div key={r.id} className="card card-pad">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="font-bold text-white truncate">{r.inspectorName}</div>
                      <div className="text-xs text-[#555]">{r.companyName || "Independent"}</div>
                    </div>
                    <ScoreBadge score={r.analysis.trustScore} />
                  </div>
                  <div className="mb-3"><BalanceBar score={r.analysis.balanceScore || 50} size="sm" /></div>
                  <div className="text-xs text-[#666] mb-2">📍 {r.propertyAddress}</div>
                  <p className="text-xs text-[#888] leading-relaxed mb-3 line-clamp-2">{r.analysis.summary?.slice(0, 100)}…</p>
                  <div className="flex items-center justify-between">
                    <span className={r.analysis.fraudRisk === "High" ? "risk-high" : r.analysis.fraudRisk === "Moderate" ? "risk-mod" : "risk-low"}>
                      {r.analysis.fraudRisk} Risk
                    </span>
                    <button className="text-[#C8A84B] text-sm font-semibold" onClick={() => viewReport(r)}>Full Review →</button>
                  </div>
                  {r.savedToDb && <div className="text-[10px] text-[#2ecc71] mt-2 font-mono">✓ Saved permanently</div>}
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* ── ACCOUNT ── */}
      {view === "account" && session && (
        <main className="max-w-5xl mx-auto px-4 py-8 pb-20">
          <AccountPage profile={session.profile} token={session.token} showToast={showToast} />
        </main>
      )}

      {/* ── DIRECTORY (placeholder) ── */}
      {view === "directory" && (
        <main className="max-w-5xl mx-auto px-4 py-8 pb-20">
          <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-1">Inspector Directory</h2>
              <p className="text-sm text-[#666]">Find verified, rated home inspectors in your area.</p>
            </div>
            <button className="btn-gold text-sm" onClick={() => navTo("inspector_register")}>
              Register as Inspector — $50/yr →
            </button>
          </div>
          <div className="text-center py-20 border border-dashed border-[#1e1e1e] rounded-xl">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-[#666] mb-2">No verified inspectors listed yet.</p>
            <p className="text-sm text-[#444]">Be the first to register your inspection business.</p>
            <button className="btn-gold mt-5 text-sm" onClick={() => navTo("inspector_register")}>
              Register Now →
            </button>
          </div>
        </main>
      )}

      <Disclaimer />
    </div>
  );
}

// ── Report View ───────────────────────────────────────────────
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
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
      const W = 215.9, margin = 18, cW = W - margin * 2; let y = 0;
      const h2r = h => { const x = h.replace("#", ""); return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)]; };
      const sc = (hex, t = "text") => { const [r, g, b] = h2r(hex); t === "fill" ? doc.setFillColor(r, g, b) : t === "draw" ? doc.setDrawColor(r, g, b) : doc.setTextColor(r, g, b); };
      const ap = () => { doc.addPage(); y = margin; };
      const cy = (n = 12) => { if (y + n > 265) ap(); };
      sc("#0e0e0e", "fill"); doc.rect(0, 0, W, 279.4, "F");
      sc("#C8A84B", "fill"); doc.rect(0, 0, W, 2, "F");
      y = 50; doc.setFontSize(9); doc.setFont("helvetica", "normal"); sc("#C8A84B");
      doc.text("INSPECTORTRUST · INSPECTOR PERFORMANCE REVIEW", W / 2, y, { align: "center" });
      y = 68; doc.setFontSize(24); doc.setFont("helvetica", "bold"); sc("#f0f0f0");
      const nL = doc.splitTextToSize(report.inspectorName.toUpperCase(), cW);
      doc.text(nL, W / 2, y, { align: "center" }); y += nL.length * 10;
      doc.setFontSize(12); sc("#C8A84B"); doc.text(report.companyName || "Independent", W / 2, y + 4, { align: "center" });
      const cx = W / 2, cy2 = 155, sc2 = a.trustScore >= 80 ? "#2ecc71" : a.trustScore >= 55 ? "#C8A84B" : "#e74c3c";
      sc("#1a1a1a", "fill"); sc(sc2, "draw"); doc.setLineWidth(1.5); doc.circle(cx, cy2, 22, "FD");
      doc.setFontSize(22); doc.setFont("helvetica", "bold"); sc(sc2); doc.text(String(a.trustScore), cx, cy2 + 3, { align: "center" });
      doc.setFontSize(7); sc("#888"); doc.text("TRUST SCORE", cx, cy2 + 10, { align: "center" });
      sc("#111", "fill"); sc("#2a2a2a", "draw"); doc.setLineWidth(0.3); doc.roundedRect(margin, 190, cW, 32, 3, 3, "FD");
      doc.setFontSize(8); sc("#888");
      doc.text("PROPERTY", margin + 6, 199); doc.text("LICENSE", margin + 6, 209); doc.text("DATE", margin + 6, 219);
      sc("#ccc"); doc.text(report.propertyAddress || "N/A", margin + 44, 199); doc.text(report.licenseNo || "N/A", margin + 44, 209); doc.text(report.date, margin + 44, 219);
      doc.setFontSize(6); doc.setFont("helvetica", "italic"); sc("#333");
      doc.text(doc.splitTextToSize("DISCLAIMER: AI-generated analysis. Not a legal determination or official licensing board finding. InspectorTrust scores are for informational purposes only.", cW), W / 2, 258, { align: "center" });
      sc("#C8A84B", "fill"); doc.rect(0, 277, W, 2, "F");
      ap();
      doc.setFontSize(7); sc("#444"); doc.text("INSPECTORTRUST PERFORMANCE REVIEW", margin, y); doc.text(`${report.inspectorName} · ${report.date}`, W - margin, y, { align: "right" });
      sc("#C8A84B", "fill"); doc.rect(margin, y + 2, cW, 0.4, "F"); y += 10;
      const sh = (title) => { cy(14); sc("#C8A84B", "fill"); doc.rect(margin, y - 4, 3, 10, "F"); doc.setFontSize(8); doc.setFont("helvetica", "bold"); sc("#C8A84B"); doc.text(title, margin + 6, y + 3); y += 12; sc("#1e1e1e", "draw"); doc.setLineWidth(0.2); doc.line(margin, y - 2, W - margin, y - 2); y += 4; };
      sh("AI SUMMARY");
      doc.setFontSize(10); doc.setFont("helvetica", "italic"); sc("#aaa");
      const sL = doc.splitTextToSize(a.summary || "", cW); doc.text(sL, margin, y); y += sL.length * 5.5 + 8;
      if (a.dealBreakers?.length) {
        sh("DEAL BREAKERS / MAJOR CONCERNS");
        a.dealBreakers.forEach(f => { cy(10); sc("#e74c3c", "fill"); doc.rect(margin, y - 3, 2.5, 2.5, "F"); doc.setFontSize(9); doc.setFont("helvetica", "normal"); sc("#ddd"); const ls = doc.splitTextToSize(`${f.item} — ${f.recommendation || ""}`, cW - 8); doc.text(ls, margin + 6, y); y += ls.length * 5 + 3; });
        y += 4;
      }
      if (a.notableIssues?.length) {
        sh("NOTABLE ISSUES");
        a.notableIssues.forEach(f => { cy(10); sc("#C8A84B", "fill"); doc.rect(margin, y - 3, 2.5, 2.5, "F"); doc.setFontSize(9); doc.setFont("helvetica", "normal"); sc("#bbb"); const ls = doc.splitTextToSize(`${f.item}`, cW - 8); doc.text(ls, margin + 6, y); y += ls.length * 5 + 3; });
        y += 4;
      }
      doc.save(`InspectorTrust_${report.inspectorName.replace(/\s+/g, "_")}.pdf`);
    } catch (err) { alert("PDF export failed: " + err.message); }
    finally { setPdfExporting(false); }
  };

  const tabs = ["overview", "findings", "scores", "emails", "flags"];

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 pb-20 animate-fadeIn">
      <button onClick={onBack} className="text-[#555] text-sm mb-5 flex items-center gap-1">← Back to Registry</button>

      {/* Hero */}
      <div className="card card-pad mb-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight mb-1">{report.inspectorName}</h1>
            <p className="text-[#C8A84B] text-sm">{report.companyName || "Independent"} · License {report.licenseNo || "N/A"}</p>
            <p className="text-[#555] text-xs mt-1">📍 {report.propertyAddress} · {report.date}</p>
            {report.savedToDb && <p className="text-[#2ecc71] text-[10px] font-mono mt-1">✓ Saved to database permanently</p>}
          </div>
          <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3">
            <ScoreBadge score={a.trustScore} />
            <span className="text-2xl font-extrabold font-mono" style={{ color: a.inspectorGrade === "A" ? "#2ecc71" : a.inspectorGrade === "B" ? "#C8A84B" : "#e74c3c" }}>
              {a.inspectorGrade}
            </span>
            <button onClick={exportToPDF} disabled={pdfExporting}
              className="btn-ghost text-xs px-3 py-2">
              {pdfExporting ? <><span className="spinner" /> Exporting...</> : "↓ PDF"}
            </button>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-[#1a1a1a]">
          <BalanceBar score={a.balanceScore || 50} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1e1e1e] mb-5 overflow-x-auto">
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`tab-btn ${activeTab === t ? "tab-active" : ""}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "overview" && (
        <div className="animate-fadeIn space-y-4">
          <div className="card card-pad">
            <div className="card-title">AI Summary</div>
            <p className="text-sm text-[#aaa] leading-relaxed">{a.summary}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card card-pad">
              <div className="text-[#2ecc71] text-xs font-mono tracking-wide mb-3">✓ STRENGTHS</div>
              {(a.strengths || []).map((s, i) => (
                <div key={i} className="flex gap-2 text-sm text-[#aaa] mb-2">
                  <span className="text-[#2ecc71] flex-shrink-0">+</span>{s}
                </div>
              ))}
            </div>
            <div className="card card-pad">
              <div className="text-[#e74c3c] text-xs font-mono tracking-wide mb-3">⚠ CONCERNS</div>
              {(a.concerns || []).map((s, i) => (
                <div key={i} className="flex gap-2 text-sm text-[#aaa] mb-2">
                  <span className="text-[#e74c3c] flex-shrink-0">!</span>{s}
                </div>
              ))}
            </div>
          </div>
          {a.biasIndicators?.length > 0 && (
            <div className="card card-pad border-[rgba(231,76,60,0.2)]">
              <div className="text-[#e74c3c] text-xs font-mono tracking-wide mb-3">⚑ BIAS INDICATORS</div>
              {a.biasIndicators.map((b, i) => (
                <div key={i} className="text-sm text-[#e74c3c] mb-2 opacity-80">{b}</div>
              ))}
            </div>
          )}
          <div className="bg-[rgba(200,168,75,0.05)] border border-[rgba(200,168,75,0.2)] rounded-xl p-4">
            <span className="text-[#C8A84B] font-bold mr-2">Recommendation:</span>
            <span className="text-sm text-[#bbb]">{a.recommendation}</span>
          </div>
        </div>
      )}

      {/* Findings */}
      {activeTab === "findings" && (
        <div className="animate-fadeIn space-y-5">
          {a.dealBreakers?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-[#e74c3c]" />
                <h3 className="text-sm font-bold text-[#e74c3c] tracking-wide uppercase">Deal Breakers / Major Concerns</h3>
                <span className="text-[10px] text-[#555]">— Expected findings, not bias indicators</span>
              </div>
              {a.dealBreakers.map((f, i) => (
                <div key={i} className="finding-major">
                  <p className="text-sm font-semibold text-white mb-1">{f.item}</p>
                  {f.recommendation && <p className="text-xs text-[#888]">→ {f.recommendation}</p>}
                  <span className="inline-block mt-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-[rgba(231,76,60,0.15)] text-[#e74c3c]">{f.severity}</span>
                </div>
              ))}
            </div>
          )}
          {a.notableIssues?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-[#C8A84B]" />
                <h3 className="text-sm font-bold text-[#C8A84B] tracking-wide uppercase">Notable Issues</h3>
              </div>
              {a.notableIssues.map((f, i) => (
                <div key={i} className="finding-notable">
                  <p className="text-sm text-white mb-1">{f.item}</p>
                  {f.recommendation && <p className="text-xs text-[#888]">→ {f.recommendation}</p>}
                </div>
              ))}
            </div>
          )}
          {a.minorObservations?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-[#333]" />
                <h3 className="text-sm font-bold text-[#555] tracking-wide uppercase">Minor Observations</h3>
                <span className="text-[10px] text-[#444]">— Watch for over-reach here</span>
              </div>
              {a.minorObservations.map((f, i) => (
                <div key={i} className={`finding-minor ${f.isCosmeticOverreach ? "border-l-[#e74c3c]" : ""}`}>
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-sm text-[#777]">{f.item}</p>
                    {f.isCosmeticOverreach && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[rgba(231,76,60,0.1)] text-[#e74c3c] flex-shrink-0">Overreach ⚑</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!a.dealBreakers?.length && !a.notableIssues?.length && !a.minorObservations?.length && (
            <div className="card card-pad text-center text-[#555] text-sm">No structured findings available for this report.</div>
          )}
        </div>
      )}

      {/* Scores */}
      {activeTab === "scores" && (
        <div className="animate-fadeIn space-y-4">
          <div className="card card-pad">
            <div className="card-title">Performance Scorecard</div>
            {[
              { label: "Trust Score", val: a.trustScore, color: "#C8A84B" },
              { label: "Completeness", val: a.completenessScore, color: "#3498db" },
              { label: "Technical Rigor", val: a.technicalScore, color: "#9b59b6" },
              { label: "Objectivity", val: a.objectivityScore, color: "#2ecc71" },
            ].map(s => (
              <div key={s.label} className="mb-5">
                <div className="flex justify-between mb-1.5">
                  <span className="text-sm text-[#ccc]">{s.label}</span>
                  <span className="text-sm font-bold font-mono" style={{ color: s.color }}>{s.val}/100</span>
                </div>
                <div className="score-bar-track">
                  <div className="score-bar-fill" style={{ width: `${s.val}%`, background: s.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="card card-pad">
            <div className="card-title">Fraud Risk Assessment</div>
            <div className={a.fraudRisk === "High" ? "risk-high text-base px-4 py-2 inline-block" : a.fraudRisk === "Moderate" ? "risk-mod text-base px-4 py-2 inline-block" : "risk-low text-base px-4 py-2 inline-block"}>
              {a.fraudRisk?.toUpperCase()} RISK
            </div>
          </div>
        </div>
      )}

      {/* Emails */}
      {activeTab === "emails" && (
        <div className="animate-fadeIn space-y-4">
          <p className="text-sm text-[#666]">AI-drafted emails tailored to each party. Each distinguishes major findings from cosmetic observations.</p>
          {[
            { role: "Buyer", key: "emailBuyer", addr: report.buyerEmail, icon: "🏠" },
            { role: "Seller", key: "emailSeller", addr: report.sellerEmail, icon: "💼" },
            { role: "Realtor", key: "emailRealtor", addr: report.realtorEmail, icon: "📋" },
          ].map(e => (
            <div key={e.key} className="card card-pad">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{e.icon}</span>
                <div>
                  <div className="text-sm font-bold text-white">To: {e.role}</div>
                  <div className="text-xs text-[#555]">{e.addr || "No email provided"}</div>
                </div>
              </div>
              <div className="border-t border-[#1a1a1a] pt-3 text-xs text-[#777] font-mono leading-relaxed whitespace-pre-wrap">{a[e.key]}</div>
            </div>
          ))}
          <button
            className={emailSent ? "btn-gold w-full justify-center opacity-50 cursor-default" : emailSending ? "btn-gold w-full justify-center opacity-50 cursor-not-allowed" : "btn-gold w-full justify-center"}
            onClick={() => !emailSent && !emailSending && onSendEmails()}
            disabled={emailSending || emailSent}>
            {emailSent ? "✓ Emails Dispatched" : emailSending ? <><span className="spinner" /> Sending...</> : "Dispatch All Emails →"}
          </button>
        </div>
      )}

      {/* Flags */}
      {activeTab === "flags" && (
        <div className="animate-fadeIn space-y-4">
          <div className="card card-pad">
            <div className="card-title">Red Flag Analysis</div>
            {!a.redFlags || a.redFlags.length === 0 ? (
              <div className="flex items-center gap-3">
                <span className="text-[#2ecc71] text-2xl">✓</span>
                <p className="text-[#2ecc71] text-sm">No red flags detected. Report appears to meet standard industry criteria.</p>
              </div>
            ) : (
              a.redFlags.map((flag, i) => (
                <div key={i} className="flex gap-3 items-start bg-[rgba(231,76,60,0.04)] border border-[rgba(231,76,60,0.15)] rounded-lg p-3 mb-3">
                  <span className="text-[#e74c3c]">⚑</span>
                  <span className="text-sm text-[#ddd]">{flag}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </main>
  );
}
