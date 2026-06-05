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

function AuthModal({onClose,onAuth,initialMode,initialRole}) {
  const RETURNING_KEY="it_returning", EMAIL_KEY="it_last_email";
  // First-time visitors land on Create Account; returning visitors on Sign In.
  const [tab,setTab]=useState(()=>{if(initialMode)return initialMode;try{return localStorage.getItem(RETURNING_KEY)?"signin":"signup";}catch{return "signin";}});
  const [form,setForm]=useState({email:"",password:"",name:"",role:initialRole||"buyer",licenseNumber:"",interval:""});
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [remember,setRemember]=useState(false);
  const [agreed,setAgreed]=useState(false);
  const [resetSent,setResetSent]=useState(false);
  const sf=k=>v=>setForm(f=>({...f,[k]:v}));

  // Prefill the last-used email if the person asked us to remember it.
  useEffect(()=>{
    try{const e=localStorage.getItem(EMAIL_KEY);if(e){setForm(f=>({...f,email:e}));setRemember(true);}}catch{}
  },[]);

  // Persist "returning" flag + remembered email (never the password).
  const persistPrefs=()=>{
    try{
      localStorage.setItem(RETURNING_KEY,"1");
      if(remember&&form.email)localStorage.setItem(EMAIL_KEY,form.email);
      else localStorage.removeItem(EMAIL_KEY);
    }catch{}
  };

  const submit=async()=>{
    setError("");setLoading(true);
    try {
      // Forgot password — email a reset link
      if(tab==="reset"){
        if(!form.email){setError("Enter your email address.");setLoading(false);return;}
        await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"request_password_reset",email:form.email})});
        setResetSent(true);setLoading(false);return;
      }
      // Sign in — direct auth
      if(tab==="signin"){
        const res=await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"signin",email:form.email,password:form.password})});
        const data=await res.json();
        if(!res.ok){setError(data.error||"Invalid email or password.");setLoading(false);return;}
        persistPrefs();
        saveSession({token:data.session?.access_token,profile:data.profile});
        onAuth(data.profile,data.session?.access_token);onClose();
        return;
      }
      // Sign up — route through Stripe subscription checkout first
      if(!form.email||!form.password){setError("Email and password are required.");setLoading(false);return;}
      if((form.role==="realtor"||form.role==="inspector")&&!form.licenseNumber){setError("Realtors and inspectors must provide a license number.");setLoading(false);return;}
      if((form.role==="realtor"||form.role==="inspector")&&!form.interval){setError("Choose a billing plan — monthly or yearly.");setLoading(false);return;}
      if(!agreed){setError("Please read and agree to the Terms & Conditions to continue.");setLoading(false);return;}
      const res=await fetch("/api/billing",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          action:"signup_checkout",
          role:form.role,
          email:form.email,
          name:form.name,
          licenseNumber:form.licenseNumber,
          interval:(form.role==="realtor"||form.role==="inspector")?form.interval:"yearly",
        }),
      });
      const data=await res.json();
      if(!res.ok||!data.url){setError(data.error||"Could not start checkout.");setLoading(false);return;}
      persistPrefs();
      // Store password temporarily in sessionStorage for after payment
      sessionStorage.setItem("it_pending_signup",JSON.stringify({email:form.email,password:form.password,name:form.name,role:form.role,licenseNumber:form.licenseNumber}));
      window.location.href=data.url;
    } catch(e){setError("Network error: "+e.message);}
    finally{setLoading(false);}
  };

  const toggleMode=()=>{setTab(tab==="signin"?"signup":"signin");setError("");};

  return (
    <div style={{...mOv,alignItems:"center",padding:16}} onClick={onClose}>
      <div style={{...mBox,borderRadius:16,maxWidth:420,animation:"fadeIn 0.2s ease"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <h2 style={{fontSize:19,fontWeight:800,color:"#fff",letterSpacing:"-0.01em"}}>{tab==="signin"?"Welcome back":tab==="reset"?"Reset password":"Create your account"}</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.dim,fontSize:20,cursor:"pointer"}}>✕</button>
        </div>
        {error&&<div style={{padding:"10px 14px",borderRadius:8,fontSize:13,marginBottom:14,background:error.includes("created")?"rgba(46,204,113,0.1)":"rgba(231,76,60,0.1)",color:error.includes("created")?C.green:C.red,border:`1px solid ${error.includes("created")?C.green:C.red}`}}>{error}</div>}
        {tab==="signup"&&<div style={{marginBottom:12}}><label style={lbl}>Full Name</label><input style={inp} name="name" autoComplete="name" placeholder="Jane Smith" value={form.name} onChange={e=>sf("name")(e.target.value)}/></div>}
        <div style={{marginBottom:12}}><label style={lbl}>Email</label><input style={inp} type="email" name="email" autoComplete="email" placeholder="you@email.com" value={form.email} onChange={e=>sf("email")(e.target.value)}/></div>
        {tab==="reset"&&!resetSent&&<p style={{color:C.dim,fontSize:13,lineHeight:1.6,marginBottom:14}}>Enter your account email and we'll send you a link to reset your password.</p>}
        {tab==="reset"&&resetSent&&<div style={{padding:"12px 14px",borderRadius:8,fontSize:13,marginBottom:14,background:"rgba(46,204,113,0.1)",color:C.green,border:`1px solid ${C.green}`}}>If an account exists for that email, a password reset link is on its way. Check your inbox (and spam folder).</div>}
        {tab!=="reset"&&<div style={{marginBottom:12}}><label style={lbl}>Password</label><input style={inp} type="password" name="password" autoComplete={tab==="signin"?"current-password":"new-password"} placeholder="••••••••" value={form.password} onChange={e=>sf("password")(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&tab==="signin")submit();}}/></div>}
        {tab==="signin"&&<div style={{textAlign:"right",marginBottom:12,marginTop:-4}}><button onClick={()=>{setTab("reset");setError("");setResetSent(false);}} style={{background:"none",border:"none",color:C.gold,cursor:"pointer",fontSize:12,fontFamily:"inherit",padding:0,textDecoration:"underline"}}>Forgot password?</button></div>}
        {tab!=="reset"&&<label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:C.dim,marginBottom:14,cursor:"pointer"}}>
          <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} style={{accentColor:C.gold,width:15,height:15,cursor:"pointer"}}/>
          Remember my email on this device
        </label>}
        {tab==="signup"&&<>
          <div style={{marginBottom:12}}>
            <label style={lbl}>I am a...</label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:6}}>
              {["buyer","seller","realtor","inspector"].map(r=><button key={r} onClick={()=>sf("role")(r)} style={{padding:"10px",borderRadius:8,border:`1.5px solid ${form.role===r?C.gold:"#222"}`,background:form.role===r?"rgba(200,168,75,0.1)":"#0a0a0a",color:form.role===r?C.gold:C.dim,cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit",textTransform:"capitalize"}}>{r}</button>)}
            </div>
          </div>
          {(form.role==="realtor"||form.role==="inspector")&&<div style={{marginBottom:12}}><label style={lbl}>{form.role==="realtor"?"Realtor":"Inspector"} License # *</label><input style={inp} placeholder="TX-12345678" value={form.licenseNumber} onChange={e=>sf("licenseNumber")(e.target.value)}/></div>}
          {(form.role==="realtor"||form.role==="inspector")&&<div style={{marginBottom:12}}>
            <label style={lbl}>Billing plan *</label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:6}}>
              {[["monthly","$5 / month"],["yearly","$50 / year"]].map(([k,txt])=><button key={k} onClick={()=>sf("interval")(k)} style={{padding:"10px",borderRadius:8,border:`1.5px solid ${form.interval===k?C.gold:"#222"}`,background:form.interval===k?"rgba(200,168,75,0.1)":"#0a0a0a",color:form.interval===k?C.gold:C.dim,cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>{txt}</button>)}
            </div>
          </div>}
          {(form.role==="buyer"||form.role==="seller")&&<div style={{background:"rgba(46,204,113,0.05)",border:"1px solid rgba(46,204,113,0.15)",borderRadius:8,padding:"10px 14px",marginBottom:12}}><p style={{color:C.green,fontSize:12}}>$5 / year — browse all reports & inspector Balance Scores</p></div>}
        </>}
        {tab==="signup"&&<label style={{display:"flex",alignItems:"flex-start",gap:8,fontSize:12,color:C.dim,marginBottom:12,marginTop:4,cursor:"pointer",lineHeight:1.5}}>
          <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} style={{accentColor:C.gold,width:15,height:15,cursor:"pointer",marginTop:1,flexShrink:0}}/>
          <span>I have read and agree to the <a href="?view=terms" target="_blank" rel="noopener noreferrer" style={{color:C.gold,textDecoration:"underline"}}>Terms &amp; Conditions</a>, including the AI-generated-content disclaimer and limitation of liability.</span>
        </label>}
        {!(tab==="reset"&&resetSent)&&<button onClick={submit} disabled={loading} style={{...bGold,width:"100%",marginTop:4,opacity:loading?0.7:1}}>{loading?<><Spinner/> Please wait...</>:tab==="signin"?"Sign In →":tab==="reset"?"Send reset link →":"Create Account →"}</button>}
        <p style={{textAlign:"center",fontSize:13,color:C.dim,marginTop:16}}>
          {tab==="reset"?<button onClick={()=>{setTab("signin");setError("");setResetSent(false);}} style={{background:"none",border:"none",color:C.gold,cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit",padding:0,textDecoration:"underline"}}>← Back to sign in</button>:<>{tab==="signin"?"New to InspectorTrust? ":"Already have an account? "}<button onClick={toggleMode} style={{background:"none",border:"none",color:C.gold,cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit",padding:0,textDecoration:"underline"}}>{tab==="signin"?"Create an account":"Sign in"}</button></>}
        </p>
      </div>
    </div>
  );
}

function AccountPage({profile,token,showToast,onStatusChange}) {
  const [loading,setLoading]=useState(false);
  const trialStart=profile?.trial_started_at?new Date(profile.trial_started_at):null;
  const daysLeft=trialStart?Math.max(0,14-Math.floor((Date.now()-trialStart)/86400000)):null;
  const isPaidUploader=profile?.role==="realtor"||profile?.role==="inspector";
  const [planInterval,setPlanInterval]=useState("yearly");
  const status=profile?.subscription_status;
  const statusColor=status==="active"?C.green:status==="trial"?C.gold:status==="canceling"?C.gold:C.red;
  const statusLabel=status==="active"?"Active":status==="trial"?`Trial — ${daysLeft} days left`:status==="canceling"?"Canceling at period end":"Inactive";
  const startCheckout=async()=>{
    setLoading(true);
    try {
      const res=await fetch("/api/billing",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({action:"checkout",interval:planInterval})});
      const data=await res.json();
      if(data.url)window.location.href=data.url;
      else showToast(data.error||"Could not start checkout","error");
    } catch{showToast("Network error","error");}
    finally{setLoading(false);}
  };
  const cancelSub=async()=>{
    if(!window.confirm("Cancel your subscription? You'll keep access until the end of your current billing period, and you won't be charged again."))return;
    setLoading(true);
    try {
      const res=await fetch("/api/billing",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({action:"cancel"})});
      const data=await res.json();
      if(!res.ok){showToast(data.error||"Could not cancel.","error");}
      else if(!data.cancelled){showToast(data.message||"No active subscription found to cancel.","error");}
      else{showToast(data.message||"Subscription canceled.");onStatusChange&&onStatusChange("canceling");}
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
        <div style={card}>
          <div style={cTitle}>Subscription</div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
            <span style={{width:10,height:10,borderRadius:"50%",background:statusColor,display:"inline-block"}}/>
            <span style={{color:statusColor,fontWeight:700}}>{statusLabel}</span>
          </div>
          {status==="active"&&<>
            <p style={{color:C.dim,fontSize:13,marginBottom:12,lineHeight:1.6}}>Cancel anytime. You'll keep access until the end of your current billing period and won't be charged again.</p>
            <button onClick={cancelSub} disabled={loading} style={{...bOut,width:"100%",justifyContent:"center",color:C.red,borderColor:`${C.red}66`,opacity:loading?0.7:1}}>{loading?<><Spinner/> Working...</>:"Cancel subscription"}</button>
          </>}
          {status==="canceling"&&<p style={{color:C.dim,fontSize:13,lineHeight:1.6}}>Your subscription is set to cancel at the end of the current billing period. You'll keep access until then, and you won't be charged again.</p>}
          {status!=="active"&&status!=="canceling"&&<>
            {isPaidUploader&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              {[["monthly","$5 / month"],["yearly","$50 / year"]].map(([k,txt])=><button key={k} onClick={()=>setPlanInterval(k)} style={{padding:"10px",borderRadius:8,border:`1.5px solid ${planInterval===k?C.gold:"#222"}`,background:planInterval===k?"rgba(200,168,75,0.1)":"#0a0a0a",color:planInterval===k?C.gold:C.dim,cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>{txt}</button>)}
            </div>}
            <button onClick={startCheckout} disabled={loading} style={{...bGold,width:"100%",justifyContent:"center",opacity:loading?0.7:1}}>{loading?<><Spinner/> Loading...</>:"Subscribe →"}</button>
          </>}
        </div>
      </div>
    </div>
  );
}

// ── REPORTS DASHBOARD ────────────────────────────────────────
// ── LOCKED TEASER (blurred fake preview for logged-out visitors) ──
// All data here is fake placeholder content — no real report data is ever
// rendered for logged-out users, so the blur can't be defeated to leak anything.
function LockedTeaser({onUnlock,title,subtitle}) {
  const riskColor=r=>r==="High"?C.red:r==="Moderate"?C.gold:C.green;
  const gradeColor=g=>g==="A"?C.green:g==="B"?C.gold:g==="C"?"#e67e22":C.red;
  const fake=[
    {name:"Marcus Reilly",company:"Summit Home Inspections",lic:"TREC #21847",addr:"1429 Oak Hollow Dr, Austin, TX",date:"Apr 12, 2026",trust:91,balance:50,grade:"A",risk:"Low",summary:"Thorough inspection covering all major systems. Issues flagged proportionately with no exaggeration."},
    {name:"Danielle Pham",company:"Lone Star Property Inspect",lic:"TREC #19302",addr:"88 Cypress Bend, Round Rock, TX",date:"Apr 9, 2026",trust:64,balance:27,grade:"C",risk:"Moderate",summary:"Heavy emphasis on cosmetic items; several minor observations framed as urgent concerns."},
    {name:"Greg Halvorsen",company:"Independent",lic:"HI-44120",addr:"305 Meadowlark Ln, Cedar Park, TX",date:"Apr 3, 2026",trust:37,balance:84,grade:"F",risk:"High",summary:"Sparse documentation. Major systems barely addressed; reads closer to a rubber-stamp than a real inspection."},
    {name:"Aisha Bello",company:"Capital Inspect Group",lic:"TREC #25588",addr:"7720 Riata Trace, Austin, TX",date:"Mar 28, 2026",trust:83,balance:57,grade:"B",risk:"Low",summary:"Strong, professional report with a slight lean toward buyer concerns on a few line items."},
  ];
  return (
    <div style={{position:"relative"}}>
      <div aria-hidden="true" style={{filter:"blur(6px)",pointerEvents:"none",userSelect:"none",opacity:0.7,display:"flex",flexDirection:"column",gap:10}}>
        {fake.map((r,i)=>(
          <div key={i} style={card}>
            <div style={{display:"flex",flexWrap:"wrap",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                  <span style={{fontWeight:700,fontSize:15,color:"#fff"}}>{r.name}</span>
                  <span style={{...tag(C.blue),fontSize:10}}>2026</span>
                </div>
                <div style={{color:C.dim,fontSize:12,marginBottom:3}}>{r.company} · {r.lic}</div>
                <div style={{color:C.dim,fontSize:12}}>📍 {r.addr} · {r.date}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <ScoreBadge score={r.trust}/>
                <span style={tag(riskColor(r.risk))}>{r.risk} Risk</span>
                <span style={{fontSize:16,fontFamily:"monospace",fontWeight:800,color:gradeColor(r.grade)}}>{r.grade}</span>
              </div>
            </div>
            <div style={{marginTop:10}}><BalanceBar score={r.balance}/></div>
            <p style={{color:"#666",fontSize:12,marginTop:10,lineHeight:1.6}}>{r.summary}</p>
          </div>
        ))}
      </div>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
        <div style={{...card,maxWidth:400,textAlign:"center",background:"rgba(17,17,17,0.94)"}}>
          <div style={{fontSize:34,marginBottom:10}}>🔒</div>
          <h3 style={{fontSize:18,fontWeight:800,color:"#fff",marginBottom:8}}>{title}</h3>
          <p style={{color:C.dim,fontSize:13,lineHeight:1.6,marginBottom:18}}>{subtitle}</p>
          <button style={{...bGold,width:"100%",justifyContent:"center"}} onClick={onUnlock}>Sign In / Create Account →</button>
        </div>
      </div>
    </div>
  );
}

function ReportsDashboard({session,showToast}) {
  const [reports,setReports]=useState([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [filterYear,setFilterYear]=useState("");
  const [filterRisk,setFilterRisk]=useState("");
  const [selected,setSelected]=useState(null);
  const [resending,setResending]=useState(null);
  const [tileFilter,setTileFilter]=useState(null);

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

  const displayedReports =
    tileFilter==="high" ? reports.filter(r=>r.fraud_risk==="High")
    : tileFilter==="buyer" ? reports.filter(r=>r.balance_score&&r.balance_score<35)
    : tileFilter==="seller" ? reports.filter(r=>r.balance_score!==undefined&&r.balance_score>65)
    : tileFilter==="analyzing" ? reports.filter(r=>r.status!=="complete")
    : reports;

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
                const email=selected[emailKey]||"";
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
                    <EmailPartyButton
                      reportId={selected.id}
                      partyLabel={p.label}
                      defaultEmail={email}
                      inspectorName={selected.inspector_name}
                      propertyAddress={selected.property_address}
                      session={session}
                      showToast={showToast}
                    />
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

      {/* Stats row — click a tile to filter, click again to clear */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:20}}>
        {[
          {n:reports.length,l:"Total Reports",k:null},
          {n:reports.filter(r=>r.fraud_risk==="High").length,l:"High Risk",c:C.red,k:"high"},
          {n:reports.filter(r=>r.balance_score&&r.balance_score<35).length,l:"Buyer-Biased",c:C.gold,k:"buyer"},
          {n:reports.filter(r=>r.balance_score!==undefined&&r.balance_score>65).length,l:"Seller-Biased",c:C.purple,k:"seller"},
          {n:reports.filter(r=>r.status!=="complete").length,l:"Analyzing",c:C.blue,k:"analyzing"},
        ].map(s=>{
          const active=tileFilter===s.k;
          const ac=s.c||C.gold;
          const toggle=()=>setTileFilter(tf=>tf===s.k?null:s.k);
          return (
            <div key={s.l} role="button" tabIndex={0}
              onClick={toggle}
              onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();toggle();}}}
              title={s.k?`Show only ${s.l}`:"Show all reports"}
              style={{...cardSm,textAlign:"center",cursor:"pointer",userSelect:"none",transition:"border-color .15s, background .15s",border:`1px solid ${active?ac:C.border}`,background:active?`${ac}1f`:cardSm.background}}
            >
              <div style={{fontSize:22,fontWeight:800,color:ac,fontFamily:"monospace",marginBottom:2}}>{s.n}</div>
              <div style={{fontSize:11,color:active?ac:C.dim,fontWeight:active?700:400}}>{s.l}{active&&s.k?" ✓":""}</div>
            </div>
          );
        })}
      </div>

      {tileFilter&&<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,fontSize:12,color:C.dim}}>
        <span>Showing {displayedReports.length} of {reports.length} · filtered by <b style={{color:C.text}}>{tileFilter==="high"?"High Risk":tileFilter==="buyer"?"Buyer-Biased":tileFilter==="seller"?"Seller-Biased":"Analyzing"}</b></span>
        <button onClick={()=>setTileFilter(null)} style={{background:"none",border:`1px solid ${C.border2}`,color:C.muted,fontSize:11,cursor:"pointer",padding:"2px 10px",borderRadius:5,fontFamily:"inherit"}}>Clear ✕</button>
      </div>}

      {/* Reports table */}
      {loading?(
        <div style={{textAlign:"center",padding:"60px 0"}}><Spinner lg/><p style={{color:C.dim,marginTop:16,fontSize:14}}>Loading reports...</p></div>
      ):reports.length===0?(
        <div style={{textAlign:"center",padding:"60px 0",border:`1px dashed ${C.border}`,borderRadius:12}}>
          <div style={{fontSize:48,marginBottom:14}}>📋</div>
          <p style={{color:C.dim}}>No reports found.</p>
        </div>
      ):displayedReports.length===0?(
        <div style={{textAlign:"center",padding:"60px 0",border:`1px dashed ${C.border}`,borderRadius:12}}>
          <div style={{fontSize:48,marginBottom:14}}>🔍</div>
          <p style={{color:C.dim,marginBottom:14}}>No reports match this filter.</p>
          <button onClick={()=>setTileFilter(null)} style={bOut}>Clear filter</button>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {displayedReports.map(r=>{
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
function YearlyRankings({session, reports, onRefresh}) {
  const all = Array.isArray(reports) ? reports : [];
  // Only completed analyses with a real trust score can be ranked.
  const completed = all.filter(r => r.status === "complete" && r.analysis && typeof r.analysis.trustScore === "number");

  // Aggregate a list of reports into per-inspector summaries, sorted best-first.
  const aggregate = (list) => {
    const map = {};
    for (const r of list) {
      const name = (r.inspectorName || "Unknown").trim() || "Unknown";
      const t = r.analysis.trustScore;
      const b = r.analysis.balanceScore;
      if (!map[name]) map[name] = { name, company: r.companyName || "", license: r.licenseNo || "", count: 0, sumT: 0, sumB: 0, bCount: 0, major: 0, minor: 0 };
      const m = map[name];
      m.count++; m.sumT += t;
      if (typeof b === "number") { m.sumB += b; m.bCount++; }
      m.major += ((r.analysis.dealBreakers?.length) || 0) + ((r.analysis.notableIssues?.length) || 0);
      m.minor += (r.analysis.minorObservations?.length) || 0;
      if (!m.company && r.companyName) m.company = r.companyName;
      if (!m.license && r.licenseNo) m.license = r.licenseNo;
    }
    return Object.values(map).map(m => ({
      ...m,
      avgTrust: Math.round(m.sumT / m.count),
      avgBalance: m.bCount ? Math.round(m.sumB / m.bCount) : null,
    })).sort((a, b) => b.avgTrust - a.avgTrust || b.count - a.count);
  };

  const gradeFromTrust = (t) => t >= 88 ? "A" : t >= 72 ? "B" : t >= 50 ? "C" : "F";
  const gradeColor = g => g === "A" ? C.green : g === "B" ? C.gold : g === "C" ? "#e67e22" : C.red;
  const medal = (rank) => rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "";

  const ranked = aggregate(completed);
  const n = ranked.length;

  const now = new Date();
  const thisMonth = completed.filter(r => { const d = r.createdAt ? new Date(r.createdAt) : null; return d && !isNaN(d) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  const motm = aggregate(thisMonth)[0] || null;
  const monthName = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div style={{maxWidth:960,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontSize:24,fontWeight:800,marginBottom:4,letterSpacing:"-0.02em"}}>Inspector Rankings</h2>
          <p style={{color:C.dim,fontSize:14}}>Live leaderboard — updates with every inspection analyzed. Inspectors compete to stay on top.</p>
        </div>
        {onRefresh&&<button onClick={onRefresh} style={bGhost}>↻ Refresh</button>}
      </div>

      {/* Inspector of the Month */}
      <div style={{...card,marginBottom:20,borderColor:`${C.gold}55`,background:"linear-gradient(135deg,rgba(200,168,75,0.10),rgba(200,168,75,0.02))"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <span style={{fontSize:18}}>🏆</span>
          <span style={{fontSize:12,fontWeight:700,letterSpacing:"0.5px",textTransform:"uppercase",color:C.gold}}>Inspector of the Month · {monthName}</span>
        </div>
        {motm?(
          <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:22,fontWeight:800,color:"#fff",marginBottom:2}}>{motm.name}</div>
              <div style={{color:C.dim,fontSize:13}}>{motm.company||"Independent"}{motm.license?` · License ${motm.license}`:""} · {motm.count} inspection{motm.count!==1?"s":""} this month</div>
            </div>
            <div style={{display:"flex",gap:18,alignItems:"center"}}>
              <div style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:800,color:C.gold,fontFamily:"monospace"}}>{motm.avgTrust}</div><div style={{fontSize:10,color:C.dim}}>Avg Trust</div></div>
              <div style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:800,color:gradeColor(gradeFromTrust(motm.avgTrust)),fontFamily:"monospace"}}>{gradeFromTrust(motm.avgTrust)}</div><div style={{fontSize:10,color:C.dim}}>Grade</div></div>
            </div>
          </div>
        ):(
          <p style={{color:C.dim,fontSize:13}}>No inspections analyzed yet this month — be the first to claim the spot.</p>
        )}
      </div>

      {n===0?(
        <div style={{textAlign:"center",padding:"60px 0",border:`1px dashed ${C.border}`,borderRadius:12}}>
          <div style={{fontSize:48,marginBottom:14}}>📊</div>
          <p style={{color:C.dim,marginBottom:6}}>No completed inspections to rank yet.</p>
          <p style={{color:"#444",fontSize:13}}>Rankings build automatically as inspections are analyzed.</p>
        </div>
      ):(
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:20}}>
            {[
              {n:n,l:"Inspectors Ranked"},
              {n:completed.length,l:"Total Inspections"},
              {n:ranked[0]?.name?.split(" ")[0]||"—",l:"Top Inspector",c:C.gold},
              {n:ranked[0]?.avgTrust||"—",l:"Top Score",c:C.green},
            ].map(s=>(
              <div key={s.l} style={{...cardSm,textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:800,color:s.c||C.gold,fontFamily:"monospace",marginBottom:2}}>{s.n}</div>
                <div style={{fontSize:11,color:C.dim}}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {ranked.map((d,i)=>{
              const rank=i+1;
              const percentile=n>1?Math.round(((n-rank)/(n-1))*100):100;
              const grade=gradeFromTrust(d.avgTrust);
              return (
              <div key={d.name} style={{...card,borderColor:rank<=3?`${C.gold}40`:C.border}}>
                <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                  <div style={{fontSize:28,fontFamily:"monospace",fontWeight:800,color:rank<=3?C.gold:C.dim,minWidth:40}}>
                    {medal(rank)||`#${rank}`}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:16,color:"#fff",marginBottom:2}}>{d.name}</div>
                    <div style={{color:C.dim,fontSize:12}}>{d.count} inspection{d.count!==1?"s":""}{d.license?` · License ${d.license}`:""}</div>
                  </div>
                  <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:20,fontWeight:800,color:C.gold,fontFamily:"monospace"}}>{d.avgTrust}</div>
                      <div style={{fontSize:10,color:C.dim}}>Trust Score</div>
                    </div>
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:20,fontWeight:800,color:gradeColor(grade),fontFamily:"monospace"}}>{grade}</div>
                      <div style={{fontSize:10,color:C.dim}}>Grade</div>
                    </div>
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:16,fontWeight:700,color:C.green,fontFamily:"monospace"}}>{percentile}th</div>
                      <div style={{fontSize:10,color:C.dim}}>Percentile</div>
                    </div>
                  </div>
                </div>
                <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:13,color:C.gold,fontFamily:"monospace",fontWeight:700}}>{d.avgBalance??"—"}</div>
                    <div style={{fontSize:10,color:C.dim}}>Balance Score</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:13,color:C.red,fontFamily:"monospace",fontWeight:700}}>{d.major}</div>
                    <div style={{fontSize:10,color:C.dim}}>Major Findings</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:13,color:C.muted,fontFamily:"monospace",fontWeight:700}}>{d.minor}</div>
                    <div style={{fontSize:10,color:C.dim}}>Minor Obs.</div>
                  </div>
                </div>
              </div>
              );
            })}
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
          <span style={{color:"#3a3a3a",fontWeight:700}}>AI-GENERATED ANALYSIS DISCLOSURE:</span>{" "}All inspector scores, Balance Scores, fraud risk ratings, and summaries are generated by artificial intelligence based solely on submitted inspection report content. These assessments represent automated, opinion-based analysis and do not constitute verified facts, legal findings, background check results, or official determinations by any licensing board or regulatory authority. Users should independently verify all information before making real estate or financial decisions. Buyer/seller email addresses are not publicly exposed — they are gated behind login per CAN-SPAM and privacy guidelines. © {new Date().getFullYear()} InspectorTrust. <a href="?view=terms" style={{color:"#5a5a5a",textDecoration:"underline"}}>Terms &amp; Conditions</a>
        </p>
      </div>
    </div>
  );
}

