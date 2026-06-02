import { useState, useRef, useEffect } from "react";

const genId = () => Math.random().toString(36).slice(2,10);
const getSession = () => { try { return JSON.parse(localStorage.getItem("it_s")||"null"); } catch { return null; } };
const saveSession = s => localStorage.setItem("it_s", JSON.stringify(s));
const clearSession = () => localStorage.removeItem("it_s");
const fmt = d => new Date(d).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"});

const C = {
  gold:"#C8A84B",base:"#0e0e0e",surface:"#111111",surface2:"#161616",border:"#1e1e1e",border2:"#2a2a2a",
  text:"#e8e8e8",muted:"#888888",dim:"#555555",faint:"#333333",
  green:"#2ecc71",blue:"#3498db",red:"#e74c3c",purple:"#9b59b6",
};
const card = {background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"20px 22px"};
const cardSm = {background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px"};
const cTitle = {color:C.gold,fontSize:10,letterSpacing:"0.14em",fontFamily:"monospace",textTransform:"uppercase",marginBottom:14};
const inp = {width:"100%",background:"#0a0a0a",border:`1px solid #222`,borderRadius:6,padding:"10px 12px",color:C.text,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit"};
const lbl = {display:"block",color:C.dim,fontSize:12,marginBottom:5,letterSpacing:"0.04em"};
const bGold = {display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,background:C.gold,color:C.base,border:"none",borderRadius:8,padding:"11px 20px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"};
const bOut = {display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,background:"transparent",color:C.gold,border:`1px solid ${C.gold}`,borderRadius:8,padding:"11px 20px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"};
const bGrn = {display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,background:C.green,color:C.base,border:"none",borderRadius:8,padding:"11px 20px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",width:"100%"};
const bBlu = {display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,background:C.blue,color:"#fff",border:"none",borderRadius:8,padding:"11px 20px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",width:"100%"};
const bGhost = {display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,background:"transparent",color:C.muted,border:`1px solid #2a2a2a`,borderRadius:6,padding:"7px 12px",fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"inherit"};
const pill = {display:"inline-block",background:"rgba(200,168,75,0.1)",border:"1px solid rgba(200,168,75,0.3)",color:C.gold,padding:"4px 14px",borderRadius:100,fontSize:11,letterSpacing:"0.12em",fontFamily:"monospace"};
const tag = c => ({display:"inline-block",color:c,background:`${c}15`,border:`1px solid ${c}40`,borderRadius:4,fontSize:11,fontFamily:"monospace",fontWeight:700,padding:"2px 10px"});
const tabB = a => ({color:a?C.gold:C.dim,background:"none",border:"none",borderBottom:`2px solid ${a?C.gold:"transparent"}`,padding:"11px 14px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0});
const mOv = {position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(6px)",zIndex:1000,display:"flex",alignItems:"flex-end",justifyContent:"center"};
const mBox = {background:C.surface,border:"1px solid #2a2a2a",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:460,padding:"28px 24px 40px",maxHeight:"90vh",overflowY:"auto",animation:"slideUp 0.3s ease"};

function Spinner({lg}) {
  return <span style={{width:lg?40:18,height:lg?40:18,border:`${lg?3:2}px solid rgba(200,168,75,0.2)`,borderTopColor:C.gold,borderRadius:"50%",animation:"spin 0.8s linear infinite",display:"inline-block",flexShrink:0,verticalAlign:"middle"}}/>;
}

function BalanceBar({score=50}) {
  const pct = Math.max(0,Math.min(100,score));
  const balanced = pct>=35&&pct<=65;
  const color = balanced?C.green:C.red;
  const lbl2 = balanced?"BALANCED":pct<35?"BUYER-BIASED":"SELLER-BIASED";
  return (
    <div style={{width:"100%"}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,fontFamily:"monospace",color:C.dim,marginBottom:5}}>
        <span>◄ Buyer-biased</span><span style={{color:C.green}}>Balanced</span><span>Seller-biased ►</span>
      </div>
      <div style={{position:"relative",height:10,borderRadius:99,background:`linear-gradient(to right,${C.red} 0%,${C.gold} 30%,${C.green} 45%,${C.green} 55%,${C.gold} 70%,${C.red} 100%)`}}>
        <div style={{position:"absolute",top:"50%",left:`${pct}%`,transform:"translate(-50%,-50%)",width:18,height:18,borderRadius:"50%",background:color,border:`2.5px solid ${C.base}`,transition:"left 0.7s ease"}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:7}}>
        <span style={{fontSize:10,color:"#444"}}>Flags cosmetic as major</span>
        <span style={{...tag(color),fontSize:10}}>{lbl2}</span>
        <span style={{fontSize:10,color:"#444"}}>Misses real defects</span>
      </div>
    </div>
  );
}

function ScoreBadge({score}) {
  const color = score>=80?C.green:score>=55?C.gold:C.red;
  const l = score>=80?"TRUSTED":score>=55?"REVIEW":"FLAGGED";
  return <span style={{display:"inline-flex",alignItems:"center",gap:6,...tag(color),padding:"5px 12px"}}><span style={{width:7,height:7,borderRadius:"50%",background:color,display:"inline-block"}}/>{l} · {score}/100</span>;
}

function StepIndicator({step}) {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",marginBottom:28}}>
      {["Upload","Review","Analyze"].map((s,i)=>(
        <div key={s} style={{display:"flex",alignItems:"center"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <div style={{width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,fontFamily:"monospace",background:i<=step?C.gold:"#1a1a1a",color:i<=step?C.base:C.dim,border:i<=step?`2px solid ${C.gold}`:"2px solid #2a2a2a"}}>
              {i<step?"✓":i+1}
            </div>
            <span style={{fontSize:10,color:i<=step?C.gold:"#444",whiteSpace:"nowrap"}}>{s}</span>
          </div>
          {i<2&&<div style={{width:40,height:2,background:i<step?C.gold:C.border,margin:"0 6px",marginBottom:20}}/>}
        </div>
      ))}
    </div>
  );
}

function Field({label:l,value,onChange,placeholder,missing,onClearMissing,type="text",required}) {
  return (
    <div style={{marginBottom:14}}>
      <label style={lbl}>{l}{required&&" *"}{missing&&!value&&<span style={{marginLeft:8,fontSize:10,color:C.red,background:"rgba(231,76,60,0.1)",padding:"2px 7px",borderRadius:4,fontFamily:"monospace"}}>Not found — fill in</span>}</label>
      <input type={type} style={{...inp,borderColor:(missing&&!value)?"rgba(231,76,60,0.4)":"#222"}} placeholder={placeholder} value={value} onChange={e=>{onChange(e.target.value);if(onClearMissing&&e.target.value)onClearMissing();}}/>
    </div>
  );
}

function AuthModal({onClose,onAuth}) {
  const [tab,setTab]=useState("signin");
  const [form,setForm]=useState({email:"",password:"",name:"",role:"buyer",licenseNumber:""});
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const sf=k=>v=>setForm(f=>({...f,[k]:v}));
  const submit=async()=>{
    setError("");setLoading(true);
    try {
      const res=await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:tab,...form})});
      const data=await res.json();
      if(!res.ok){setError(data.error||"Something went wrong");setLoading(false);return;}
      if(tab==="signup"){setTab("signin");setError("Account created! Please sign in.");setLoading(false);return;}
      saveSession({token:data.session?.access_token,profile:data.profile});
      onAuth(data.profile,data.session?.access_token);onClose();
    } catch{setError("Network error.");}
    finally{setLoading(false);}
  };
  return (
    <div style={mOv} onClick={onClose}>
      <div style={mBox} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,marginBottom:20}}>
          {["signin","signup"].map(t=><button key={t} onClick={()=>{setTab(t);setError("");}} style={tabB(tab===t)}>{t==="signin"?"Sign In":"Create Account"}</button>)}
          <button onClick={onClose} style={{marginLeft:"auto",background:"none",border:"none",color:C.dim,fontSize:20,cursor:"pointer"}}>✕</button>
        </div>
        {error&&<div style={{padding:"10px 14px",borderRadius:8,fontSize:13,marginBottom:14,background:error.includes("created")?"rgba(46,204,113,0.1)":"rgba(231,76,60,0.1)",color:error.includes("created")?C.green:C.red,border:`1px solid ${error.includes("created")?C.green:C.red}`}}>{error}</div>}
        {tab==="signup"&&<div style={{marginBottom:12}}><label style={lbl}>Full Name</label><input style={inp} placeholder="Jane Smith" value={form.name} onChange={e=>sf("name")(e.target.value)}/></div>}
        <div style={{marginBottom:12}}><label style={lbl}>Email</label><input style={inp} type="email" placeholder="you@email.com" value={form.email} onChange={e=>sf("email")(e.target.value)}/></div>
        <div style={{marginBottom:12}}><label style={lbl}>Password</label><input style={inp} type="password" placeholder="••••••••" value={form.password} onChange={e=>sf("password")(e.target.value)}/></div>
        {tab==="signup"&&<>
          <div style={{marginBottom:12}}>
            <label style={lbl}>I am a...</label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:6}}>
              {["buyer","seller","realtor"].map(r=><button key={r} onClick={()=>sf("role")(r)} style={{padding:"10px",borderRadius:8,border:`1.5px solid ${form.role===r?C.gold:"#222"}`,background:form.role===r?"rgba(200,168,75,0.1)":"#0a0a0a",color:form.role===r?C.gold:C.dim,cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit",textTransform:"capitalize"}}>{r}</button>)}
            </div>
          </div>
          {form.role==="realtor"&&<div style={{marginBottom:12}}><label style={lbl}>Realtor License # *</label><input style={inp} placeholder="TX-12345678" value={form.licenseNumber} onChange={e=>sf("licenseNumber")(e.target.value)}/><p style={{color:"#444",fontSize:11,marginTop:5}}>14-day free trial · $20/year · Upload 50+ reports = free first year</p></div>}
          {form.role!=="realtor"&&<div style={{background:"rgba(46,204,113,0.05)",border:"1px solid rgba(46,204,113,0.15)",borderRadius:8,padding:"10px 14px",marginBottom:12}}><p style={{color:C.green,fontSize:12}}>✓ Free account — browse registry and view all reports</p></div>}
        </>}
        <button onClick={submit} disabled={loading} style={{...bGold,width:"100%",marginTop:8,opacity:loading?0.7:1}}>{loading?<><Spinner/> Please wait...</>:tab==="signin"?"Sign In →":"Create Account →"}</button>
      </div>
    </div>
  );
}

function AccountPage({profile,token,showToast}) {
  const [loading,setLoading]=useState(false);
  const trialStart=profile?.trial_started_at?new Date(profile.trial_started_at):null;
  const daysLeft=trialStart?Math.max(0,14-Math.floor((Date.now()-trialStart)/86400000)):null;
  const isRealtor=profile?.role==="realtor";
  const status=profile?.subscription_status;
  const inspCount=profile?.inspection_count||0;
  const statusColor=status==="active"?C.green:status==="trial"?C.gold:C.red;
  const statusLabel=status==="active"?"Active":status==="trial"?`Trial — ${daysLeft} days left`:"Expired";
  const startCheckout=async()=>{
    setLoading(true);
    try {
      const res=await fetch("/api/billing",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({action:"checkout"})});
      const data=await res.json();
      if(data.url)window.location.href=data.url;
      else showToast(data.error||"Could not start checkout","error");
    } catch{showToast("Network error","error");}
    finally{setLoading(false);}
  };
  return (
    <div style={{maxWidth:640,margin:"0 auto"}}>
      <h2 style={{fontSize:24,fontWeight:800,marginBottom:24,letterSpacing:"-0.02em"}}>My Account</h2>
      <div style={{display:"grid",gap:14}}>
        <div style={card}>
          <div style={cTitle}>Profile</div>
          {[["Name",profile?.name],["Email",profile?.email],["Role",profile?.role],["License",profile?.license_number||"N/A"]].map(([l,v])=>(
            <div key={l} style={{marginBottom:12}}>
              <div style={{color:C.dim,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2}}>{l}</div>
              <div style={{fontSize:14,textTransform:l==="Role"?"capitalize":"none"}}>{v}</div>
            </div>
          ))}
        </div>
        {isRealtor&&<div style={card}>
          <div style={cTitle}>Subscription</div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
            <span style={{width:10,height:10,borderRadius:"50%",background:statusColor,display:"inline-block"}}/>
            <span style={{color:statusColor,fontWeight:700}}>{statusLabel}</span>
          </div>
          <div style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.dim,marginBottom:5}}>
              <span>Reports toward free year</span>
              <span style={{color:C.gold,fontFamily:"monospace"}}>{inspCount}/50</span>
            </div>
            <div style={{height:6,background:"#1e1e1e",borderRadius:99,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${Math.min(100,(inspCount/50)*100)}%`,background:inspCount>=50?C.green:C.gold,borderRadius:99}}/>
            </div>
            <p style={{color:inspCount>=50?C.green:C.dim,fontSize:11,marginTop:5}}>{inspCount>=50?"✓ Free first year!":(`Upload ${50-inspCount} more to earn free first year`)}</p>
          </div>
          {(status==="trial"||status==="expired")&&inspCount<50&&<button onClick={startCheckout} disabled={loading} style={{...bGold,width:"100%",justifyContent:"center",opacity:loading?0.7:1}}>{loading?<><Spinner/> Loading...</>:"Subscribe — $20/year →"}</button>}
        </div>}
      </div>
    </div>
  );
}

// ── REPORTS DASHBOARD ────────────────────────────────────────
function ReportsDashboard({session,showToast}) {
  const [reports,setReports]=useState([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [filterYear,setFilterYear]=useState("");
  const [filterRisk,setFilterRisk]=useState("");
  const [selected,setSelected]=useState(null);
  const [resending,setResending]=useState(null);

  const currentYear=new Date().getFullYear();
  const years=Array.from({length:6},(_,i)=>currentYear-i);

  const load=async()=>{
    if(!session?.token)return;
    setLoading(true);
    try {
      const res=await fetch("/api/analyze",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.token}`},
        body:JSON.stringify({mode:"get_reports",search,filterYear:filterYear||undefined,filterRisk:filterRisk||undefined}),
      });
      const data=await res.json();
      setReports(data.reports||[]);
    } catch{showToast("Could not load reports","error");}
    finally{setLoading(false);}
  };

  useEffect(()=>{load();},[]);

  const resendEmail=async(report,type,email)=>{
    if(!email){showToast("No email address on file for this party","error");return;}
    setResending(`${report.id}-${type}`);
    try {
      const res=await fetch("/api/analyze",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.token}`},
        body:JSON.stringify({mode:"resend_email",reportId:report.id,recipientType:type,recipientEmail:email}),
      });
      const data=await res.json();
      if(data.success)showToast(`Email resent to ${email}`);
      else showToast(data.error||"Resend failed","error");
    } catch{showToast("Network error","error");}
    finally{setResending(null);}
  };

  const riskColor=r=>r==="High"?C.red:r==="Moderate"?C.gold:C.green;
  const gradeColor=g=>g==="A"?C.green:g==="B"?C.gold:g==="C"?"#e67e22":C.red;

  if(selected){
    const a=selected.analysis_data||{};
    const fiveYrsAgo=Date.now()-5*365*24*60*60*1000;
    const canResend=new Date(selected.created_at).getTime()>fiveYrsAgo;
    return (
      <div style={{maxWidth:960,margin:"0 auto"}}>
        <button onClick={()=>setSelected(null)} style={{background:"none",border:"none",color:C.dim,cursor:"pointer",fontSize:14,marginBottom:20,fontFamily:"inherit"}}>← Back to Reports</button>
        <div style={{...card,marginBottom:14}}>
          <div style={{display:"flex",flexWrap:"wrap",justifyContent:"space-between",gap:14}}>
            <div>
              <h2 style={{fontSize:22,fontWeight:800,color:"#fff",marginBottom:4}}>{selected.inspector_name}</h2>
              <p style={{color:C.gold,fontSize:14}}>{selected.company_name||"Independent"} · License {selected.license_no||"N/A"}</p>
              <p style={{color:C.dim,fontSize:12,marginTop:3}}>📍 {selected.property_address} · {fmt(selected.created_at)}</p>
              {selected.retention_until&&<p style={{color:"#3a3a3a",fontSize:10,fontFamily:"monospace",marginTop:5}}>Retained until: {fmt(selected.retention_until)}</p>}
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
              {a.trustScore&&<ScoreBadge score={a.trustScore}/>}
              {a.inspectorGrade&&<span style={{fontSize:22,fontFamily:"monospace",fontWeight:800,color:gradeColor(a.inspectorGrade)}}>{a.inspectorGrade}</span>}
              <span style={{...tag(riskColor(selected.fraud_risk)),fontSize:11}}>{selected.fraud_risk} Risk</span>
            </div>
          </div>
          {a.balanceScore!==undefined&&<div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}><BalanceBar score={a.balanceScore}/></div>}
        </div>

        {a.summary&&<div style={{...card,marginBottom:14}}><div style={cTitle}>AI Summary</div><p style={{fontSize:14,color:"#aaa",lineHeight:1.75}}>{a.summary}</p></div>}

        {/* Resend Emails */}
        <div style={{...card,marginBottom:14}}>
          <div style={cTitle}>Resend Email Summaries</div>
          {!canResend?<p style={{color:C.dim,fontSize:13}}>This report is older than 5 years and cannot be resent.</p>:(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[
                {type:"buyer",label:"Buyer",icon:"🏠"},
                {type:"seller",label:"Seller",icon:"💼"},
                {type:"realtor",label:"Realtor",icon:"📋"},
              ].map(p=>{
                const emailKey=`${p.type}_email`;
                const email=selected[emailKey]||selected.analysis_data?.[`email${p.label}`]||"";
                const key=`${selected.id}-${p.type}`;
                return (
                  <div key={p.type} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"10px 14px",background:"#0d0d0d",borderRadius:8,border:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:16}}>{p.icon}</span>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:"#fff"}}>{p.label}</div>
                        <div style={{fontSize:12,color:C.dim}}>{email||"No email on file"}</div>
                      </div>
                    </div>
                    <button
                      onClick={()=>resendEmail(selected,p.type,email)}
                      disabled={!email||resending===key}
                      style={{...bGhost,opacity:!email?0.4:1,fontSize:12,padding:"6px 14px"}}
                    >
                      {resending===key?<><Spinner/> Sending...</>:"↻ Resend"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tiered Findings */}
        {a.dealBreakers?.length>0&&<div style={{...card,marginBottom:14}}>
          <div style={{...cTitle,color:C.red}}>Deal Breakers / Major Concerns</div>
          <p style={{color:"#444",fontSize:11,marginBottom:12}}>Expected findings — not buyer bias indicators</p>
          {a.dealBreakers.map((f,i)=><div key={i} style={{borderLeft:`2px solid ${C.red}`,background:"rgba(231,76,60,0.04)",borderRadius:"0 8px 8px 0",padding:"10px 14px",marginBottom:8}}>
            <p style={{fontSize:14,fontWeight:600,color:"#fff",marginBottom:3}}>{f.item}</p>
            {f.recommendation&&<p style={{fontSize:12,color:C.muted}}>→ {f.recommendation}</p>}
          </div>)}
        </div>}
        {a.notableIssues?.length>0&&<div style={{...card,marginBottom:14}}>
          <div style={{...cTitle,color:C.gold}}>Notable Issues</div>
          {a.notableIssues.map((f,i)=><div key={i} style={{borderLeft:`2px solid ${C.gold}`,background:"rgba(200,168,75,0.04)",borderRadius:"0 8px 8px 0",padding:"10px 14px",marginBottom:8}}>
            <p style={{fontSize:14,color:"#fff",marginBottom:f.recommendation?3:0}}>{f.item}</p>
            {f.recommendation&&<p style={{fontSize:12,color:C.muted}}>→ {f.recommendation}</p>}
          </div>)}
        </div>}
        {a.minorObservations?.length>0&&<div style={{...card,marginBottom:14}}>
          <div style={{...cTitle,color:C.dim}}>Minor Observations</div>
          {a.minorObservations.map((f,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,borderLeft:`2px solid ${f.isCosmeticOverreach?"#e74c3c":"#2a2a2a"}`,background:"#0d0d0d",borderRadius:"0 8px 8px 0",padding:"8px 12px",marginBottom:6}}>
            <p style={{fontSize:13,color:"#777"}}>{f.item}</p>
            {f.isCosmeticOverreach&&<span style={{...tag(C.red),fontSize:10,flexShrink:0}}>Overreach ⚑</span>}
          </div>)}
        </div>}
      </div>
    );
  }

  return (
    <div style={{maxWidth:960,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontSize:24,fontWeight:800,marginBottom:4,letterSpacing:"-0.02em"}}>Reports Dashboard</h2>
          <p style={{color:C.dim,fontSize:14}}>All inspection reports. Any logged-in user can view.</p>
        </div>
        <div style={{...tag(C.green),fontSize:12,padding:"6px 12px"}}>✓ Open Access</div>
      </div>

      {/* Search & Filter */}
      <div style={{...card,marginBottom:20,display:"grid",gridTemplateColumns:"1fr auto auto auto",gap:10,alignItems:"flex-end"}}>
        <div>
          <label style={lbl}>Search</label>
          <input style={inp} placeholder="Inspector, company, address, license..." value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load()}/>
        </div>
        <div>
          <label style={lbl}>Year</label>
          <select style={{...inp,width:"auto"}} value={filterYear} onChange={e=>setFilterYear(e.target.value)}>
            <option value="">All years</option>
            {years.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Risk</label>
          <select style={{...inp,width:"auto"}} value={filterRisk} onChange={e=>setFilterRisk(e.target.value)}>
            <option value="">All</option>
            <option value="Low">Low</option>
            <option value="Moderate">Moderate</option>
            <option value="High">High</option>
          </select>
        </div>
        <button onClick={load} style={{...bGold,padding:"10px 18px",fontSize:13}}>Search</button>
      </div>

      {/* Stats row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:20}}>
        {[
          {n:reports.length,l:"Total Reports"},
          {n:reports.filter(r=>r.fraud_risk==="High").length,l:"High Risk",c:C.red},
          {n:reports.filter(r=>r.balance_score&&r.balance_score<35).length,l:"Buyer-Biased",c:C.gold},
          {n:reports.filter(r=>r.status==="complete").length,l:"Analyzed"},
        ].map(s=>(
          <div key={s.l} style={{...cardSm,textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:800,color:s.c||C.gold,fontFamily:"monospace",marginBottom:2}}>{s.n}</div>
            <div style={{fontSize:11,color:C.dim}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Reports table */}
      {loading?(
        <div style={{textAlign:"center",padding:"60px 0"}}><Spinner lg/><p style={{color:C.dim,marginTop:16,fontSize:14}}>Loading reports...</p></div>
      ):reports.length===0?(
        <div style={{textAlign:"center",padding:"60px 0",border:`1px dashed ${C.border}`,borderRadius:12}}>
          <div style={{fontSize:48,marginBottom:14}}>📋</div>
          <p style={{color:C.dim}}>No reports found.</p>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {reports.map(r=>{
            const a=r.analysis_data||{};
            return (
              <div key={r.id} style={{...card,cursor:"pointer"}} onClick={()=>setSelected(r)}>
                <div style={{display:"flex",flexWrap:"wrap",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                      <span style={{fontWeight:700,fontSize:15,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.inspector_name}</span>
                      {r.report_year&&<span style={{...tag(C.blue),fontSize:10}}>{r.report_year}</span>}
                    </div>
                    <div style={{color:C.dim,fontSize:12,marginBottom:3}}>{r.company_name||"Independent"} {r.license_no?`· ${r.license_no}`:""}</div>
                    <div style={{color:C.dim,fontSize:12}}>📍 {r.property_address||"No address"} · {fmt(r.created_at)}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    {r.trust_score&&<ScoreBadge score={r.trust_score}/>}
                    {r.fraud_risk&&<span style={tag(riskColor(r.fraud_risk))}>{r.fraud_risk} Risk</span>}
                    {r.inspector_grade&&<span style={{fontSize:16,fontFamily:"monospace",fontWeight:800,color:gradeColor(r.inspector_grade)}}>{r.inspector_grade}</span>}
                    <span style={{color:r.status==="complete"?C.green:C.gold,fontSize:11,fontFamily:"monospace"}}>{r.status==="complete"?"✓ Complete":"⋯ Analyzing"}</span>
                  </div>
                </div>
                {r.balance_score!==undefined&&<div style={{marginTop:10}}><BalanceBar score={r.balance_score}/></div>}
                {a.summary&&<p style={{color:"#666",fontSize:12,marginTop:10,lineHeight:1.6,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{a.summary}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── YEARLY RANKINGS ──────────────────────────────────────────
function YearlyRankings({session}) {
  const [data,setData]=useState([]);
  const [year,setYear]=useState(new Date().getFullYear()-1);
  const [loading,setLoading]=useState(true);
  const currentYear=new Date().getFullYear();

  const load=async()=>{
    if(!session?.token)return;
    setLoading(true);
    try {
      const SB=window.__SB_URL__;
      if(!SB){setLoading(false);return;}
      const res=await fetch(`${SB}/rest/v1/yearly_summaries?year=eq.${year}&order=ranking.asc&select=*`,{
        headers:{"apikey":window.__SB_ANON__,"Authorization":`Bearer ${session.token}`},
      });
      const d=await res.json();
      setData(Array.isArray(d)?d:[]);
    } catch{}
    finally{setLoading(false);}
  };
  useEffect(()=>{load();},[year]);

  const medal=(rank)=>rank===1?"🥇":rank===2?"🥈":rank===3?"🥉":"";
  const gradeColor=g=>g==="A"?C.green:g==="B"?C.gold:g==="C"?"#e67e22":C.red;

  return (
    <div style={{maxWidth:960,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontSize:24,fontWeight:800,marginBottom:4,letterSpacing:"-0.02em"}}>Yearly Inspector Rankings</h2>
          <p style={{color:C.dim,fontSize:14}}>Annual performance leaderboard — inspectors compete to improve.</p>
        </div>
        <select style={{...inp,width:"auto",fontSize:14}} value={year} onChange={e=>setYear(Number(e.target.value))}>
          {Array.from({length:5},(_,i)=>currentYear-1-i).map(y=><option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {loading?(
        <div style={{textAlign:"center",padding:"60px 0"}}><Spinner lg/></div>
      ):data.length===0?(
        <div style={{textAlign:"center",padding:"60px 0",border:`1px dashed ${C.border}`,borderRadius:12}}>
          <div style={{fontSize:48,marginBottom:14}}>📊</div>
          <p style={{color:C.dim,marginBottom:6}}>No yearly summary available for {year}.</p>
          <p style={{color:"#444",fontSize:13}}>Summaries are auto-generated on January 1st each year.</p>
        </div>
      ):(
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:20}}>
            {[
              {n:data.length,l:"Inspectors Ranked"},
              {n:data.reduce((s,d)=>s+(d.total_inspections||0),0),l:"Total Inspections"},
              {n:data[0]?.inspector_name?.split(" ")[0]||"—",l:"Top Inspector",c:C.gold},
              {n:data[0]?.avg_trust_score||"—",l:"Top Score",c:C.green},
            ].map(s=>(
              <div key={s.l} style={{...cardSm,textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:800,color:s.c||C.gold,fontFamily:"monospace",marginBottom:2}}>{s.n}</div>
                <div style={{fontSize:11,color:C.dim}}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {data.map(d=>(
              <div key={d.id} style={{...card,borderColor:d.ranking<=3?`${C.gold}40`:C.border}}>
                <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                  <div style={{fontSize:28,fontFamily:"monospace",fontWeight:800,color:d.ranking<=3?C.gold:C.dim,minWidth:40}}>
                    {medal(d.ranking)||`#${d.ranking}`}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:16,color:"#fff",marginBottom:2}}>{d.inspector_name}</div>
                    <div style={{color:C.dim,fontSize:12}}>{d.total_inspections} inspections · License {d.license_no}</div>
                  </div>
                  <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:20,fontWeight:800,color:C.gold,fontFamily:"monospace"}}>{d.avg_trust_score}</div>
                      <div style={{fontSize:10,color:C.dim}}>Trust Score</div>
                    </div>
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:20,fontWeight:800,color:gradeColor(d.avg_grade),fontFamily:"monospace"}}>{d.avg_grade}</div>
                      <div style={{fontSize:10,color:C.dim}}>Grade</div>
                    </div>
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:16,fontWeight:700,color:C.green,fontFamily:"monospace"}}>{d.percentile}th</div>
                      <div style={{fontSize:10,color:C.dim}}>Percentile</div>
                    </div>
                  </div>
                </div>
                <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:13,color:C.gold,fontFamily:"monospace",fontWeight:700}}>{d.avg_balance_score}</div>
                    <div style={{fontSize:10,color:C.dim}}>Balance Score</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:13,color:C.red,fontFamily:"monospace",fontWeight:700}}>{d.major_findings_count}</div>
                    <div style={{fontSize:10,color:C.dim}}>Major Findings</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:13,color:C.muted,fontFamily:"monospace",fontWeight:700}}>{d.minor_findings_count}</div>
                    <div style={{fontSize:10,color:C.dim}}>Minor Obs.</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Disclaimer() {
  return (
    <div style={{borderTop:`1px solid #1a1a1a`,marginTop:60,padding:"20px 24px"}}>
      <div style={{maxWidth:960,margin:"0 auto"}}>
        <p style={{color:"#2a2a2a",fontSize:10,fontFamily:"monospace",lineHeight:1.8}}>
          <span style={{color:"#3a3a3a",fontWeight:700}}>AI-GENERATED ANALYSIS DISCLOSURE:</span>{" "}All inspector scores, Balance Scores, fraud risk ratings, and summaries are generated by artificial intelligence based solely on submitted inspection report content. These assessments represent automated, opinion-based analysis and do not constitute verified facts, legal findings, background check results, or official determinations by any licensing board or regulatory authority. Users should independently verify all information before making real estate or financial decisions. Buyer/seller email addresses are not publicly exposed — they are gated behind login per CAN-SPAM and privacy guidelines. © {new Date().getFullYear()} InspectorTrust.
        </p>
      </div>
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────
export default function App() {
  const [view,setView]=useState("home");
  const [uploadStep,setUploadStep]=useState(0);
  const [reports,setReports]=useState([]);
  const [uploading,setUploading]=useState(false);
  const [parsing,setParsing]=useState(false);
  const [analysisResult,setAnalysisResult]=useState(null);
  const [emailSending,setEmailSending]=useState(false);
  const [emailSent,setEmailSent]=useState(false);
  const [toast,setToast]=useState(null);
  const [dragOver,setDragOver]=useState(false);
  const [showAuth,setShowAuth]=useState(false);
  const [session,setSession]=useState(null);
  const [mobileMenu,setMobileMenu]=useState(false);
  const fileRef=useRef();
  const [form,setForm]=useState({inspectorName:"",companyName:"",licenseNo:"",street:"",city:"",state:"",zip:"",buyerEmail:"",sellerEmail:"",realtorEmail:"",reportText:"",fileName:""});
  const [missing,setMissing]=useState({});

  useEffect(()=>{const s=getSession();if(s){setSession(s);loadRegistryReports(s.token);};},[]);

  const loadRegistryReports=async(token)=>{
    if(!token)return;
    try{
      const res=await fetch("/api/analyze",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},
        body:JSON.stringify({mode:"get_reports"}),
      });
      const data=await res.json();
      if(data.reports){
        // Normalize DB reports to match local report shape
        const normalized=data.reports.map(r=>({
          id:r.id,
          inspectorName:r.inspector_name||"Unknown",
          companyName:r.company_name||"",
          licenseNo:r.license_no||"",
          propertyAddress:r.property_address||"",
          buyerEmail:r.buyer_email||"",
          sellerEmail:r.seller_email||"",
          realtorEmail:r.realtor_email||"",
          savedToDb:true,
          date:r.created_at?new Date(r.created_at).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}):"",
          analysis:r.analysis_data||{
            trustScore:r.trust_score||0,
            fraudRisk:r.fraud_risk||"Unknown",
            balanceScore:r.balance_score||50,
            inspectorGrade:r.inspector_grade||"?",
            summary:"Analysis data loading...",
            dealBreakers:[],notableIssues:[],minorObservations:[],
            strengths:[],concerns:[],biasIndicators:[],redFlags:[],
            recommendation:"",emailBuyer:"",emailSeller:"",emailRealtor:"",
          },
        }));
        setReports(normalized);
      }
    }catch(e){console.error("Failed to load registry:",e);}
  };

  const deleteReport=async(reportId)=>{
    if(!session?.token)return;
    // Check if this is a real DB UUID or a local fake ID
    const isRealId = reportId && reportId.length > 20 && reportId.includes("-");
    if(!isRealId){
      // Reload from DB first to get real IDs
      showToast("Refreshing reports from database...","error");
      await loadRegistryReports(session.token);
      showToast("Reports refreshed. Please try deleting again.","error");
      return;
    }
    if(!confirm("Permanently delete this report? This cannot be undone."))return;
    try{
      const res=await fetch("/api/analyze",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.token}`},
        body:JSON.stringify({mode:"delete_report",reportId}),
      });
      const data=await res.json();
      if(data.success){
        setReports(r=>r.filter(rpt=>rpt.id!==reportId));
        showToast("Report deleted successfully.");
      } else showToast(data.error||"Delete failed","error");
    }catch{showToast("Network error","error");}
  };

  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),4000);};
  const setField=k=>v=>setForm(f=>({...f,[k]:v}));
  const onAuth=(profile,token)=>{const s={token,profile};saveSession(s);setSession(s);loadRegistryReports(token);};
  const signOut=()=>{clearSession();setSession(null);setView("home");showToast("Signed out.");setMobileMenu(false);};
  const navTo=v=>{setView(v);setMobileMenu(false);if(v==="upload")setUploadStep(0);};

  const trialDays=session?.profile?.trial_started_at?Math.max(0,14-Math.floor((Date.now()-new Date(session.profile.trial_started_at))/86400000)):null;

  const extractPdfText=async(file)=>{
    return new Promise((resolve,reject)=>{
      const load=()=>new Promise((res,rej)=>{
        if(window.pdfjsLib){res();return;}
        const s=document.createElement("script");
        s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";res();};
        s.onerror=rej;document.head.appendChild(s);
      });
      const reader=new FileReader();
      reader.onload=async(ev)=>{
        try{
          await load();
          const pdf=await window.pdfjsLib.getDocument({data:ev.target.result}).promise;
          let text="";
          for(let i=1;i<=Math.min(pdf.numPages,40);i++){
            const page=await pdf.getPage(i);
            const content=await page.getTextContent();
            text+=content.items.map(it=>it.str).join(" ")+"\n";
          }
          resolve(text);
        }catch(e){reject(e);}
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const parseReport=async(text,fileName)=>{
    setParsing(true);
    try{
      const res=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"parse",reportText:text})});
      const data=await res.json();
      const p=data.parsed||{};
      // Pre-fill with extracted values — empty string means not found
      const nf={
        inspectorName:p.inspectorName||"",
        companyName:p.companyName||"",
        licenseNo:p.licenseNo||"",
        street:p.street||"",
        city:p.city||"",
        state:p.state||"",
        zip:p.zip||"",
        buyerEmail:p.buyerEmail||"",
        sellerEmail:p.sellerEmail||"",
        realtorEmail:p.realtorEmail||"",
        reportText:text,
        fileName
      };
      setForm(nf);
      // Only mark as missing if truly empty after extraction
      const m={};
      ["inspectorName","street","city","state","zip"].forEach(k=>{
        if(!nf[k] || nf[k].trim()==="") m[k]=true;
      });
      setMissing(m);
      setUploadStep(1);
      // Show what was found vs missing
      const found=Object.entries(nf).filter(([k,v])=>v&&v.trim()&&k!=="reportText"&&k!=="fileName").map(([k])=>k);
      const notFound=["inspectorName","companyName","street","city","state","zip"].filter(k=>!nf[k]);
      if(notFound.length>0) showToast(`Found: ${found.length} fields. Missing: ${notFound.join(", ")}. Please fill in.`,"error");
      else showToast("All fields extracted successfully ✓");
    }catch(e){
      showToast("Parse error: "+e.message,"error");
      setForm(f=>({...f,reportText:text,fileName}));
      setMissing({inspectorName:true,street:true,city:true,state:true,zip:true});
      setUploadStep(1);
    }finally{setParsing(false);}
  };

  const handleFile=async(file)=>{
    if(!file)return;setParsing(true);
    try{
      let text="";
      if(file.type==="application/pdf"||file.name.endsWith(".pdf"))text=await extractPdfText(file);
      else text=await new Promise((res,rej)=>{const r=new FileReader();r.onload=ev=>res(ev.target.result);r.onerror=rej;r.readAsText(file);});
      if(!text||text.trim().length<20){showToast("Could not read text. Try pasting instead.","error");setParsing(false);return;}
      // Prepend filename as a hint to the parser — address often in filename
      const hint = `FILE NAME HINT: ${file.name}\n\n`;
      await parseReport(hint+text, file.name);
    }catch(e){showToast("File read failed: "+e.message,"error");setParsing(false);}
  };

  const handleDrop=e=>{e.preventDefault();setDragOver(false);handleFile(e.dataTransfer.files[0]);};

  const handleAnalyze=async()=>{
    if(!session?.token){setShowAuth(true);return;}
    if(!form.inspectorName||!form.street||!form.reportText){showToast("Inspector name and address are required.","error");return;}
    const addr=[form.street,form.city,form.state,form.zip].filter(Boolean).join(", ");
    setUploading(true);setUploadStep(2);
    try{
      const res=await fetch("/api/analyze",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.token}`},
        body:JSON.stringify({mode:"analyze",inspectorName:form.inspectorName,companyName:form.companyName,licenseNo:form.licenseNo,propertyAddress:addr,reportText:form.reportText}),
      });
      const data=await res.json();
      if(!res.ok){
        if(data.code==="TRIAL_EXPIRED"){setView("account");showToast(data.message,"error");return;}
        if(res.status===401){clearSession();setSession(null);setUploadStep(1);setShowAuth(true);showToast("Session expired — sign in again, your report is still here.","error");return;}
        throw new Error(data.error||"Analysis failed");
      }
      const nr={id:data.reportId||genId(),...form,propertyAddress:addr,analysis:data.analysis,savedToDb:data.saved,date:fmt(new Date())};
      setReports(r=>[nr,...r]);setAnalysisResult(nr);
      setView("report");setUploadStep(0);
      setForm({inspectorName:"",companyName:"",licenseNo:"",street:"",city:"",state:"",zip:"",buyerEmail:"",sellerEmail:"",realtorEmail:"",reportText:"",fileName:""});
      showToast(data.saved?"Report analyzed and saved permanently ✓":"Report analyzed.");
      if(data.saved&&session?.token)setTimeout(()=>loadRegistryReports(session.token),2000);
      if(session.profile){const up={...session.profile,inspection_count:(session.profile.inspection_count||0)+1};const ns={...session,profile:up};saveSession(ns);setSession(ns);}
    }catch(err){showToast("Analysis failed: "+err.message,"error");setUploadStep(1);}
    finally{setUploading(false);}
  };

  const sendEmails=async()=>{setEmailSending(true);await new Promise(r=>setTimeout(r,1800));setEmailSending(false);setEmailSent(true);showToast("Email summaries dispatched.");};
  const viewReport=r=>{setAnalysisResult(r);setEmailSent(false);setView("report");};

  const navLinks=[
    ["upload","Upload"],
    ["database",`Registry (${reports.length})`],
    ["reports","Reports"],
    ["directory","Find Inspectors"],
    ["rankings","Rankings"],
  ];

  return (
    <div style={{minHeight:"100vh",background:C.base,color:C.text,fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=DM+Mono:wght@400;500&display=swap');
        @keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        button:hover{opacity:0.88}
        input:focus,select:focus{border-color:#C8A84B!important;outline:none}
        select{background:#0a0a0a;color:#e8e8e8;border:1px solid #222;borderRadius:6px;padding:10px 12px;fontSize:14px;fontFamily:inherit;cursor:pointer}
        .desktop-nav{display:flex!important}
        .mobile-ham{display:none!important}
        @media(max-width:640px){.desktop-nav{display:none!important}.mobile-ham{display:block!important}}
      `}</style>

      {toast&&<div style={{position:"fixed",top:16,right:16,zIndex:9999,background:C.surface,border:`1px solid ${toast.type==="error"?C.red:C.gold}`,color:toast.type==="error"?C.red:C.gold,padding:"12px 18px",borderRadius:8,fontSize:12,fontFamily:"monospace",maxWidth:320,animation:"fadeIn 0.3s ease",boxShadow:"0 4px 20px rgba(0,0,0,0.4)"}}>{toast.msg}</div>}
      {showAuth&&<AuthModal onClose={()=>setShowAuth(false)} onAuth={onAuth}/>}

      {/* HEADER */}
      <header style={{position:"sticky",top:0,zIndex:100,background:"rgba(14,14,14,0.96)",borderBottom:`1px solid ${C.border}`,backdropFilter:"blur(10px)"}}>
        <div style={{maxWidth:960,margin:"0 auto",padding:"0 16px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <button onClick={()=>navTo("home")} style={{background:"none",border:"none",color:C.gold,fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:"-0.01em"}}>▲ InspectorTrust</button>
          <nav className="desktop-nav" style={{display:"flex",gap:2,alignItems:"center"}}>
            {navLinks.map(([v,l])=><button key={v} onClick={()=>navTo(v)} style={{background:view===v?"rgba(200,168,75,0.08)":"none",border:"none",color:view===v?C.gold:C.muted,fontSize:13,fontWeight:500,cursor:"pointer",padding:"6px 10px",borderRadius:6,fontFamily:"inherit"}}>{l}</button>)}
            {session?(
              <>
                <button onClick={()=>navTo("account")} style={{background:"none",border:view==="account"?`1px solid ${C.gold}`:"1px solid #2a2a2a",color:view==="account"?C.gold:C.muted,fontSize:13,cursor:"pointer",padding:"6px 10px",borderRadius:6,fontFamily:"inherit",marginLeft:4}}>Account{session.profile?.subscription_status==="trial"?" 🕐":session.profile?.subscription_status==="expired"?" ⚠️":""}</button>
                <button onClick={signOut} style={{background:"none",border:"none",color:"#444",fontSize:13,cursor:"pointer",padding:"6px 8px",fontFamily:"inherit"}}>Out</button>
              </>
            ):<button onClick={()=>setShowAuth(true)} style={{...bGold,fontSize:13,padding:"8px 16px",marginLeft:4}}>Sign In →</button>}
          </nav>
          <button className="mobile-ham" onClick={()=>setMobileMenu(m=>!m)} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>{mobileMenu?"✕":"☰"}</button>
        </div>
        {mobileMenu&&(
          <div style={{background:C.base,borderTop:`1px solid ${C.border}`}}>
            {navLinks.map(([v,l])=><button key={v} onClick={()=>navTo(v)} style={{display:"block",width:"100%",textAlign:"left",padding:"13px 20px",fontSize:14,color:view===v?C.gold:C.muted,background:"none",border:"none",borderBottom:`1px solid ${C.border}`,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>)}
            {session?<><button onClick={()=>navTo("account")} style={{display:"block",width:"100%",textAlign:"left",padding:"13px 20px",fontSize:14,color:view==="account"?C.gold:C.muted,background:"none",border:"none",borderBottom:`1px solid ${C.border}`,cursor:"pointer",fontFamily:"inherit"}}>Account</button><button onClick={signOut} style={{display:"block",width:"100%",textAlign:"left",padding:"13px 20px",fontSize:14,color:"#444",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>Sign Out</button></>
              :<button onClick={()=>{setShowAuth(true);setMobileMenu(false);}} style={{display:"block",width:"100%",textAlign:"left",padding:"13px 20px",fontSize:14,color:C.gold,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Sign In →</button>}
          </div>
        )}
      </header>

      {/* HOME */}
      {view==="home"&&<main style={{maxWidth:960,margin:"0 auto",padding:"0 16px 80px"}}>
        <div style={{textAlign:"center",padding:"40px 0 28px"}}>
          <div style={pill}>AI-Powered · Real Estate Transparency</div>
          <h1 style={{fontSize:"clamp(28px,6vw,52px)",fontWeight:800,letterSpacing:"-0.03em",color:"#fff",margin:"14px 0 12px",lineHeight:1.1}}>Know Who's Really<br/><span style={{color:C.gold}}>Inspecting Your Home.</span></h1>
          <p style={{fontSize:"clamp(13px,2vw,15px)",color:"#666",maxWidth:500,margin:"0 auto 22px",lineHeight:1.7}}>The first transparent inspection platform scoring every inspector on fairness, balance, and accuracy — separating real defects from negotiation tactics.</p>
          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
            <button style={bGold} onClick={()=>session?navTo("upload"):setShowAuth(true)}>{session?"Analyze a Report →":"Get Started Free →"}</button>
            <button style={bOut} onClick={()=>navTo("reports")}>View Reports Dashboard</button>
          </div>
        </div>

        <div style={{...card,marginBottom:24,borderColor:"rgba(200,168,75,0.25)",background:"rgba(200,168,75,0.02)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><div style={pill}>Feature</div><div style={{...cTitle,marginBottom:0}}>Inspector Balance Score</div></div>
          <h3 style={{fontSize:"clamp(15px,2.5vw,18px)",fontWeight:700,color:"#fff",marginBottom:10}}>Major findings are expected. Cosmetic padding is buyer bias.</h3>
          <p style={{fontSize:13,color:"#666",lineHeight:1.7,marginBottom:18}}>Finding structural issues, electrical problems, HVAC failures = <strong style={{color:C.gold}}>balanced, professional behavior</strong>. Flagging 20 cosmetic items as urgent concerns = buyer bias that hurts sellers.</p>
          <BalanceBar score={52}/>
          <p style={{color:"#333",fontSize:10,marginTop:10,fontStyle:"italic"}}>Example. Green = balanced. Red = biased.</p>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:32}}>
          {[{n:"1 in 4",l:"inspectors flagged"},{n:"14-day",l:"free trial"},{n:"$20/yr",l:"after trial"},{n:"10 yrs",l:"data retention"}].map(s=>(
            <div key={s.l} style={{...cardSm,textAlign:"center"}}><div style={{fontSize:"clamp(18px,3vw,24px)",fontWeight:800,color:C.gold,fontFamily:"monospace",marginBottom:3}}>{s.n}</div><div style={{fontSize:11,color:C.dim}}>{s.l}</div></div>
          ))}
        </div>

        <h2 style={{fontSize:"clamp(18px,3vw,22px)",fontWeight:700,letterSpacing:"-0.02em",marginBottom:6}}>Simple Pricing</h2>
        <p style={{color:C.dim,fontSize:14,marginBottom:18}}>For buyers, sellers, and realtors.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginBottom:40}}>
          {[
            {title:"Buyer / Seller",price:"Free",color:C.green,features:["Browse inspector registry","View all reports & scores","See major issues summary","No restrictions on viewing"],btn:"green",lbl:"Create Free Account →"},
            {title:"Realtor Trial",price:"14 Days Free",color:C.gold,features:["Upload & analyze reports","Full AI performance reviews","Balance Score on every report","Auto email all parties","PDF export"],btn:"gold",lbl:"Start Free Trial →"},
            {title:"Realtor Annual",price:"$20 / year",color:C.blue,features:["Everything in trial","Unlimited reports","50+ reports = free first year","Reports saved 10 years","Yearly inspector rankings"],btn:"blue",lbl:"Get Realtor Access →"},
          ].map(p=>(
            <div key={p.title} style={{...card,borderColor:`${p.color}30`,display:"flex",flexDirection:"column"}}>
              <div style={{color:p.color,fontSize:10,fontFamily:"monospace",letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:7}}>{p.title}</div>
              <div style={{fontSize:"clamp(20px,3vw,24px)",fontWeight:800,color:"#fff",marginBottom:12}}>{p.price}</div>
              <div style={{flex:1,marginBottom:18}}>{p.features.map(f=><div key={f} style={{display:"flex",gap:8,fontSize:13,color:"#777",marginBottom:7}}><span style={{color:p.color,flexShrink:0}}>✓</span>{f}</div>)}</div>
              {p.btn==="green"&&<button style={bGrn} onClick={()=>setShowAuth(true)}>{p.lbl}</button>}
              {p.btn==="gold"&&<button style={{...bGold,width:"100%",justifyContent:"center"}} onClick={()=>setShowAuth(true)}>{p.lbl}</button>}
              {p.btn==="blue"&&<button style={bBlu} onClick={()=>setShowAuth(true)}>{p.lbl}</button>}
            </div>
          ))}
        </div>

        <h2 style={{fontSize:"clamp(18px,3vw,22px)",fontWeight:700,letterSpacing:"-0.02em",marginBottom:18}}>How It Works</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14}}>
          {[
            {n:"01",t:"Drop Your Report",b:"Upload any PDF. AI reads it instantly — up to 40 pages extracted automatically."},
            {n:"02",t:"Confirm Details",b:"We auto-fill everything found. You only fill in what's missing."},
            {n:"03",t:"Get Balanced Review",b:"Tiered findings: deal breakers, notable issues, and minor observations separately."},
            {n:"04",t:"Notify All Parties",b:"Buyer, seller, and realtor each get a tailored AI-written email summary."},
          ].map(s=>(
            <div key={s.n} style={card}><div style={{fontSize:22,fontWeight:800,color:C.gold,fontFamily:"monospace",opacity:0.6,marginBottom:10}}>{s.n}</div><h3 style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:6}}>{s.t}</h3><p style={{fontSize:12,color:"#666",lineHeight:1.6}}>{s.b}</p></div>
          ))}
        </div>
      </main>}

      {/* UPLOAD */}
      {view==="upload"&&<main style={{maxWidth:680,margin:"0 auto",padding:"24px 16px 80px"}}>
        <h2 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",marginBottom:6}}>Submit Inspection Report</h2>
        <p style={{color:C.dim,fontSize:14,marginBottom:20}}>{uploadStep===0?"Drop your report — AI extracts everything automatically.":uploadStep===1?"Fill in anything we couldn't find in the report.":"Analyzing — this takes 20–40 seconds..."}</p>
        {session?.profile?.subscription_status==="trial"&&<div style={{display:"flex",alignItems:"center",gap:10,background:"rgba(200,168,75,0.06)",border:"1px solid rgba(200,168,75,0.2)",borderRadius:8,padding:"10px 14px",marginBottom:18,fontSize:13}}><span>🕐</span><span style={{color:C.gold}}>Trial — {trialDays} days remaining.</span><button onClick={()=>navTo("account")} style={{marginLeft:"auto",background:"none",border:"none",color:C.gold,fontSize:12,cursor:"pointer",textDecoration:"underline",fontFamily:"inherit"}}>Manage →</button></div>}
        <StepIndicator step={uploadStep}/>

        {uploadStep===0&&<div>
          <div
            style={{border:`2px dashed ${dragOver?C.gold:"#2a2a2a"}`,borderRadius:12,padding:"48px 24px",textAlign:"center",cursor:"pointer",background:dragOver?"rgba(200,168,75,0.04)":"#0a0a0a",display:"flex",flexDirection:"column",alignItems:"center",gap:12,minHeight:220,justifyContent:"center",transition:"all 0.2s"}}
            onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={handleDrop} onClick={()=>fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".txt,.pdf,.doc,.docx" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
            {parsing?<><Spinner lg/><span style={{color:C.gold,fontSize:14,fontFamily:"monospace"}}>Reading report...</span><span style={{fontSize:12,color:C.dim}}>Extracting details automatically</span></>
              :<><span style={{fontSize:48}}>📋</span><span style={{color:C.gold,fontSize:15,fontWeight:700}}>Drop your inspection report here</span><span style={{fontSize:13,color:C.dim}}>or tap to browse · PDF, Word, or text</span><span style={{fontSize:11,color:C.faint,marginTop:4}}>AI reads up to 40 pages · auto-extracts all details</span></>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12,margin:"18px 0"}}><div style={{flex:1,height:1,background:C.border}}/><span style={{fontSize:12,color:"#444"}}>or paste report text</span><div style={{flex:1,height:1,background:C.border}}/></div>
          <textarea style={{...inp,minHeight:120,resize:"vertical",lineHeight:1.6,fontSize:12,fontFamily:"monospace"}} placeholder="Paste the full inspection report text here..." onChange={e=>{if(e.target.value.length>50)parseReport(e.target.value,"pasted report");}}/>
        </div>}

        {uploadStep===1&&<div style={{animation:"fadeIn 0.2s ease"}}>
          {form.fileName&&<div style={{display:"flex",alignItems:"center",gap:10,...cardSm,marginBottom:14}}><span style={{fontSize:18}}>📄</span><span style={{color:C.gold,fontSize:13,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{form.fileName}</span><button onClick={()=>{setUploadStep(0);setForm(f=>({...f,reportText:"",fileName:""}));}} style={{background:"none",border:"none",color:C.dim,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>✕ Remove</button></div>}
          {Object.keys(missing).length>0&&<div style={{display:"flex",alignItems:"center",gap:10,background:"rgba(200,168,75,0.06)",border:"1px solid rgba(200,168,75,0.2)",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13,color:C.gold}}>⚠️ {Object.keys(missing).length} field{Object.keys(missing).length>1?"s":""} not found — please fill {Object.keys(missing).length>1?"them":"it"} in.</div>}
          <div style={card}>
            <div style={cTitle}>Inspector Details</div>
            <Field label="Inspector Full Name" value={form.inspectorName} onChange={setField("inspectorName")} placeholder="John Smith" required missing={missing.inspectorName}/>
            <Field label="Company / Firm" value={form.companyName} onChange={setField("companyName")} placeholder="Apex Home Inspections LLC"/>
            <Field label="License Number" value={form.licenseNo} onChange={setField("licenseNo")} placeholder="HI-20984 or TREC #12345"/>
          </div>
          <div style={{...card,marginTop:14}}>
            <div style={cTitle}>Property Address</div>
            <Field label="Street Address" value={form.street} onChange={setField("street")} placeholder="123 Maple Street" required missing={missing.street}/>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:10}}>
              <Field label="City" value={form.city} onChange={setField("city")} placeholder="Austin" required missing={missing.city}/>
              <Field label="State" value={form.state} onChange={setField("state")} placeholder="TX" required missing={missing.state}/>
              <Field label="ZIP" value={form.zip} onChange={setField("zip")} placeholder="78701" required missing={missing.zip}/>
            </div>
          </div>
          <div style={{...card,marginTop:14}}>
            <div style={cTitle}>Notify Parties <span style={{color:"#444",fontWeight:400}}>(optional)</span></div>
            <p style={{color:C.dim,fontSize:12,marginBottom:14}}>Each party receives an AI-written email that clearly separates major findings from cosmetic observations.</p>
            {[["Buyer Email","buyerEmail","buyer@email.com"],["Seller Email","sellerEmail","seller@email.com"],["Realtor Email","realtorEmail","agent@realty.com"]].map(([l,k,ph])=>(
              <div key={k} style={{marginBottom:12}}><label style={lbl}>{l}</label><input style={inp} type="email" placeholder={ph} value={form[k]} onChange={e=>setField(k)(e.target.value)}/></div>
            ))}
            <p style={{color:"#333",fontSize:10,marginTop:6}}>By providing emails, you confirm consent to contact these parties (CAN-SPAM compliance).</p>
          </div>
          <div style={{display:"flex",gap:12,marginTop:18,flexWrap:"wrap"}}>
            <button style={bOut} onClick={()=>setUploadStep(0)}>← Start Over</button>
            <button style={{...bGold,flex:1,justifyContent:"center",opacity:uploading?0.7:1}} onClick={handleAnalyze} disabled={uploading}>{uploading?<><Spinner/> Analyzing...</>:"Run AI Analysis →"}</button>
          </div>
        </div>}

        {uploadStep===2&&<div style={{textAlign:"center",padding:"60px 0",animation:"fadeIn 0.2s ease"}}>
          <span style={{display:"block",width:44,height:44,margin:"0 auto 22px",border:"3px solid rgba(200,168,75,0.2)",borderTopColor:C.gold,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
          <p style={{color:C.gold,fontFamily:"monospace",fontSize:15,marginBottom:10}}>Analyzing report with AI...</p>
          <p style={{color:C.dim,fontSize:13,maxWidth:360,margin:"0 auto 8px"}}>Scoring balance, completeness, and fraud risk. Categorizing deal breakers vs minor observations.</p>
          <p style={{color:"#333",fontSize:11}}>Typically 20–40 seconds for full reports</p>
        </div>}
      </main>}

      {/* REPORT VIEW */}
      {view==="report"&&analysisResult&&<ReportView report={analysisResult} onSendEmails={sendEmails} emailSending={emailSending} emailSent={emailSent} onBack={()=>navTo("database")}/>}

      {/* REGISTRY */}
      {view==="database"&&<main style={{maxWidth:960,margin:"0 auto",padding:"24px 16px 80px"}}>
        <h2 style={{fontSize:24,fontWeight:800,marginBottom:4,letterSpacing:"-0.02em"}}>Inspector Registry</h2>
        <p style={{color:C.dim,fontSize:14,marginBottom:20}}>Session reports. Full history is in the Reports Dashboard.</p>
        {reports.length===0?(
          <div style={{textAlign:"center",padding:"60px 0",border:`1px dashed ${C.border}`,borderRadius:12}}>
            <div style={{fontSize:48,marginBottom:14}}>🔍</div>
            <p style={{color:C.dim,marginBottom:6}}>No reports in this session yet.</p>
            <button style={{...bGold,marginTop:14}} onClick={()=>session?navTo("upload"):setShowAuth(true)}>{session?"Submit a report":"Sign In to Submit"}</button>
          </div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
            {reports.map(r=>(
              <div key={r.id} style={card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div style={{flex:1,minWidth:0,marginRight:10}}>
                    <div style={{fontWeight:700,fontSize:16,color:"#fff",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.inspectorName}</div>
                    <div style={{color:C.dim,fontSize:13}}>{r.companyName||"Independent"}</div>
                  </div>
                  <ScoreBadge score={r.analysis.trustScore}/>
                </div>
                <div style={{marginBottom:10}}><BalanceBar score={r.analysis.balanceScore||50}/></div>
                <div style={{color:C.dim,fontSize:12,marginBottom:6}}>📍 {r.propertyAddress}</div>
                <p style={{color:"#777",fontSize:12,lineHeight:1.6,marginBottom:10,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{r.analysis.summary?.slice(0,100)}…</p>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={tag(r.analysis.fraudRisk==="High"?C.red:r.analysis.fraudRisk==="Moderate"?C.gold:C.green)}>{r.analysis.fraudRisk} Risk</span>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    {session?.profile?.role==="admin"&&(
                      <button onClick={e=>{e.stopPropagation();deleteReport(r.id);}} style={{background:"none",border:`1px solid ${C.red}`,color:C.red,fontSize:11,cursor:"pointer",padding:"3px 10px",borderRadius:4,fontFamily:"inherit",fontWeight:600}}>Delete</button>
                    )}
                    <button style={{background:"none",border:"none",color:C.gold,fontSize:13,cursor:"pointer",fontWeight:600,fontFamily:"inherit"}} onClick={()=>viewReport(r)}>Full Review →</button>
                  </div>
                </div>
                {r.savedToDb&&<div style={{color:C.green,fontSize:10,fontFamily:"monospace",marginTop:6}}>✓ Saved · 10yr retention</div>}
              </div>
            ))}
          </div>
        )}
      </main>}

      {/* REPORTS DASHBOARD */}
      {view==="reports"&&(session?<main style={{maxWidth:960,margin:"0 auto",padding:"24px 16px 80px"}}><ReportsDashboard session={session} showToast={showToast}/></main>:<main style={{maxWidth:960,margin:"0 auto",padding:"60px 16px",textAlign:"center"}}><p style={{color:C.dim,fontSize:16,marginBottom:20}}>Sign in to access the Reports Dashboard.</p><button style={bGold} onClick={()=>setShowAuth(true)}>Sign In →</button></main>)}

      {/* RANKINGS */}
      {view==="rankings"&&(session?<main style={{maxWidth:960,margin:"0 auto",padding:"24px 16px 80px"}}><YearlyRankings session={session}/></main>:<main style={{maxWidth:960,margin:"0 auto",padding:"60px 16px",textAlign:"center"}}><p style={{color:C.dim,fontSize:16,marginBottom:20}}>Sign in to view inspector rankings.</p><button style={bGold} onClick={()=>setShowAuth(true)}>Sign In →</button></main>)}

      {/* ACCOUNT */}
      {view==="account"&&session&&<main style={{maxWidth:960,margin:"0 auto",padding:"24px 16px 80px"}}><AccountPage profile={session.profile} token={session.token} showToast={showToast}/></main>}

      {/* DIRECTORY */}
      {view==="directory"&&<main style={{maxWidth:960,margin:"0 auto",padding:"24px 16px 80px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
          <div><h2 style={{fontSize:24,fontWeight:800,marginBottom:4,letterSpacing:"-0.02em"}}>Inspector Directory</h2><p style={{color:C.dim,fontSize:14}}>Find verified, rated inspectors in your area.</p></div>
          <button style={bGold}>Register as Inspector — $50/yr →</button>
        </div>
        <div style={{textAlign:"center",padding:"60px 0",border:`1px dashed ${C.border}`,borderRadius:12}}>
          <div style={{fontSize:48,marginBottom:14}}>🔍</div>
          <p style={{color:C.dim,marginBottom:6}}>No verified inspectors listed yet.</p>
          <p style={{color:"#444",fontSize:13}}>Be the first to register.</p>
          <button style={{...bGold,marginTop:18}}>Register Now →</button>
        </div>
      </main>}

      <Disclaimer/>
    </div>
  );
}

// ── REPORT VIEW ──────────────────────────────────────────────
function ReportView({report,onSendEmails,emailSending,emailSent,onBack}) {
  const a=report.analysis;
  const [tab,setTab]=useState("overview");
  const [pdfExp,setPdfExp]=useState(false);

  const exportPDF=async()=>{
    setPdfExp(true);
    try{
      // Validate data before attempting PDF
      if(!a || typeof a !== "object") throw new Error("No analysis data available for PDF export.");
      if(!a.summary && !a.trustScore) throw new Error("Analysis incomplete — please re-analyze the report first.");

      await new Promise((res,rej)=>{if(window.jspdf){res();return;}const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";s.onload=res;s.onerror=rej;document.head.appendChild(s);});
      const{jsPDF}=window.jspdf;
      const doc=new jsPDF({orientation:"portrait",unit:"mm",format:"letter"});
      const W=215.9,m=18,cW=W-m*2;let y=0;
      const h2r=h=>{const x=h.replace("#","");return[parseInt(x.slice(0,2),16),parseInt(x.slice(2,4),16),parseInt(x.slice(4,6),16)];};
      const sc=(hex,t="text")=>{const[r,g,b]=h2r(hex);t==="fill"?doc.setFillColor(r,g,b):t==="draw"?doc.setDrawColor(r,g,b):doc.setTextColor(r,g,b);};
      const ap=()=>{doc.addPage();y=m;};
      const cy=(n=12)=>{if(y+n>265)ap();};
      sc("#0e0e0e","fill");doc.rect(0,0,W,279.4,"F");
      sc("#C8A84B","fill");doc.rect(0,0,W,2,"F");
      y=50;doc.setFontSize(9);doc.setFont("helvetica","normal");sc("#C8A84B");
      doc.text("INSPECTORTRUST · INSPECTOR PERFORMANCE REVIEW",W/2,y,{align:"center"});
      y=68;doc.setFontSize(22);doc.setFont("helvetica","bold");sc("#f0f0f0");
      const inspName=(report.inspectorName||"Unknown Inspector").toUpperCase();
      const nL=doc.splitTextToSize(inspName,cW);doc.text(nL,W/2,y,{align:"center"});y+=nL.length*10;
      doc.setFontSize(11);sc("#C8A84B");doc.text(String(report.companyName||"Independent"),W/2,y+4,{align:"center"});
      const cx=W/2,cy2=152,sc2=(a.trustScore||0)>=80?"#2ecc71":(a.trustScore||0)>=55?"#C8A84B":"#e74c3c";
      sc("#1a1a1a","fill");sc(sc2,"draw");doc.setLineWidth(1.5);doc.circle(cx,cy2,22,"FD");
      doc.setFontSize(22);doc.setFont("helvetica","bold");sc(sc2);doc.text(String(a.trustScore||0),cx,cy2+3,{align:"center"});
      doc.setFontSize(7);sc("#888");doc.text("TRUST SCORE",cx,cy2+10,{align:"center"});
      sc("#111","fill");sc("#2a2a2a","draw");doc.setLineWidth(0.3);doc.roundedRect(m,185,cW,30,3,3,"FD");
      doc.setFontSize(8);sc("#888");
      doc.text("PROPERTY",m+6,196);doc.text("LICENSE",m+6,204);doc.text("DATE",m+6,212);
      sc("#ccc");doc.text(String(report.propertyAddress||"N/A"),m+42,196);doc.text(String(report.licenseNo||"N/A"),m+42,204);doc.text(String(report.date||new Date().toLocaleDateString()),m+42,212);
      doc.setFontSize(6);doc.setFont("helvetica","italic");sc("#333");
      doc.text(doc.splitTextToSize("DISCLAIMER: AI-generated analysis. Not a legal determination or official licensing board finding.",cW),W/2,252,{align:"center"});
      sc("#C8A84B","fill");doc.rect(0,277,W,2,"F");
      ap();
      const sh=title=>{cy(14);sc("#C8A84B","fill");doc.rect(m,y-4,3,10,"F");doc.setFontSize(8);doc.setFont("helvetica","bold");sc("#C8A84B");doc.text(title,m+6,y+3);y+=12;sc("#1e1e1e","draw");doc.setLineWidth(0.2);doc.line(m,y-2,W-m,y-2);y+=4;};
      doc.setFontSize(7);sc("#444");doc.text("INSPECTORTRUST",m,y);doc.text(String(`${report.inspectorName||"Inspector"} · ${report.date||""}`),W-m,y,{align:"right"});
      sc("#C8A84B","fill");doc.rect(m,y+2,cW,0.4,"F");y+=10;
      sh("AI SUMMARY");doc.setFontSize(10);doc.setFont("helvetica","italic");sc("#aaa");
      const sL=doc.splitTextToSize(String(a.summary||"No summary available."),cW);doc.text(sL,m,y);y+=sL.length*5.5+8;
      if(a.dealBreakers?.length){sh("DEAL BREAKERS / MAJOR CONCERNS");a.dealBreakers.forEach(f=>{cy(10);sc("#e74c3c","fill");doc.rect(m,y-3,2.5,2.5,"F");doc.setFontSize(9);doc.setFont("helvetica","normal");sc("#ddd");const ls=doc.splitTextToSize(String(`${f.item||""}${f.recommendation?" — "+f.recommendation:""}`),cW-8);doc.text(ls,m+6,y);y+=ls.length*5+3;});y+=4;}
      if(a.notableIssues?.length){sh("NOTABLE ISSUES");a.notableIssues.forEach(f=>{cy(10);sc("#C8A84B","fill");doc.rect(m,y-3,2.5,2.5,"F");doc.setFontSize(9);doc.setFont("helvetica","normal");sc("#bbb");const ls=doc.splitTextToSize(String(f.item||""),cW-8);doc.text(ls,m+6,y);y+=ls.length*5+3;});}
      if(a.minorObservations?.length){sh("MINOR OBSERVATIONS");a.minorObservations.filter(f=>f.isCosmeticOverreach).forEach(f=>{cy(10);sc("#e74c3c","fill");doc.rect(m,y-3,2.5,2.5,"F");doc.setFontSize(9);doc.setFont("helvetica","normal");sc("#888");const ls=doc.splitTextToSize(String((f.item||"")+" [OVERREACH]"),cW-8);doc.text(ls,m+6,y);y+=ls.length*5+3;});}
      doc.save(`InspectorTrust_${(report.inspectorName||"Report").replace(/\s+/g,"_")}.pdf`);
    }catch(e){alert("PDF failed: "+e.message);}
    finally{setPdfExp(false);}
  };

  const gradeColor=g=>g==="A"?C.green:g==="B"?C.gold:g==="C"?"#e67e22":C.red;

  return (
    <main style={{maxWidth:960,margin:"0 auto",padding:"20px 16px 80px"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:C.dim,cursor:"pointer",fontSize:14,marginBottom:18,fontFamily:"inherit"}}>← Back to Registry</button>
      <div style={{...card,marginBottom:12}}>
        <div style={{display:"flex",flexWrap:"wrap",justifyContent:"space-between",alignItems:"flex-start",gap:14}}>
          <div style={{flex:1,minWidth:0}}>
            <h1 style={{fontSize:"clamp(18px,4vw,24px)",fontWeight:800,color:"#fff",letterSpacing:"-0.02em",marginBottom:4}}>{report.inspectorName}</h1>
            <p style={{color:C.gold,fontSize:14}}>{report.companyName||"Independent"} · License {report.licenseNo||"N/A"}</p>
            <p style={{color:C.dim,fontSize:12,marginTop:3}}>📍 {report.propertyAddress} · {report.date}</p>
            {report.savedToDb&&<p style={{color:C.green,fontSize:10,fontFamily:"monospace",marginTop:5}}>✓ Saved permanently · 10-year retention</p>}
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
            <ScoreBadge score={a.trustScore}/>
            <span style={{fontSize:24,fontFamily:"monospace",fontWeight:800,color:gradeColor(a.inspectorGrade)}}>{a.inspectorGrade}</span>
            <button onClick={exportPDF} disabled={pdfExp} style={bGhost}>{pdfExp?<><Spinner/> Exporting...</>:"↓ PDF"}</button>
          </div>
        </div>
        <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}><BalanceBar score={a.balanceScore||50}/></div>
      </div>

      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,marginBottom:18,overflowX:"auto"}}>
        {["overview","findings","scores","emails","flags"].map(t=><button key={t} onClick={()=>setTab(t)} style={tabB(tab===t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>)}
      </div>

      {tab==="overview"&&<div style={{display:"flex",flexDirection:"column",gap:14,animation:"fadeIn 0.2s ease"}}>
        <div style={card}><div style={cTitle}>AI Summary</div><p style={{fontSize:14,color:"#aaa",lineHeight:1.75}}>{a.summary}</p></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
          <div style={card}><div style={{color:C.green,fontSize:11,fontFamily:"monospace",letterSpacing:"0.1em",marginBottom:10}}>✓ STRENGTHS</div>{(a.strengths||[]).map((s,i)=><div key={i} style={{display:"flex",gap:8,fontSize:13,color:"#aaa",marginBottom:7}}><span style={{color:C.green,flexShrink:0}}>+</span>{s}</div>)}</div>
          <div style={card}><div style={{color:C.red,fontSize:11,fontFamily:"monospace",letterSpacing:"0.1em",marginBottom:10}}>⚠ CONCERNS</div>{(a.concerns||[]).map((s,i)=><div key={i} style={{display:"flex",gap:8,fontSize:13,color:"#aaa",marginBottom:7}}><span style={{color:C.red,flexShrink:0}}>!</span>{s}</div>)}</div>
        </div>
        {a.biasIndicators?.length>0&&<div style={{...card,borderColor:"rgba(231,76,60,0.2)"}}><div style={{color:C.red,fontSize:11,fontFamily:"monospace",letterSpacing:"0.1em",marginBottom:10}}>⚑ BIAS INDICATORS</div>{a.biasIndicators.map((b,i)=><div key={i} style={{fontSize:13,color:C.red,marginBottom:7,opacity:0.9}}>{b}</div>)}</div>}
        <div style={{background:"rgba(200,168,75,0.05)",border:"1px solid rgba(200,168,75,0.2)",borderRadius:10,padding:"14px 18px"}}><span style={{color:C.gold,fontWeight:700,marginRight:8}}>Recommendation:</span><span style={{fontSize:14,color:"#bbb"}}>{a.recommendation}</span></div>
      </div>}

      {tab==="findings"&&<div style={{display:"flex",flexDirection:"column",gap:18,animation:"fadeIn 0.2s ease"}}>
        {a.dealBreakers?.length>0&&<div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:C.red,display:"inline-block"}}/>
            <h3 style={{fontSize:12,fontWeight:700,color:C.red,letterSpacing:"0.1em",textTransform:"uppercase"}}>Deal Breakers / Major Concerns</h3>
            <span style={{fontSize:10,color:"#444"}}>— Expected findings, not bias</span>
          </div>
          {a.dealBreakers.map((f,i)=><div key={i} style={{borderLeft:`2px solid ${C.red}`,background:"rgba(231,76,60,0.04)",borderRadius:"0 8px 8px 0",padding:"10px 14px",marginBottom:8}}><p style={{fontSize:14,fontWeight:600,color:"#fff",marginBottom:3}}>{f.item}</p>{f.recommendation&&<p style={{fontSize:12,color:C.muted}}>→ {f.recommendation}</p>}<span style={{...tag(C.red),fontSize:10,marginTop:5,display:"inline-block"}}>{f.severity}</span></div>)}
        </div>}
        {a.notableIssues?.length>0&&<div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:C.gold,display:"inline-block"}}/>
            <h3 style={{fontSize:12,fontWeight:700,color:C.gold,letterSpacing:"0.1em",textTransform:"uppercase"}}>Notable Issues</h3>
          </div>
          {a.notableIssues.map((f,i)=><div key={i} style={{borderLeft:`2px solid ${C.gold}`,background:"rgba(200,168,75,0.04)",borderRadius:"0 8px 8px 0",padding:"10px 14px",marginBottom:8}}><p style={{fontSize:14,color:"#fff",marginBottom:f.recommendation?3:0}}>{f.item}</p>{f.recommendation&&<p style={{fontSize:12,color:C.muted}}>→ {f.recommendation}</p>}</div>)}
        </div>}
        {a.minorObservations?.length>0&&<div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:"#333",display:"inline-block"}}/>
            <h3 style={{fontSize:12,fontWeight:700,color:C.dim,letterSpacing:"0.1em",textTransform:"uppercase"}}>Minor Observations</h3>
            <span style={{fontSize:10,color:"#444"}}>— Watch for overreach</span>
          </div>
          {a.minorObservations.map((f,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,borderLeft:`2px solid ${f.isCosmeticOverreach?"#e74c3c":"#2a2a2a"}`,background:"#0d0d0d",borderRadius:"0 8px 8px 0",padding:"8px 12px",marginBottom:6}}><p style={{fontSize:13,color:"#777"}}>{f.item}</p>{f.isCosmeticOverreach&&<span style={{...tag(C.red),fontSize:10,flexShrink:0}}>Overreach ⚑</span>}</div>)}
        </div>}
        {!a.dealBreakers?.length&&!a.notableIssues?.length&&!a.minorObservations?.length&&<div style={{...card,textAlign:"center",color:C.dim,fontSize:14}}>No structured findings available.</div>}
      </div>}

      {tab==="scores"&&<div style={{display:"flex",flexDirection:"column",gap:14,animation:"fadeIn 0.2s ease"}}>
        <div style={card}>
          <div style={cTitle}>Performance Scorecard</div>
          {[{label:"Trust Score",val:a.trustScore,color:C.gold},{label:"Completeness",val:a.completenessScore,color:C.blue},{label:"Technical Rigor",val:a.technicalScore,color:C.purple},{label:"Objectivity",val:a.objectivityScore,color:C.green}].map(s=>(
            <div key={s.label} style={{marginBottom:18}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:13,color:"#ccc"}}>{s.label}</span><span style={{fontSize:13,fontWeight:700,fontFamily:"monospace",color:s.color}}>{s.val}/100</span></div>
              <div style={{height:6,background:"#1e1e1e",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${s.val}%`,background:s.color,borderRadius:99}}/></div>
            </div>
          ))}
        </div>
        <div style={card}><div style={cTitle}>Fraud Risk</div><div style={{...tag(a.fraudRisk==="High"?C.red:a.fraudRisk==="Moderate"?C.gold:C.green),fontSize:16,padding:"10px 20px",display:"inline-block"}}>{a.fraudRisk?.toUpperCase()} RISK</div></div>
      </div>}

      {tab==="emails"&&<div style={{display:"flex",flexDirection:"column",gap:14,animation:"fadeIn 0.2s ease"}}>
        <p style={{color:C.dim,fontSize:13}}>AI-drafted emails. Each clearly separates deal breakers from cosmetic observations.</p>
        {[{role:"Buyer",key:"emailBuyer",addr:report.buyerEmail,icon:"🏠"},{role:"Seller",key:"emailSeller",addr:report.sellerEmail,icon:"💼"},{role:"Realtor",key:"emailRealtor",addr:report.realtorEmail,icon:"📋"}].map(e=>(
          <div key={e.key} style={card}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><span style={{fontSize:18}}>{e.icon}</span><div><div style={{fontSize:14,fontWeight:700,color:"#fff"}}>To: {e.role}</div><div style={{fontSize:12,color:C.dim}}>{e.addr||"No email provided"}</div></div></div>
            <div style={{borderTop:`1px solid #1a1a1a`,paddingTop:10,fontSize:12,color:"#777",fontFamily:"monospace",lineHeight:1.75,whiteSpace:"pre-wrap"}}>{a[e.key]}</div>
          </div>
        ))}
        <button style={{...bGold,width:"100%",justifyContent:"center",opacity:emailSent||emailSending?0.5:1,cursor:emailSent||emailSending?"default":"pointer"}} onClick={()=>!emailSent&&!emailSending&&onSendEmails()} disabled={emailSending||emailSent}>
          {emailSent?"✓ Emails Dispatched":emailSending?<><Spinner/> Sending...</>:"Dispatch All Emails →"}
        </button>
      </div>}

      {tab==="flags"&&<div style={{animation:"fadeIn 0.2s ease"}}><div style={card}><div style={cTitle}>Red Flag Analysis</div>
        {!a.redFlags?.length?<div style={{display:"flex",alignItems:"center",gap:10}}><span style={{color:C.green,fontSize:20}}>✓</span><p style={{color:C.green,fontSize:14}}>No red flags detected.</p></div>
          :a.redFlags.map((flag,i)=><div key={i} style={{display:"flex",gap:12,alignItems:"flex-start",background:"rgba(231,76,60,0.04)",border:"1px solid rgba(231,76,60,0.15)",borderRadius:8,padding:"10px 14px",marginBottom:8}}><span style={{color:C.red}}>⚑</span><span style={{fontSize:14,color:"#ddd"}}>{flag}</span></div>)}
      </div></div>}
    </main>
  );
}