// ── TERMS & CONDITIONS PAGE ──────────────────────────────────
function TermsPage() {
  const sections=[
    ["1. Acceptance of Terms","By accessing or using InspectorTrust (the \"Service\"), creating an account, or submitting any content, you agree to these Terms & Conditions and the disclaimers below. If you do not agree, do not use the Service."],
    ["2. Nature of the Service; AI-Generated Opinions","InspectorTrust uses automated artificial-intelligence systems to analyze inspection-report content submitted by users and to generate scores, Balance Scores, letter grades, fraud-risk ratings, rankings, and written summaries. All such outputs are automated, algorithmically generated opinions and commentary. They are NOT statements of fact, professional judgments, legal conclusions, accusations of wrongdoing, or determinations by any licensing board, government authority, or the operator of the Service. The operator does not personally review, author, endorse, or vouch for any individual rating and makes no human determination about any inspector or report."],
    ["3. No Professional Advice","The Service does not provide legal, financial, real-estate, engineering, or professional home-inspection advice. All outputs are informational only. You must independently verify all information and consult qualified professionals before making any decision. Any reliance on the Service or its outputs is at your sole risk."],
    ["4. Disclaimer of Warranties","THE SERVICE AND ALL CONTENT ARE PROVIDED \"AS IS\" AND \"AS AVAILABLE,\" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, RELIABILITY, AND NON-INFRINGEMENT. THE OPERATOR DOES NOT WARRANT THAT OUTPUTS ARE CORRECT OR COMPLETE OR THAT THE SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE."],
    ["5. Limitation of Liability","TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE OPERATOR AND ITS OWNERS, MEMBERS, OFFICERS, EMPLOYEES, CONTRACTORS, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, DATA, GOODWILL, OR REPUTATION, ARISING OUT OF OR RELATED TO THE SERVICE OR ANY AI-GENERATED OUTPUT, WHETHER BASED IN CONTRACT, TORT (INCLUDING NEGLIGENCE), DEFAMATION, OR ANY OTHER THEORY, EVEN IF ADVISED OF THE POSSIBILITY. THE OPERATOR'S TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS SHALL NOT EXCEED THE GREATER OF (A) THE TOTAL FEES YOU PAID IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS ($100)."],
    ["6. Assumption of Risk and Release","You acknowledge that AI outputs may be inaccurate, incomplete, or disputed, and you assume all risk arising from your use of and reliance on them. To the fullest extent permitted by law, you release and discharge the operator and its owners and affiliates from any and all claims, demands, and damages arising out of or connected with the Service or its outputs."],
    ["7. Indemnification","You agree to defend, indemnify, and hold harmless the operator and its owners, members, officers, employees, and affiliates from and against any claims, liabilities, damages, losses, and expenses (including reasonable attorneys' fees) arising from your use of the Service, any content you submit, your violation of these Terms, or your violation of any law or third-party right."],
    ["8. User-Submitted Content","You are solely responsible for any inspection reports, addresses, names, emails, or other content you submit, and you represent and warrant that you have the right to submit it and that it is accurate. The operator does not verify the truth of submitted content and is not responsible for it. AI outputs are derived solely from content submitted by users."],
    ["9. Ratings, Commentary, and Corrections","Scores, grades, and commentary are statements of opinion based on the documents submitted to the Service. If you are an inspector or other party who believes an output is inaccurate, your exclusive remedy is to submit a correction request through the Service, which the operator may review and act upon at its sole discretion."],
    ["10. Informational Purpose","The Service and its outputs are provided for general informational purposes. Nothing in the Service is intended to assert as fact that any person engaged in wrongdoing; ratings reflect automated analysis of submitted documents only."],
    ["11. Eligibility and Accounts","You must be at least 18 years old and provide accurate registration information. You are responsible for activity under your account and for safeguarding your credentials."],
    ["12. Subscriptions and Payments","Paid subscriptions renew automatically until cancelled. You may cancel at any time; cancellation takes effect at the end of the then-current billing period. Except where required by law, fees already paid are non-refundable."],
    ["13. Dispute Resolution; Arbitration, Class-Action Waiver, and Attorneys' Fees","Any dispute arising out of or relating to these Terms or the Service shall be resolved by binding individual arbitration. You and the operator each waive any right to a jury trial and to participate in any class, collective, or representative action. In any arbitration, suit, or other proceeding arising out of or relating to these Terms or the Service, the prevailing party shall be entitled to recover its reasonable attorneys' fees, costs, and expenses from the non-prevailing party, to the fullest extent permitted by law."],
    ["14. Governing Law and Venue","These Terms are governed by the laws of the State of Texas, without regard to its conflict-of-laws principles. Subject to Section 13, exclusive venue lies in the state and federal courts located in Travis County, Texas."],
    ["15. Modifications","The operator may modify these Terms at any time. Material changes will be posted with an updated date; continued use after changes constitutes acceptance."],
    ["16. Termination","The operator may suspend or terminate your access at any time, with or without cause or notice."],
    ["17. Severability","If any provision of these Terms is held invalid or unenforceable, that provision shall be enforced to the maximum extent permissible and the remaining provisions shall remain in full force and effect."],
    ["18. Contact","Questions about these Terms may be sent to the contact address listed on the Service."],
  ];
  return (
    <div style={{maxWidth:760,margin:"0 auto"}}>
      <h2 style={{fontSize:26,fontWeight:800,letterSpacing:"-0.02em",marginBottom:4}}>Terms &amp; Conditions</h2>
      <p style={{color:C.dim,fontSize:13,marginBottom:24}}>Last updated June 4, 2026. By creating an account you agree to these Terms.</p>
      {sections.map(([h,body])=>(
        <div key={h} style={{marginBottom:20}}>
          <h3 style={{fontSize:15,fontWeight:700,color:"#fff",marginBottom:6}}>{h}</h3>
          <p style={{color:"#aaa",fontSize:13,lineHeight:1.75}}>{body}</p>
        </div>
      ))}
    </div>
  );
}

// ── TERMS ACCEPTANCE GATE (existing users must accept on next login) ──
const TERMS_VERSION = "1.0";
function TermsGate({token, view, onAccepted, onSignOut, showToast}) {
  const [agreed,setAgreed]=useState(false);
  const [loading,setLoading]=useState(false);
  if(view==="terms")return null; // let the full-terms tab render uncovered
  const accept=async()=>{
    if(!agreed||loading)return;
    setLoading(true);
    try{
      const res=await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"accept_terms",token})});
      const data=await res.json();
      if(!res.ok){showToast&&showToast(data.error||"Could not save — please try again.","error");setLoading(false);return;}
      onAccepted&&onAccepted();
    }catch{showToast&&showToast("Network error","error");setLoading(false);}
  };
  return (
    <div style={{...mOv,alignItems:"center",padding:16,zIndex:3000}}>
      <div style={{...mBox,borderRadius:16,maxWidth:440}}>
        <h2 style={{fontSize:20,fontWeight:800,color:"#fff",marginBottom:8}}>Please review our Terms</h2>
        <p style={{color:C.dim,fontSize:13,lineHeight:1.6,marginBottom:14}}>We've added Terms &amp; Conditions for InspectorTrust. To keep using your account, please review and agree to continue.</p>
        <a href="?view=terms" target="_blank" rel="noopener noreferrer" style={{display:"inline-block",color:C.gold,fontSize:13,textDecoration:"underline",marginBottom:16}}>Read the full Terms &amp; Conditions →</a>
        <label style={{display:"flex",alignItems:"flex-start",gap:8,fontSize:12,color:C.dim,marginBottom:16,cursor:"pointer",lineHeight:1.5}}>
          <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} style={{accentColor:C.gold,width:15,height:15,cursor:"pointer",marginTop:1,flexShrink:0}}/>
          <span>I have read and agree to the Terms &amp; Conditions, including the AI-generated-content disclaimer and limitation of liability.</span>
        </label>
        <button onClick={accept} disabled={!agreed||loading} style={{...bGold,width:"100%",justifyContent:"center",opacity:(!agreed||loading)?0.6:1,marginBottom:10}}>{loading?<><Spinner/> Saving...</>:"Agree & Continue"}</button>
        <button onClick={onSignOut} style={{background:"none",border:"none",color:C.dim,fontSize:13,cursor:"pointer",width:"100%",fontFamily:"inherit"}}>Sign out</button>
      </div>
    </div>
  );
}

// ── SET-NEW-PASSWORD MODAL (shown when arriving from a recovery link) ──
function ResetPasswordModal({token, onDone, showToast}) {
  const [pw,setPw]=useState("");
  const [pw2,setPw2]=useState("");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const submit=async()=>{
    if(pw.length<6){setErr("Password must be at least 6 characters.");return;}
    if(pw!==pw2){setErr("Passwords don't match.");return;}
    setErr("");setLoading(true);
    try{
      const res=await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"update_password",token,password:pw})});
      const data=await res.json();
      if(!res.ok){setErr(data.error||"Could not reset password.");setLoading(false);return;}
      showToast&&showToast("Password updated — please sign in with your new password.");
      onDone&&onDone();
    }catch{setErr("Network error. Please try again.");setLoading(false);}
  };
  return (
    <div style={{...mOv,alignItems:"center",padding:16,zIndex:3000}}>
      <div style={{...mBox,borderRadius:16,maxWidth:420}}>
        <h2 style={{fontSize:19,fontWeight:800,color:"#fff",marginBottom:8}}>Set a new password</h2>
        <p style={{color:C.dim,fontSize:13,marginBottom:16}}>Choose a new password for your InspectorTrust account.</p>
        {err&&<div style={{padding:"10px 14px",borderRadius:8,fontSize:13,marginBottom:14,background:"rgba(231,76,60,0.1)",color:C.red,border:`1px solid ${C.red}`}}>{err}</div>}
        <div style={{marginBottom:12}}><label style={lbl}>New password</label><input style={inp} type="password" autoComplete="new-password" placeholder="••••••••" value={pw} onChange={e=>setPw(e.target.value)}/></div>
        <div style={{marginBottom:16}}><label style={lbl}>Confirm new password</label><input style={inp} type="password" autoComplete="new-password" placeholder="••••••••" value={pw2} onChange={e=>setPw2(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")submit();}}/></div>
        <button onClick={submit} disabled={loading} style={{...bGold,width:"100%",justifyContent:"center",opacity:loading?0.7:1}}>{loading?<><Spinner/> Updating...</>:"Update password →"}</button>
      </div>
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────
export default function App() {
  const [view,setView]=useState(()=>{try{return new URLSearchParams(window.location.search).get("view")==="terms"?"terms":"home";}catch{return "home";}});
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
  const [authIntent,setAuthIntent]=useState(null);
  const [recoveryToken,setRecoveryToken]=useState(()=>{try{const h=new URLSearchParams(window.location.hash.replace(/^#/,""));return h.get("type")==="recovery"?h.get("access_token"):null;}catch{return null;}});
  const [session,setSession]=useState(null);
  const [mobileMenu,setMobileMenu]=useState(false);
  const [sharedToken,setSharedToken]=useState(null);
  const [sharedReport,setSharedReport]=useState(null);
  const [sharedLoading,setSharedLoading]=useState(false);
  const [sharedError,setSharedError]=useState("");
  const [registrySearch,setRegistrySearch]=useState("");
  const [propertyData,setPropertyData]=useState(null);
  const [lookingUp,setLookingUp]=useState(false);

  const lookupProperty=async(street,city,state,zip)=>{
    if(!street||!city||!state)return;
    setLookingUp(true);setPropertyData(null);
    try{
      const res=await fetch("/api/property",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({street,city,state,zip}),
      });
      const data=await res.json();
      if(data.found){
        setPropertyData(data);
        showToast(`Property found: Built ${data.yearBuilt} · ${data.homeAge} years old ✓`);
      } else {
        setPropertyData(null);
      }
    }catch(e){
      console.error("Property lookup failed:",e.message);
    }
    finally{setLookingUp(false);}
  };
  const fileRef=useRef();
  const [form,setForm]=useState({inspectorName:"",companyName:"",licenseNo:"",street:"",city:"",state:"",zip:"",buyerEmail:"",sellerEmail:"",realtorEmail:"",reportText:"",fileName:""});
  const [missing,setMissing]=useState({});

  useEffect(()=>{
    const s=getSession();
    if(s){setSession(s);loadRegistryReports(s.token);}

    // Handle return from Stripe signup checkout
    const params=new URLSearchParams(window.location.search);
    if(params.get("shared")){
      setSharedToken(params.get("shared"));
      sessionStorage.setItem("it_shared_token",params.get("shared"));
      setView("shared");
    }
    if(params.get("signup_success")==="true"){
      const pending=sessionStorage.getItem("it_pending_signup");
      if(pending){
        const {email,password,name,role,licenseNumber}=JSON.parse(pending);
        sessionStorage.removeItem("it_pending_signup");
        // Create the account now that payment is confirmed
        fetch("/api/auth",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({action:"signup",email,password,name,role,licenseNumber}),
        }).then(r=>r.json()).then(data=>{
          if(data.success){
            // Auto sign in
            return fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"signin",email,password})});
          }
        }).then(r=>r&&r.json()).then(data=>{
          if(data?.session){
            saveSession({token:data.session.access_token,profile:data.profile});
            setSession({token:data.session.access_token,profile:data.profile});
            showToast("Account created and payment confirmed! Welcome to InspectorTrust ✓");
            const _st=sessionStorage.getItem("it_shared_token");
            if(_st){sessionStorage.removeItem("it_shared_token");setSharedToken(_st);setView("shared");}
          }
        }).catch(()=>showToast("Payment successful! Please sign in to complete setup."));
        // Clean URL
        window.history.replaceState({},"","/");
      }
    }
    if(params.get("signup_cancelled")==="true"){
      showToast("Signup cancelled — no charge was made.","error");
      window.history.replaceState({},"","/");
    }
  },[]);

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
          submittedBy:r.submitted_by||null,
          impactedSale:!!r.impacted_sale,
          canFlag:!!r.can_flag,
          date:r.created_at?new Date(r.created_at).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}):"",
          createdAt:r.created_at||null,
          status:r.status||"complete",
          analysis:(r.analysis_data&&Object.keys(r.analysis_data).length)?{
            ...r.analysis_data,
            trustScore:r.analysis_data.trustScore??r.trust_score??null,
            fraudRisk:r.analysis_data.fraudRisk||r.fraud_risk||null,
            balanceScore:r.analysis_data.balanceScore??r.balance_score??null,
            inspectorGrade:r.analysis_data.inspectorGrade||r.inspector_grade||null,
          }:{
            trustScore:r.trust_score??null,
            fraudRisk:r.fraud_risk||null,
            balanceScore:r.balance_score??null,
            inspectorGrade:r.inspector_grade||null,
            summary:"",
            dealBreakers:[],notableIssues:[],minorObservations:[],
            strengths:[],concerns:[],biasIndicators:[],redFlags:[],
            recommendation:"",emailBuyer:"",emailSeller:"",emailRealtor:"",
          },
        }));
        setReports(normalized);
      }
    }catch(e){console.error("Failed to load registry:",e);}
  };

  const openSharedReport=async(token,sess)=>{
    const s=sess||session;
    if(!token)return;
    if(!s?.token){setShowAuth(true);return;}
    setSharedLoading(true);setSharedError("");
    try{
      const res=await fetch("/api/share",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${s.token}`},
        body:JSON.stringify({action:"verify",token}),
      });
      const data=await res.json();
      if(res.status===401){setShowAuth(true);setSharedError("Please sign in or create an account to view this report.");return;}
      if(!res.ok)throw new Error(data.error||"Could not open this report.");
      const r=data.report||{};
      setSharedReport({
        id:r.id,
        inspectorName:r.inspector_name||"Unknown",
        companyName:r.company_name||"",
        licenseNo:r.license_no||"",
        propertyAddress:r.property_address||"",
        date:r.created_at?fmt(r.created_at):"",
        savedToDb:true,
        analysis:r.analysis_data||{},
      });
    }catch(e){setSharedError(e.message);}
    finally{setSharedLoading(false);}
  };

  useEffect(()=>{
    if(sharedToken&&session&&!sharedReport&&!sharedLoading)openSharedReport(sharedToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sharedToken,session]);

  const toggleImpact=async(report)=>{
    if(!session?.token)return;
    const next=!report.impactedSale;
    setReports(rs=>rs.map(x=>x.id===report.id?{...x,impactedSale:next}:x));
    try{
      const res=await fetch("/api/analyze",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.token}`},
        body:JSON.stringify({mode:"flag_impact",reportId:report.id,impacted:next}),
      });
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||"Could not update the flag.");
      showToast(next?"Flagged as impacting the sale ✓":"Flag removed.");
    }catch(e){
      setReports(rs=>rs.map(x=>x.id===report.id?{...x,impactedSale:!next}:x));
      showToast(e.message,"error");
    }
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
        body:JSON.stringify({mode:"analyze",inspectorName:form.inspectorName,companyName:form.companyName,licenseNo:form.licenseNo,propertyAddress:addr,reportText:form.reportText,yearBuilt:propertyData?.yearBuilt||null,homeAge:propertyData?.homeAge||null,propertyType:propertyData?.propertyType||null,sqft:propertyData?.sqft||null,buyerEmail:form.buyerEmail,sellerEmail:form.sellerEmail,realtorEmail:form.realtorEmail}),
      });
      const data=await res.json();
      if(!res.ok){
        if(data.code==="TRIAL_EXPIRED"||data.code==="SUBSCRIPTION_REQUIRED"){setView("account");showToast(data.message,"error");return;}
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

  const sendEmails=async(reportId)=>{
    if(!reportId){showToast("This report needs to be saved before emails can be sent.","error");return;}
    setEmailSending(true);
    try{
      const res=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${session?.token}`},body:JSON.stringify({mode:"send_party_emails",reportId})});
      const data=await res.json();
      setEmailSending(false);
      if(!res.ok){showToast(data.error||"Could not send emails.","error");return;}
      if(data.notified&&data.notified.length){setEmailSent(true);showToast(`Summary emailed to: ${data.notified.join(", ")}.`);}
      else showToast("No buyer/seller/realtor email is on file for this report.","error");
    }catch(e){setEmailSending(false);showToast("Network error sending emails.","error");}
  };
  const viewReport=r=>{setAnalysisResult(r);setEmailSent(false);setView("report");};
  const onTemplateAnalyzed=(nr)=>{setReports(r=>[nr,...r]);setAnalysisResult(nr);setEmailSent(false);setView("report");if(nr.savedToDb&&session?.token)setTimeout(()=>loadRegistryReports(session.token),2000);};

  const role=session?.profile?.role;
  const isInspector=role==="inspector";
  const navLinks=[
    ["upload","Upload"],
    ...(isInspector?[["template","Template"]]:[]),
    ["database",`Registry (${reports.length})`],
    ["reports","Reports"],
    isInspector?["myinspections","My Inspections"]:["directory","Find Inspectors"],
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
      {showAuth&&<AuthModal onClose={()=>{setShowAuth(false);setAuthIntent(null);}} onAuth={onAuth} initialMode={authIntent?.mode} initialRole={authIntent?.role}/>}
      {session&&session.profile&&(!session.profile.terms_accepted_at||session.profile.terms_version!==TERMS_VERSION)&&<TermsGate token={session.token} view={view} showToast={showToast} onSignOut={signOut} onAccepted={()=>{const ns={...session,profile:{...session.profile,terms_accepted_at:new Date().toISOString(),terms_version:TERMS_VERSION}};saveSession(ns);setSession(ns);}}/>}
      {recoveryToken&&<ResetPasswordModal token={recoveryToken} showToast={showToast} onDone={()=>{setRecoveryToken(null);try{window.history.replaceState(null,"",window.location.pathname);}catch{}setShowAuth(true);}}/>}

      {/* HEADER */}
      <header style={{position:"sticky",top:0,zIndex:100,background:"rgba(14,14,14,0.96)",borderBottom:`1px solid ${C.border}`,backdropFilter:"blur(10px)"}}>
        <div style={{maxWidth:960,margin:"0 auto",padding:"0 16px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <button onClick={()=>navTo("home")} style={{background:"none",border:"none",color:C.gold,fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:"-0.01em"}}>▲ InspectorTrust</button>
          <nav className="desktop-nav" style={{display:"flex",gap:2,alignItems:"center"}}>
            {navLinks.map(([v,l])=><button key={v} onClick={()=>navTo(v)} style={{background:view===v?"rgba(200,168,75,0.08)":"none",border:"none",color:view===v?C.gold:C.muted,fontSize:13,fontWeight:500,cursor:"pointer",padding:"6px 10px",borderRadius:6,fontFamily:"inherit"}}>{l}</button>)}
            {session?(
              <>
                <button onClick={()=>navTo("account")} style={{background:"none",border:view==="account"?`1px solid ${C.gold}`:"1px solid #2a2a2a",color:view==="account"?C.gold:C.muted,fontSize:13,cursor:"pointer",padding:"6px 10px",borderRadius:6,fontFamily:"inherit",marginLeft:4}}>Account{session.profile?.subscription_status==="trial"?" 🕐":session.profile?.subscription_status==="expired"?" ⚠️":""}</button>
                <button onClick={signOut} style={{background:"none",border:"none",color:"#444",fontSize:13,cursor:"pointer",padding:"6px 8px",fontFamily:"inherit"}}>Sign Out</button>
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
            <button style={bGold} onClick={()=>session?navTo("upload"):setShowAuth(true)}>{session?"Analyze a Report →":"Get Started →"}</button>
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
          {[{n:"1 in 4",l:"inspectors flagged"},{n:"$5/yr",l:"buyers & sellers"},{n:"$50/yr",l:"realtors & inspectors"},{n:"10 yrs",l:"data retention"}].map(s=>(
            <div key={s.l} style={{...cardSm,textAlign:"center"}}><div style={{fontSize:"clamp(18px,3vw,24px)",fontWeight:800,color:C.gold,fontFamily:"monospace",marginBottom:3}}>{s.n}</div><div style={{fontSize:11,color:C.dim}}>{s.l}</div></div>
          ))}
        </div>

        <h2 style={{fontSize:"clamp(18px,3vw,22px)",fontWeight:700,letterSpacing:"-0.02em",marginBottom:6}}>Simple Pricing</h2>
        <p style={{color:C.dim,fontSize:14,marginBottom:18}}>For buyers, sellers, realtors, and inspectors.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginBottom:40}}>
          {[
            {title:"Buyer / Seller",price:"$5/yr",color:C.green,features:["Browse all inspection reports","View inspector Balance Scores","Search reports by property address","$5 per year"],btn:"green",lbl:"Sign Up →"},
            {title:"Realtor",price:"$5/mo or $50/yr",color:C.gold,features:["Upload & analyze inspection reports","Full AI performance reviews","Balance Score on every report","Auto email buyer, seller & agent","PDF export · 10-year storage","$5/month or $50/year"],btn:"gold",lbl:"Sign Up →"},
            {title:"Inspector",price:"$5/mo or $50/yr",color:C.blue,features:["Listed in verified inspector directory","Verified badge on your profile","Aggregate scores from all your reports","Realtors & buyers can find you","Yearly performance rankings","$5/month or $50/year"],btn:"blue",lbl:"Sign Up →"},
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
              <Field label="ZIP" value={form.zip} onChange={v=>{setField("zip")(v);if(form.street&&form.city&&form.state&&v.length>=5)lookupProperty(form.street,form.city,form.state,v);}} placeholder="78701" required missing={missing.zip}/>
            </div>
            {/* Property data banner */}
            {lookingUp&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"rgba(200,168,75,0.06)",border:"1px solid rgba(200,168,75,0.15)",borderRadius:8,fontSize:12,color:C.gold,marginTop:4}}><Spinner/> Looking up property data...</div>}
            {propertyData&&<div style={{background:"rgba(52,152,219,0.06)",border:"1px solid rgba(52,152,219,0.2)",borderRadius:8,padding:"10px 14px",marginTop:4}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><span style={{fontSize:14}}>🏠</span><span style={{color:"#7fb3d3",fontWeight:700,fontSize:13}}>Property Found via ATTOM</span><span style={{...tag(C.green),fontSize:10}}>Verified</span></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8}}>
                {[
                  ["Year Built",propertyData.yearBuilt||"—"],
                  ["Home Age",propertyData.homeAge?`${propertyData.homeAge} yrs`:"—"],
                  ["Type",propertyData.propertyType||"—"],
                  ["Beds",propertyData.bedrooms||"—"],
                  ["Baths",propertyData.bathrooms||"—"],
                  ["Sq Ft",propertyData.sqft?Number(propertyData.sqft).toLocaleString():"—"],
                ].map(([l,v])=>(
                  <div key={l} style={{textAlign:"center",background:"#0d0d0d",borderRadius:6,padding:"6px 8px"}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{v}</div>
                    <div style={{fontSize:10,color:C.dim}}>{l}</div>
                  </div>
                ))}
              </div>
              {propertyData.homeAge&&<p style={{color:"#555",fontSize:11,marginTop:8,fontStyle:"italic"}}>AI will use home age ({propertyData.homeAge} years) to calibrate what findings are age-appropriate vs genuine defects.</p>}
            </div>}
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
      {view==="report"&&analysisResult&&<ReportView report={analysisResult} onSendEmails={sendEmails} emailSending={emailSending} emailSent={emailSent} onBack={()=>navTo("database")} token={session?.token}/>}

      {/* REGISTRY */}
      {(view==="database"||view==="myinspections")&&<main style={{maxWidth:960,margin:"0 auto",padding:"24px 16px 80px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
          <div>
            <h2 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",marginBottom:4}}>{view==="myinspections"?"My Inspections":"Inspector Registry"}</h2>
            <p style={{color:C.dim,fontSize:14}}>{view==="myinspections"?"The inspection reports you've submitted, grouped by property.":"Organized by property address. Multiple inspections per property are grouped together."}</p>
          </div>
          <button onClick={()=>loadRegistryReports(session?.token)} style={bGhost}>↻ Refresh</button>
        </div>

        {/* Search */}
        <div style={{...cardSm,marginBottom:20,display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:16}}>🔍</span>
          <input
            style={{...inp,flex:1,fontSize:14,border:"none",background:"transparent",padding:"4px 0"}}
            placeholder="Search by property address, inspector name, or company..."
            value={registrySearch}
            onChange={e=>setRegistrySearch(e.target.value)}
          />
          {registrySearch&&<button onClick={()=>setRegistrySearch("")} style={{background:"none",border:"none",color:C.dim,cursor:"pointer",fontSize:16}}>✕</button>}
        </div>

        {(view==="myinspections"?reports.filter(r=>r.submittedBy===session?.profile?.id):reports).length===0?(
          <div style={{textAlign:"center",padding:"60px 0",border:`1px dashed ${C.border}`,borderRadius:12}}>
            <div style={{fontSize:48,marginBottom:14}}>🔍</div>
            <p style={{color:C.dim,marginBottom:6}}>{view==="myinspections"?"You haven't submitted any inspections yet.":session?"No reports found. Submit the first one.":"Sign in to view all reports."}</p>
            <button style={{...bGold,marginTop:14}} onClick={()=>session?navTo("upload"):setShowAuth(true)}>{session?"Submit a Report":"Sign In to View"}</button>
          </div>
        ):(()=>{
          const src=view==="myinspections"?reports.filter(r=>r.submittedBy===session?.profile?.id):reports;
          const q=(registrySearch||"").toLowerCase();
          const filtered=q?src.filter(r=>
            (r.propertyAddress||"").toLowerCase().includes(q)||
            (r.inspectorName||"").toLowerCase().includes(q)||
            (r.companyName||"").toLowerCase().includes(q)
          ):src;

          if(filtered.length===0)return(
            <div style={{textAlign:"center",padding:"40px",border:`1px dashed ${C.border}`,borderRadius:12}}>
              <p style={{color:C.dim}}>No reports match "{registrySearch}"</p>
              <button onClick={()=>setRegistrySearch("")} style={{...bGhost,marginTop:12}}>Clear search</button>
            </div>
          );

          // Group by property address
          const grouped={};
          filtered.forEach(r=>{
            const key=(r.propertyAddress||"Unknown Property").trim();
            if(!grouped[key])grouped[key]=[];
            grouped[key].push(r);
          });

          return(
            <div style={{display:"flex",flexDirection:"column",gap:28}}>
              {Object.entries(grouped).sort(([a],[b])=>a.localeCompare(b)).map(([address,propReports])=>(
                <div key={address}>
                  {/* Property group header */}
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,paddingBottom:10,borderBottom:`2px solid ${C.border}`}}>
                    <span style={{color:C.gold,fontSize:18}}>📍</span>
                    <div style={{flex:1}}>
                      <h3 style={{fontSize:16,fontWeight:700,color:"#fff",marginBottom:2}}>{address}</h3>
                      <span style={{color:C.dim,fontSize:12}}>{propReports.length} inspection report{propReports.length!==1?"s":""} on file</span>
                    </div>
                    <span style={{...tag(C.blue),fontSize:11,padding:"4px 10px"}}>{propReports.length} report{propReports.length!==1?"s":""}</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
                    {propReports.map(r=>{
                      const a=r.analysis||{};
                      const grade=a.inspectorGrade&&a.inspectorGrade!=="?"?a.inspectorGrade:null;
                      const analyzed=r.status==="complete"&&!!grade;
                      const gc=grade==="A"?C.green:grade==="B"?C.gold:grade==="C"?"#e67e22":C.red;
                      return (
                      <div key={r.id} style={{...card,position:"relative"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                          <div style={{flex:1,minWidth:0,marginRight:10}}>
                            <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.inspectorName}</div>
                            <div style={{color:C.dim,fontSize:12}}>{r.companyName||"Independent"} · {r.date}</div>
                          </div>
                          {analyzed
                            ? <span style={{...tag(gc),fontSize:16,fontWeight:800,padding:"3px 12px",fontFamily:"monospace"}}>{grade}</span>
                            : <span style={{...tag(C.gold),fontSize:10,fontWeight:700,padding:"4px 10px",whiteSpace:"nowrap"}}>⋯ Work in Progress</span>}
                        </div>
                        {analyzed&&a.balanceScore!==undefined&&a.balanceScore!==null&&<div style={{marginBottom:10}}><BalanceBar score={a.balanceScore}/></div>}
                        {analyzed
                          ? (a.summary?<p style={{color:"#777",fontSize:12,lineHeight:1.6,marginBottom:10,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{a.summary.slice(0,120)}…</p>:null)
                          : <p style={{color:C.dim,fontSize:12,lineHeight:1.6,marginBottom:10,fontStyle:"italic"}}>Analysis in progress — the grade appears once it finishes.</p>}
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          {analyzed&&a.fraudRisk&&a.fraudRisk!=="Unknown"&&<span style={tag(a.fraudRisk==="High"?C.red:a.fraudRisk==="Moderate"?C.gold:C.green)}>{a.fraudRisk} Risk</span>}
                          <div style={{display:"flex",gap:8,alignItems:"center",marginLeft:"auto"}}>
                            <ShareToEmailButton report={r} session={session} showToast={showToast}/>
                            <button style={{background:"none",border:"none",color:C.gold,fontSize:13,cursor:"pointer",fontWeight:600,fontFamily:"inherit"}} onClick={()=>viewReport(r)}>Full Review →</button>
                          </div>
                        </div>
                        {(r.canFlag||r.impactedSale)&&(
                          <div style={{marginTop:8}}>
                            {r.canFlag?(
                              <button
                                onClick={e=>{e.stopPropagation();toggleImpact(r);}}
                                title={r.impactedSale?"Flagged as impacting the sale — click to remove":"Flag this inspection as having impacted the sale"}
                                style={{display:"inline-flex",alignItems:"center",gap:6,cursor:"pointer",fontFamily:"inherit",fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:6,border:`1px solid ${r.impactedSale?C.gold:C.border2}`,background:r.impactedSale?`${C.gold}1f`:"transparent",color:r.impactedSale?C.gold:C.muted}}
                              >⚑ {r.impactedSale?"Impacted the sale ✓":"Did this impact the sale?"}</button>
                            ):(
                              <span style={{...tag(C.gold),fontSize:11,fontWeight:600,padding:"4px 10px"}}>⚑ Impacted the sale</span>
                            )}
                          </div>
                        )}
                        {r.savedToDb&&<div style={{color:C.green,fontSize:10,fontFamily:"monospace",marginTop:6,paddingRight:28}}>✓ Saved · 10yr retention</div>}
                        {session?.profile?.role==="admin"&&r.id&&r.id.includes("-")&&(
                          <button
                            title="Delete report"
                            aria-label="Delete report"
                            onClick={e=>{e.stopPropagation();deleteReport(r.id);}}
                            onMouseEnter={e=>{e.currentTarget.style.color=C.red;}}
                            onMouseLeave={e=>{e.currentTarget.style.color=C.dim;}}
                            style={{position:"absolute",bottom:12,right:14,background:"none",border:"none",color:C.dim,cursor:"pointer",padding:4,lineHeight:0,borderRadius:6}}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              <line x1="10" y1="11" x2="10" y2="17"/>
                              <line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                          </button>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </main>}

      {/* REPORTS DASHBOARD */}
      {view==="reports"&&(session?<main style={{maxWidth:960,margin:"0 auto",padding:"24px 16px 80px"}}><ReportsDashboard session={session} showToast={showToast}/></main>:<main style={{maxWidth:960,margin:"0 auto",padding:"24px 16px 80px"}}><h2 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",marginBottom:16}}>Reports Dashboard</h2><LockedTeaser onUnlock={()=>setShowAuth(true)} title="Sign in to unlock the reports dashboard" subtitle="See every inspector's Trust Score, Balance Score, letter grade, and fraud-risk rating across all analyzed reports."/></main>)}

      {/* SHARED REPORT (account-gated open) */}
      {view==="shared"&&<main style={{maxWidth:960,margin:"0 auto",padding:"24px 16px 80px"}}>
        {!session?(
          <div style={{textAlign:"center",padding:"60px 16px"}}>
            <div style={{fontSize:48,marginBottom:14}}>🔒</div>
            <h2 style={{fontSize:22,fontWeight:800,color:"#fff",marginBottom:8}}>Sign in to view this report</h2>
            <p style={{color:C.dim,fontSize:14,marginBottom:20}}>This report was shared with you securely. Sign in or create an account to open it.</p>
            <button style={bGold} onClick={()=>setShowAuth(true)}>Sign In / Sign Up →</button>
          </div>
        ):sharedLoading?(
          <div style={{textAlign:"center",padding:"60px 0"}}><Spinner lg/><p style={{color:C.dim,marginTop:16,fontSize:14}}>Opening report...</p></div>
        ):sharedError?(
          <div style={{textAlign:"center",padding:"60px 16px"}}>
            <div style={{fontSize:48,marginBottom:14}}>⚠️</div>
            <p style={{color:C.red,fontSize:15,marginBottom:16}}>{sharedError}</p>
            <button style={bOut} onClick={()=>{setView("home");setSharedToken(null);setSharedReport(null);window.history.replaceState({},"","/");}}>← Go Home</button>
          </div>
        ):sharedReport?(
          <ReportView
            report={sharedReport}
            onSendEmails={sendEmails}
            emailSending={emailSending}
            emailSent={emailSent}
            token={session?.token}
            onBack={()=>{setView("home");setSharedToken(null);setSharedReport(null);window.history.replaceState({},"","/");}}
          />
        ):(
          <div style={{textAlign:"center",padding:"60px 0"}}><Spinner lg/></div>
        )}
      </main>}

      {/* RANKINGS */}
      {view==="template"&&(session?<main style={{maxWidth:860,margin:"0 auto",padding:"24px 16px 80px"}}><InspectionTemplateView session={session} showToast={showToast} onAnalyzed={onTemplateAnalyzed}/></main>:<main style={{maxWidth:960,margin:"0 auto",padding:"60px 16px",textAlign:"center"}}><p style={{color:C.dim,fontSize:16,marginBottom:20}}>Sign in to use the inspection template.</p><button style={bGold} onClick={()=>setShowAuth(true)}>Sign In →</button></main>)}

      {view==="rankings"&&(session?<main style={{maxWidth:960,margin:"0 auto",padding:"24px 16px 80px"}}><YearlyRankings session={session} reports={reports} onRefresh={()=>loadRegistryReports(session?.token)}/></main>:<main style={{maxWidth:960,margin:"0 auto",padding:"60px 16px",textAlign:"center"}}><p style={{color:C.dim,fontSize:16,marginBottom:20}}>Sign in to view inspector rankings.</p><button style={bGold} onClick={()=>setShowAuth(true)}>Sign In →</button></main>)}

      {/* ACCOUNT */}
      {view==="terms"&&<main style={{maxWidth:960,margin:"0 auto",padding:"24px 16px 80px"}}><TermsPage/></main>}
      {view==="account"&&session&&<main style={{maxWidth:960,margin:"0 auto",padding:"24px 16px 80px"}}><AccountPage profile={session.profile} token={session.token} showToast={showToast} onStatusChange={(s)=>{const ns={...session,profile:{...session.profile,subscription_status:s}};saveSession(ns);setSession(ns);}}/></main>}

      {/* DIRECTORY */}
      {view==="directory"&&<main style={{maxWidth:960,margin:"0 auto",padding:"24px 16px 80px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
          <div><h2 style={{fontSize:24,fontWeight:800,marginBottom:4,letterSpacing:"-0.02em"}}>Inspector Directory</h2><p style={{color:C.dim,fontSize:14}}>Find verified, rated inspectors in your area.</p></div>
          <button style={bGold} onClick={()=>{setAuthIntent({mode:"signup",role:"inspector"});setShowAuth(true);}}>Register as Inspector — $5/mo or $50/yr →</button>
        </div>
        <div style={{textAlign:"center",padding:"60px 0",border:`1px dashed ${C.border}`,borderRadius:12}}>
          <div style={{fontSize:48,marginBottom:14}}>🔍</div>
          <p style={{color:C.dim,marginBottom:6}}>No verified inspectors listed yet.</p>
          <p style={{color:"#444",fontSize:13}}>Be the first to register.</p>
          <button style={{...bGold,marginTop:18}} onClick={()=>{setAuthIntent({mode:"signup",role:"inspector"});setShowAuth(true);}}>Register Now →</button>
        </div>
      </main>}

      <Disclaimer/>
    </div>
  );
}

// ── SHARE TO EMAIL (account-gated link) ──────────────────────
function ShareToEmailButton({report,session,showToast}){
  const [open,setOpen]=useState(false);
  const [email,setEmail]=useState("");
  const [sending,setSending]=useState(false);
  const isSaved = report?.id && String(report.id).includes("-");

  const send=async()=>{
    if(!email||!/.+@.+\..+/.test(email)){showToast("Enter a valid email address.","error");return;}
    if(!session?.token){showToast("Sign in to send.","error");return;}
    setSending(true);
    try{
      const res=await fetch("/api/share",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.token}`},
        body:JSON.stringify({
          action:"send",
          reportId:report.id,
          recipientEmail:email,
          inspectorName:report.inspectorName,
          propertyAddress:report.propertyAddress,
        }),
      });
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||"Failed to send.");
      showToast(`Secure link sent to ${email} ✓`);
      setEmail("");setOpen(false);
    }catch(e){showToast(e.message,"error");}
    finally{setSending(false);}
  };

  if(!isSaved)return null;

  return (
    <>
      <button title="Email a secure link to this report" onClick={e=>{e.stopPropagation();setOpen(true);}} style={{...bGhost,fontSize:12,padding:"4px 10px",gap:6}}>✉ Send</button>
      {open&&(
        <div style={mOv} onClick={e=>{e.stopPropagation();setOpen(false);}}>
          <div style={{...mBox,maxWidth:420}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h3 style={{fontSize:16,fontWeight:800,color:"#fff"}}>Email this report</h3>
              <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",color:C.dim,fontSize:20,cursor:"pointer"}}>✕</button>
            </div>
            <p style={{color:C.dim,fontSize:13,marginBottom:14,lineHeight:1.6}}>We&apos;ll email a secure link. The recipient must sign in or create an InspectorTrust account to open the report.</p>
            <label style={lbl}>Recipient email</label>
            <input style={inp} type="email" placeholder="recipient@email.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}/>
            <button onClick={send} disabled={sending} style={{...bGold,width:"100%",justifyContent:"center",marginTop:14,opacity:sending?0.7:1}}>{sending?<><Spinner/> Sending...</>:"Send Secure Link →"}</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── EMAIL A PARTY (account-gated link, per recipient) ────────
function EmailPartyButton({reportId,partyLabel,defaultEmail,inspectorName,propertyAddress,session,showToast}){
  const [open,setOpen]=useState(false);
  const [email,setEmail]=useState("");
  const [sending,setSending]=useState(false);
  const valid=reportId&&String(reportId).includes("-");
  const send=async()=>{
    if(!email||!/.+@.+\..+/.test(email)){showToast("Enter a valid email address.","error");return;}
    if(!session?.token){showToast("Sign in to send.","error");return;}
    setSending(true);
    try{
      const res=await fetch("/api/share",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.token}`},
        body:JSON.stringify({action:"send",reportId,recipientEmail:email,inspectorName,propertyAddress}),
      });
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||"Failed to send.");
      showToast(`Secure link sent to ${email} ✓`);
      setOpen(false);
    }catch(e){showToast(e.message,"error");}
    finally{setSending(false);}
  };
  if(!valid)return null;
  return (
    <>
      <button title={`Email report to ${partyLabel}`} aria-label={`Email report to ${partyLabel}`} onClick={()=>{setEmail(defaultEmail||"");setOpen(true);}} style={{...bGhost,padding:"8px 11px",fontSize:13,lineHeight:0}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/></svg>
      </button>
      {open&&(
        <div style={mOv} onClick={()=>setOpen(false)}>
          <div style={{...mBox,maxWidth:420}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h3 style={{fontSize:16,fontWeight:800,color:"#fff"}}>Email report to {partyLabel}</h3>
              <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",color:C.dim,fontSize:20,cursor:"pointer"}}>✕</button>
            </div>
            <p style={{color:C.dim,fontSize:13,marginBottom:14,lineHeight:1.6}}>We&apos;ll email a secure link. The {partyLabel.toLowerCase()} must sign in or create an InspectorTrust account to open the report.</p>
            <label style={lbl}>{partyLabel} email</label>
            <input style={inp} type="email" placeholder="name@email.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}/>
            <button onClick={send} disabled={sending} style={{...bGold,width:"100%",justifyContent:"center",marginTop:14,opacity:sending?0.7:1}}>{sending?<><Spinner/> Sending...</>:"Send Secure Link →"}</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── INSPECTION TEMPLATE (Supabase-backed · photos · analyze) ──
const TPL_WEIGHTS = {
  Heavy:{c:C.red,blurb:"Major system / safety. Drives the report and the deal."},
  Moderate:{c:C.gold,blurb:"Important, but rarely deal-breaking alone."},
  Low:{c:C.green,blurb:"Minor / cosmetic / age-appropriate. Note, don't inflate."},
};
const TPL_CONDITIONS=["Acceptable","Marginal","Deficient","Not Present","Not Inspected"];
const TPL_CONDCOLOR={Acceptable:C.green,Marginal:"#d8a13a",Deficient:C.red,"Not Present":C.dim,"Not Inspected":C.dim};
const tplId=()=>Math.random().toString(36).slice(2,9);
const tmk=(label,weight,critical=false)=>({id:tplId(),label,weight,critical});
const TPL_STANDARD=[
  ["Grounds & Site",[tmk("Grading slopes away from the foundation","Heavy",true),tmk("Exterior stairs, railings & handrails","Heavy",true),tmk("Retaining walls","Moderate"),tmk("Driveway & walkways","Low"),tmk("Vegetation in contact with the structure","Low")]],
  ["Roof",[tmk("Roof covering — condition & remaining life","Heavy",true),tmk("Flashing & penetrations","Moderate"),tmk("Gutters & downspouts discharge away from foundation","Moderate"),tmk("Chimney exterior, crown & cap","Moderate"),tmk("Skylights","Low")]],
  ["Exterior / Envelope",[tmk("Foundation — visible cracks / movement","Heavy",true),tmk("Decks, porches, balconies — ledger, attachment, railings","Heavy",true),tmk("Wall cladding / siding / trim","Moderate"),tmk("Exterior doors & windows — seals & operation","Moderate"),tmk("Soffits, fascia, eaves","Low"),tmk("Caulking & weather sealing","Low")]],
  ["Structure",[tmk("Foundation / slab / basement / crawlspace","Heavy",true),tmk("Roof framing / trusses — gusset plates, modifications","Heavy",true),tmk("Moisture / wood rot / pest damage in structure","Heavy",true),tmk("Floor framing & subfloor","Heavy"),tmk("Wall framing","Heavy"),tmk("Signs of settlement / movement","Heavy")]],
  ["Electrical",[tmk("Service entrance & capacity (amps)","Heavy",true),tmk("Main panel & breakers — double-taps, labeling, condition","Heavy",true),tmk("Branch wiring — type, condition, no exposed splices","Heavy",true),tmk("GFCI protection (kitchen / bath / exterior / garage)","Heavy",true),tmk("Smoke alarms — present & functional","Heavy",true),tmk("Carbon monoxide alarms — present & functional","Heavy",true),tmk("Grounding & bonding","Heavy"),tmk("Subpanels","Heavy"),tmk("AFCI protection","Moderate"),tmk("Outlets, switches & fixtures (representative sample)","Moderate")]],
  ["Plumbing",[tmk("Water supply lines — material, condition, pressure","Heavy",true),tmk("Drain, waste & vent system","Heavy",true),tmk("Water heater — age, condition, capacity","Heavy",true),tmk("Water heater TPR valve & discharge piping","Heavy",true),tmk("Gas supply lines & shutoffs","Heavy",true),tmk("Fixtures, faucets & drains — leaks & function","Moderate"),tmk("Functional flow & drainage","Moderate"),tmk("Sump pump","Moderate"),tmk("Well / septic indicators (if applicable)","Moderate")]],
  ["HVAC",[tmk("Heating system — type, age, operation","Heavy",true),tmk("Cooling system — type, age, operation","Heavy",true),tmk("Heat exchanger / combustion / flue venting (CO risk)","Heavy",true),tmk("Ductwork — condition, leaks, insulation","Moderate"),tmk("Thermostat & controls","Low"),tmk("Filters","Low"),tmk("Refrigerant line condition","Low")]],
  ["Interior",[tmk("Active leaks / moisture / suspected mold","Heavy",true),tmk("Interior stairs, railings & guardrails","Heavy",true),tmk("Garage — firewall / fire separation","Heavy",true),tmk("Garage door — auto-reverse & photo-eye safety","Heavy",true),tmk("Walls & ceilings — cracks, stains","Moderate"),tmk("Windows & doors — operation, glazing","Moderate"),tmk("Floors — condition & slope","Moderate")]],
  ["Insulation & Ventilation",[tmk("Dryer vent — material & termination (fire risk)","Moderate"),tmk("Attic insulation — type & depth / R-value","Moderate"),tmk("Attic ventilation","Moderate"),tmk("Bathroom / kitchen exhaust vents to exterior","Low"),tmk("Vapor barriers","Low")]],
  ["Fireplace & Chimney",[tmk("Flue / liner","Heavy",true),tmk("Firebox & damper","Moderate"),tmk("Gas fireplace operation & venting","Moderate"),tmk("Hearth extension & clearances","Moderate")]],
  ["Built-in Appliances",[tmk("Range / cooktop / oven","Moderate"),tmk("Range hood / exhaust","Low"),tmk("Dishwasher","Low"),tmk("Garbage disposal","Low"),tmk("Built-in microwave","Low")]],
];
const buildTplStandard=()=>TPL_STANDARD.map(([title,items])=>({id:tplId(),title,items:items.map(i=>({...i,id:tplId()}))}));

function downscaleImage(file,maxDim=1600,quality=0.7){
  return new Promise((resolve,reject)=>{
    const img=new Image();const url=URL.createObjectURL(file);
    img.onload=()=>{URL.revokeObjectURL(url);let w=img.width,h=img.height;
      if(w>maxDim||h>maxDim){const s=maxDim/Math.max(w,h);w=Math.round(w*s);h=Math.round(h*s);}
      const cv=document.createElement("canvas");cv.width=w;cv.height=h;cv.getContext("2d").drawImage(img,0,0,w,h);
      resolve(cv.toDataURL("image/jpeg",quality));};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Could not read image"));};
    img.src=url;
  });
}

function InspectionTemplateView({session,showToast,onAnalyzed}){
  const [sections,setSections]=useState(buildTplStandard);
  const [basic,setBasic]=useState({inspectorName:"",license:"",company:"",date:new Date().toISOString().slice(0,10),street:"",city:"",state:"",zip:"",client:"",yearBuilt:"",weather:"",buyerEmail:"",sellerEmail:"",realtorEmail:""});
  const [fills,setFills]=useState({});
  const [editMode,setEditMode]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [analyzing,setAnalyzing]=useState(false);
  const [uploadingId,setUploadingId]=useState(null);

  useEffect(()=>{(async()=>{
    try{
      const res=await fetch("/api/template",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.token}`},body:JSON.stringify({action:"get"})});
      const data=await res.json();
      if(res.ok&&data.template){
        if(Array.isArray(data.template.sections))setSections(data.template.sections);
        if(data.template.identity)setBasic(b=>({...b,...data.template.identity}));
      }
    }catch(e){/* fall back to standard */}
    finally{setLoading(false);}
  })();},[]);

  const setBf=(k,v)=>setBasic(b=>({...b,[k]:v}));
  const setFill=(id,patch)=>setFills(f=>({...f,[id]:{condition:"",notes:"",photos:[],...f[id],...patch}}));

  const saveTemplate=async()=>{
    setSaving(true);
    try{
      const identity={inspectorName:basic.inspectorName,license:basic.license,company:basic.company};
      const res=await fetch("/api/template",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.token}`},body:JSON.stringify({action:"save",template:{sections,identity}})});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||"Save failed");
      showToast("Saved — this is now your template for every inspection ✓");
    }catch(e){showToast(e.message,"error");}
    finally{setSaving(false);}
  };
  const resetStandard=()=>{if(!window.confirm("Reset to the recommended standard template? Custom items will be removed."))return;setSections(buildTplStandard());setFills({});showToast("Reset to the standard template.");};

  const addPhotos=async(id,fileList)=>{
    const files=Array.from(fileList||[]);if(!files.length)return;
    setUploadingId(id);
    try{
      for(const file of files){
        const dataUrl=await downscaleImage(file);
        const res=await fetch("/api/template",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.token}`},body:JSON.stringify({action:"upload_photo",dataUrl})});
        const data=await res.json();
        if(!res.ok)throw new Error(data.error||"Upload failed");
        setFills(f=>{const cur=f[id]||{condition:"",notes:"",photos:[]};return {...f,[id]:{...cur,photos:[...(cur.photos||[]),{path:data.path,preview:data.url}]}};});
      }
    }catch(e){showToast("Photo: "+e.message,"error");}
    finally{setUploadingId(null);}
  };
  const removePhoto=(id,idx)=>setFills(f=>{const cur=f[id];if(!cur)return f;return {...f,[id]:{...cur,photos:cur.photos.filter((_,i)=>i!==idx)}};});

  const addItem=(sid)=>setSections(s=>s.map(sec=>sec.id===sid?{...sec,items:[...sec.items,{id:tplId(),label:"New item",weight:"Moderate",critical:false,custom:true}]}:sec));
  const updateItem=(sid,iid,patch)=>setSections(s=>s.map(sec=>sec.id===sid?{...sec,items:sec.items.map(it=>it.id===iid?{...it,...patch}:it)}:sec));
  const removeItem=(sid,iid)=>setSections(s=>s.map(sec=>sec.id===sid?{...sec,items:sec.items.filter(it=>it.id!==iid)}:sec));
  const addSection=()=>setSections(s=>[...s,{id:tplId(),title:"New Section",items:[],custom:true}]);
  const updateSection=(sid,t)=>setSections(s=>s.map(sec=>sec.id===sid?{...sec,title:t}:sec));
  const removeSection=(sid)=>{if(window.confirm("Delete this entire section?"))setSections(s=>s.filter(sec=>sec.id!==sid));};

  const allItems=sections.flatMap(s=>s.items);
  const completed=allItems.filter(i=>fills[i.id]?.condition).length;
  const defs=allItems.filter(i=>fills[i.id]?.condition==="Deficient");
  const heavyDef=defs.filter(i=>i.weight==="Heavy").length;
  const modDef=defs.filter(i=>i.weight==="Moderate").length;
  const lowDef=defs.filter(i=>i.weight==="Low").length;

  const serialize=()=>{
    const addr=[basic.street,basic.city,basic.state,basic.zip].filter(Boolean).join(", ");
    let out=`HOME INSPECTION REPORT (completed checklist via InspectorTrust template)\n`;
    out+=`Inspector: ${basic.inspectorName||"Unknown"} | License: ${basic.license||"N/A"} | Company: ${basic.company||"N/A"}\n`;
    out+=`Property: ${addr||"N/A"} | Date: ${basic.date||"N/A"} | Year Built: ${basic.yearBuilt||"Unknown"} | Weather: ${basic.weather||"N/A"}\nClient: ${basic.client||"N/A"}\n\n`;
    for(const sec of sections){
      if(!sec.items.some(it=>fills[it.id]?.condition))continue;
      out+=`== ${sec.title} ==\n`;
      for(const it of sec.items){
        const f=fills[it.id];if(!f?.condition)continue;
        out+=`[${it.weight.toUpperCase()}]${it.critical?"[CRITICAL]":""} ${it.label}: ${f.condition}\n`;
        if(f.notes)out+=`   Notes: ${f.notes}\n`;
        if(f.photos?.length)out+=`   (${f.photos.length} photo${f.photos.length>1?"s":""} attached)\n`;
      }
      out+="\n";
    }
    return out.trim();
  };

  const analyze=async()=>{
    const addr=[basic.street,basic.city,basic.state,basic.zip].filter(Boolean).join(", ");
    if(!basic.inspectorName||!basic.license||!basic.street){showToast("Inspector name, license, and property address are required.","error");return;}
    if(completed===0){showToast("Record at least one item's condition before analyzing.","error");return;}
    setAnalyzing(true);
    try{
      const photos=[];
      for(const sec of sections){for(const it of sec.items){const f=fills[it.id];if(f?.photos?.length){for(const p of f.photos){if(p?.path)photos.push({path:p.path,section:sec.title,item:it.label,weight:it.weight,condition:f.condition||""});}}}}
      const res=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.token}`},body:JSON.stringify({mode:"analyze",inspectorName:basic.inspectorName,companyName:basic.company,licenseNo:basic.license,propertyAddress:addr,reportText:serialize(),yearBuilt:basic.yearBuilt||null,homeAge:basic.yearBuilt?(new Date().getFullYear()-Number(basic.yearBuilt)):null,propertyType:null,sqft:null,buyerEmail:basic.buyerEmail,sellerEmail:basic.sellerEmail,realtorEmail:basic.realtorEmail,photos})});
      const data=await res.json();
      if(res.status===401){showToast("Session expired — sign in again.","error");return;}
      if(!res.ok)throw new Error(data.error||"Analysis failed");
      const nr={id:data.reportId||tplId(),inspectorName:basic.inspectorName,companyName:basic.company,licenseNo:basic.license,propertyAddress:addr,buyerEmail:"",sellerEmail:"",realtorEmail:"",analysis:data.analysis,savedToDb:data.saved,date:fmt(new Date())};
      if(onAnalyzed)onAnalyzed(nr);
    }catch(e){showToast("Analysis failed: "+e.message,"error");}
    finally{setAnalyzing(false);}
  };

  const WeightTag=({w})=><span style={{...tag(TPL_WEIGHTS[w].c),fontSize:9.5,fontFamily:"monospace",fontWeight:700,letterSpacing:"0.06em",padding:"2px 6px"}}>{w.toUpperCase()}</span>;

  if(loading)return <div style={{textAlign:"center",padding:"60px 0"}}><Spinner lg/><p style={{color:C.dim,marginTop:14,fontSize:14}}>Loading your template…</p></div>;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap",marginBottom:14}}>
        <div>
          <h1 style={{fontSize:26,fontWeight:800,color:"#fff",marginBottom:4}}>Inspection Template</h1>
          <p style={{color:C.dim,fontSize:13}}>Recommended standard · weighted · personalize and reuse on every inspection.</p>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button style={{...bGhost,...(editMode?{borderColor:C.gold,color:C.gold}:{})}} onClick={()=>setEditMode(e=>!e)}>{editMode?"Done editing":"Edit template"}</button>
          <button style={bGhost} onClick={resetStandard}>↻ Reset</button>
          <button style={bGhost} disabled={saving} onClick={saveTemplate}>{saving?<><Spinner/> Saving…</>:"💾 Save my template"}</button>
        </div>
      </div>

      <div style={{...cardSm,display:"flex",gap:14,flexWrap:"wrap",alignItems:"center",marginBottom:14}}>
        {Object.keys(TPL_WEIGHTS).map(w=>(
          <div key={w} style={{display:"flex",alignItems:"center",gap:7,minWidth:230,flex:1}}>
            <WeightTag w={w}/><span style={{fontSize:11,color:C.dim}}>{TPL_WEIGHTS[w].blurb}</span>
          </div>
        ))}
        <div style={{fontSize:11,color:C.dim}}>★ = critical item every inspector should check</div>
      </div>

      <div style={{...card,marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:700,color:C.gold,fontFamily:"monospace",letterSpacing:"0.05em",marginBottom:12}}>BASIC INFORMATION</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12}}>
          <div><label style={lbl}>Inspector Name <span style={{color:C.red}}>*</span></label><input style={{...inp,...(basic.inspectorName?{}:{borderColor:"#e74c3c66"})}} value={basic.inspectorName} onChange={e=>setBf("inspectorName",e.target.value)} placeholder="Jane Inspector"/></div>
          <div><label style={lbl}>License # <span style={{color:C.red}}>*</span></label><input style={{...inp,...(basic.license?{}:{borderColor:"#e74c3c66"})}} value={basic.license} onChange={e=>setBf("license",e.target.value)} placeholder="TREC 12345"/></div>
          <div><label style={lbl}>Company</label><input style={inp} value={basic.company} onChange={e=>setBf("company",e.target.value)} placeholder="Acme Home Inspections"/></div>
          <div><label style={lbl}>Inspection Date</label><input type="date" style={inp} value={basic.date} onChange={e=>setBf("date",e.target.value)}/></div>
          <div><label style={lbl}>Street <span style={{color:C.red}}>*</span></label><input style={{...inp,...(basic.street?{}:{borderColor:"#e74c3c66"})}} value={basic.street} onChange={e=>setBf("street",e.target.value)} placeholder="123 Main St"/></div>
          <div><label style={lbl}>City</label><input style={inp} value={basic.city} onChange={e=>setBf("city",e.target.value)} placeholder="Austin"/></div>
          <div><label style={lbl}>State</label><input style={inp} value={basic.state} onChange={e=>setBf("state",e.target.value)} placeholder="TX"/></div>
          <div><label style={lbl}>ZIP</label><input style={inp} value={basic.zip} onChange={e=>setBf("zip",e.target.value)} placeholder="78701"/></div>
          <div><label style={lbl}>Client</label><input style={inp} value={basic.client} onChange={e=>setBf("client",e.target.value)} placeholder="Buyer name"/></div>
          <div><label style={lbl}>Year Built</label><input style={inp} value={basic.yearBuilt} onChange={e=>setBf("yearBuilt",e.target.value)} placeholder="2014"/></div>
          <div><label style={lbl}>Weather / Conditions</label><input style={inp} value={basic.weather} onChange={e=>setBf("weather",e.target.value)} placeholder="Clear, 72°F, dry"/></div>
          <div><label style={lbl}>Buyer email <span style={{color:C.faint}}>(photo access)</span></label><input style={inp} value={basic.buyerEmail} onChange={e=>setBf("buyerEmail",e.target.value)} placeholder="buyer@email.com"/></div>
          <div><label style={lbl}>Seller email <span style={{color:C.faint}}>(photo access)</span></label><input style={inp} value={basic.sellerEmail} onChange={e=>setBf("sellerEmail",e.target.value)} placeholder="seller@email.com"/></div>
          <div><label style={lbl}>Realtor email</label><input style={inp} value={basic.realtorEmail} onChange={e=>setBf("realtorEmail",e.target.value)} placeholder="realtor@email.com"/></div>
        </div>
      </div>

      <div style={{...cardSm,display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>
        {[[`${completed}/${allItems.length}`,"Items recorded",C.gold],[heavyDef,"Heavy deficiencies",C.red],[modDef,"Moderate deficiencies",C.gold],[lowDef,"Low deficiencies",C.green]].map(([n,l,c])=>(
          <div key={l} style={{flex:1,minWidth:110,textAlign:"center",padding:"8px 6px",background:"#0a0a0a",borderRadius:8,border:`1px solid #242424`}}>
            <div style={{fontSize:22,fontWeight:800,color:c,fontFamily:"monospace"}}>{n}</div>
            <div style={{fontSize:10,color:C.dim}}>{l}</div>
          </div>
        ))}
      </div>

      {sections.map(sec=>(
        <div key={sec.id} style={{...card,marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,paddingBottom:10,borderBottom:`1px solid ${C.border}`}}>
            {editMode
              ? <input value={sec.title} onChange={e=>updateSection(sec.id,e.target.value)} style={{...inp,fontWeight:700,fontSize:15,flex:1}}/>
              : <div style={{fontSize:15,fontWeight:800,flex:1,color:"#fff"}}>{sec.title}</div>}
            {editMode&&<button style={{...bGhost,borderColor:`${C.red}55`,color:C.red,padding:"6px 9px"}} onClick={()=>removeSection(sec.id)}>🗑</button>}
          </div>
          {sec.items.map(item=>{
            const f=fills[item.id]||{};
            return (
              <div key={item.id} style={{padding:"10px 0",borderBottom:`1px solid ${C.surface2}`}}>
                {editMode?(
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                    <input value={item.label} onChange={e=>updateItem(sec.id,item.id,{label:e.target.value})} style={{...inp,flex:1,minWidth:180}}/>
                    <select value={item.weight} onChange={e=>updateItem(sec.id,item.id,{weight:e.target.value})} style={{...inp,width:"auto",color:TPL_WEIGHTS[item.weight].c,fontWeight:700}}>
                      {Object.keys(TPL_WEIGHTS).map(w=><option key={w} value={w}>{w}</option>)}
                    </select>
                    <button title="Toggle critical" style={{...bGhost,padding:"8px 10px",borderColor:item.critical?C.gold:C.border,color:item.critical?C.gold:C.faint}} onClick={()=>updateItem(sec.id,item.id,{critical:!item.critical})}>★</button>
                    <button style={{...bGhost,padding:"8px 10px",borderColor:`${C.red}55`,color:C.red}} onClick={()=>removeItem(sec.id,item.id)}>🗑</button>
                  </div>
                ):(
                  <>
                    <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",marginBottom:8}}>
                      {item.critical&&<span style={{color:C.gold}}>★</span>}
                      <span style={{fontSize:14,fontWeight:500}}>{item.label}</span>
                      <WeightTag w={item.weight}/>
                      {item.custom&&<span style={{fontSize:9,color:C.faint,fontFamily:"monospace"}}>CUSTOM</span>}
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                      {TPL_CONDITIONS.map(cond=>{const active=f.condition===cond;return (
                        <button key={cond} onClick={()=>setFill(item.id,{condition:active?"":cond})} style={{fontSize:11,fontWeight:600,fontFamily:"inherit",cursor:"pointer",borderRadius:6,padding:"5px 10px",border:`1px solid ${active?TPL_CONDCOLOR[cond]:C.border}`,background:active?`${TPL_CONDCOLOR[cond]}1f`:"transparent",color:active?TPL_CONDCOLOR[cond]:C.dim}}>{cond}</button>
                      );})}
                    </div>
                    <textarea value={f.notes||""} onChange={e=>setFill(item.id,{notes:e.target.value})} placeholder="Observations, location, recommendation…" rows={f.notes?2:1} style={{...inp,resize:"vertical",marginBottom:8}}/>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                      <label style={{...bGhost,cursor:uploadingId===item.id?"wait":"pointer",color:C.gold,borderColor:`${C.gold}55`,fontSize:12,padding:"6px 12px"}}>
                        {uploadingId===item.id?<><Spinner/> Uploading…</>:"📷 Add photo"}
                        <input type="file" accept="image/*" capture="environment" multiple style={{display:"none"}} disabled={uploadingId===item.id} onChange={e=>{addPhotos(item.id,e.target.files);e.target.value="";}}/>
                      </label>
                      {(f.photos||[]).map((p,i)=>(
                        <div key={i} style={{position:"relative"}}>
                          <img src={p.preview} alt="" style={{width:54,height:54,objectFit:"cover",borderRadius:6,border:`1px solid ${C.border}`}}/>
                          <button onClick={()=>removePhoto(item.id,i)} style={{position:"absolute",top:-6,right:-6,width:18,height:18,borderRadius:"50%",background:C.red,color:"#fff",border:"none",fontSize:11,cursor:"pointer",lineHeight:1}}>×</button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
          {editMode&&<button style={{...bGhost,marginTop:10,color:C.gold,borderColor:`${C.gold}55`}} onClick={()=>addItem(sec.id)}>+ Add item to {sec.title||"section"}</button>}
        </div>
      ))}

      {editMode&&<button style={{...bGold,width:"100%",justifyContent:"center",marginBottom:14}} onClick={addSection}>+ Add a custom section</button>}

      <div style={{position:"sticky",bottom:0,background:`${C.base}f2`,backdropFilter:"blur(8px)",borderTop:`1px solid ${C.border}`,padding:"12px 0",display:"flex",gap:12,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
        <span style={{fontSize:12,color:C.dim}}>{completed} of {allItems.length} items recorded{heavyDef>0?` · ${heavyDef} heavy deficienc${heavyDef===1?"y":"ies"}`:""}</span>
        <button style={{...bGold,opacity:analyzing?0.7:1}} disabled={analyzing} onClick={analyze}>{analyzing?<><Spinner/> Analyzing…</>:"Analyze this inspection →"}</button>
      </div>
    </div>
  );
}

// ── REPORT PHOTOS (access-controlled signed-URL gallery) ─────
function ReportPhotos({reportId,token}){
  const [state,setState]=useState({loading:true,photos:[],error:""});
  useEffect(()=>{
    let alive=true;
    if(!reportId||!String(reportId).includes("-")){setState({loading:false,photos:[],error:""});return;}
    (async()=>{
      try{
        const res=await fetch("/api/template",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({action:"get_photos",reportId})});
        const data=await res.json();
        if(!alive)return;
        if(res.status===403){setState({loading:false,photos:[],error:data.error||"Photos are restricted."});return;}
        if(!res.ok)throw new Error(data.error||"Could not load photos.");
        setState({loading:false,photos:data.photos||[],error:""});
      }catch(e){if(alive)setState({loading:false,photos:[],error:e.message});}
    })();
    return ()=>{alive=false;};
  },[reportId,token]);

  if(state.loading)return <div style={{textAlign:"center",padding:"40px 0"}}><Spinner lg/><p style={{color:C.dim,marginTop:12,fontSize:13}}>Loading photos…</p></div>;
  if(state.error)return <div style={{...card,textAlign:"center",color:C.dim}}>🔒 {state.error}</div>;
  if(!state.photos.length)return <div style={{...card,textAlign:"center",color:C.dim}}>No photos attached to this inspection.</div>;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14,animation:"fadeIn 0.2s ease"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12}}>
        {state.photos.map((p,i)=>(
          <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none"}}>
            <div style={{...cardSm,padding:8}}>
              <img src={p.url} alt={p.item||"inspection photo"} style={{width:"100%",height:130,objectFit:"cover",borderRadius:6,border:`1px solid ${C.border}`,display:"block"}}/>
              <div style={{marginTop:6,fontSize:11,color:C.text,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.item||"Photo"}</div>
              <div style={{fontSize:10,color:C.dim}}>{p.section}{p.condition?` · ${p.condition}`:""}</div>
            </div>
          </a>
        ))}
      </div>
      <p style={{fontSize:11,color:C.faint,textAlign:"center"}}>Private links, expire after an hour. Visible only to the agent and the buyer/seller on this report.</p>
    </div>
  );
}

// ── REPORT VIEW ──────────────────────────────────────────────
function ReportView({report,onSendEmails,emailSending,emailSent,onBack,token}) {
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
      const h2r=h=>{let x=h.replace("#","");if(x.length===3)x=x.split("").map(c=>c+c).join("");return[parseInt(x.slice(0,2),16),parseInt(x.slice(2,4),16),parseInt(x.slice(4,6),16)];};
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
        {["overview","findings","scores","emails","flags","photos"].map(t=><button key={t} onClick={()=>setTab(t)} style={tabB(tab===t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>)}
      </div>

      {tab==="photos"&&<ReportPhotos reportId={report.id} token={token}/>}
      {tab==="overview"&&<div style={{display:"flex",flexDirection:"column",gap:14,animation:"fadeIn 0.2s ease"}}>
        {a.homeAgeContext&&<div style={{background:"rgba(52,152,219,0.06)",border:"1px solid rgba(52,152,219,0.2)",borderRadius:10,padding:"10px 16px",display:"flex",alignItems:"center",gap:10,marginBottom:4}}><span style={{fontSize:16}}>🏠</span><p style={{fontSize:13,color:"#7fb3d3"}}>{a.homeAgeContext}</p></div>}
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
        <button style={{...bGold,width:"100%",justifyContent:"center",opacity:emailSent||emailSending?0.5:1,cursor:emailSent||emailSending?"default":"pointer"}} onClick={()=>!emailSent&&!emailSending&&onSendEmails(report.id)} disabled={emailSending||emailSent}>
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
