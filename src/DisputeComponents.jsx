// DisputeComponents.jsx
// Self-contained dispute UI for InspectorTrust. Drop this file next to App.jsx
// (same folder) and add ONE import line to App.jsx:
//
//     import { DisputeButton, DisputesQueue } from "./DisputeComponents";
//
// It re-declares the few style tokens it needs, so it does not depend on App.jsx
// exporting anything. Talks to /api/disputes using your standard Bearer pattern.

import { useState, useEffect } from "react";

const C = {
  gold:"#C8A84B",base:"#0e0e0e",surface:"#111111",border:"#1e1e1e",border2:"#2a2a2a",
  text:"#e8e8e8",muted:"#888888",dim:"#555555",faint:"#333333",
  green:"#2ecc71",blue:"#3498db",red:"#e74c3c",
};
const card = {background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"20px 22px"};
const cTitle = {color:C.gold,fontSize:10,letterSpacing:"0.14em",fontFamily:"monospace",textTransform:"uppercase",marginBottom:14};
const inp = {width:"100%",background:"#0a0a0a",border:`1px solid #222`,borderRadius:6,padding:"10px 12px",color:C.text,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit"};
const lbl = {display:"block",color:C.dim,fontSize:12,marginBottom:5,letterSpacing:"0.04em"};
const bGold = {display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,background:C.gold,color:C.base,border:"none",borderRadius:8,padding:"11px 20px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"};
const bGrn = {display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,background:C.green,color:C.base,border:"none",borderRadius:8,padding:"11px 20px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"};
const bGhost = {display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,background:"transparent",color:C.muted,border:`1px solid #2a2a2a`,borderRadius:6,padding:"7px 12px",fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"inherit"};
const tag = c => ({display:"inline-block",color:c,background:`${c}15`,border:`1px solid ${c}40`,borderRadius:4,fontSize:11,fontFamily:"monospace",fontWeight:700,padding:"2px 10px"});
const mOv = {position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(6px)",zIndex:1000,display:"flex",alignItems:"flex-end",justifyContent:"center"};
const mBox = {background:C.surface,border:"1px solid #2a2a2a",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:460,padding:"28px 24px 40px",maxHeight:"90vh",overflowY:"auto"};

function Spinner({lg}) {
  return <span style={{width:lg?40:18,height:lg?40:18,border:`${lg?3:2}px solid rgba(200,168,75,0.2)`,borderTopColor:C.gold,borderRadius:"50%",animation:"spin 0.8s linear infinite",display:"inline-block",flexShrink:0,verticalAlign:"middle"}}/>;
}

// ── File a grade dispute (inspector / admin) ─────────────────
export function DisputeButton({report,session,role,disputing,onFiled,showToast}){
  const [open,setOpen]=useState(false);
  const [reason,setReason]=useState("");
  const [sending,setSending]=useState(false);
  const isInspector=role==="inspector"||role==="admin";
  const isSaved=report?.id&&String(report.id).includes("-");
  const grade=report?.analysis?.inspectorGrade||report?.analysis?.inspector_grade||null;
  // Only inspectors (admins for testing) can file, only on a saved report that
  // has a grade and isn't already being disputed.
  if(!isInspector||!isSaved||!grade||disputing)return null;

  const submit=async()=>{
    if(!reason.trim()){showToast&&showToast("Please explain why you're disputing this grade.","error");return;}
    if(!session?.token){showToast&&showToast("Sign in to dispute.","error");return;}
    setSending(true);
    try{
      const res=await fetch("/api/disputes",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.token}`},
        body:JSON.stringify({
          action:"file",
          reportId:report.id,
          reason:reason.trim(),
          inspectorName:report.inspectorName||report.inspector_name||null,
          propertyAddress:report.propertyAddress||report.property_address||null,
          grade,
        }),
      });
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||"Could not file dispute.");
      showToast&&showToast("Dispute submitted — the grade now shows as Disputing while it's reviewed.");
      setReason("");setOpen(false);
      onFiled&&onFiled();
    }catch(e){showToast&&showToast(e.message,"error");}
    finally{setSending(false);}
  };

  return (
    <>
      <button onClick={e=>{e.stopPropagation();setOpen(true);}} title="Dispute this grade" style={{...bGhost,fontSize:12,padding:"6px 12px",borderColor:`${C.blue}66`,color:C.blue}}>⚖ Dispute</button>
      {open&&(
        <div style={mOv} onClick={e=>{e.stopPropagation();setOpen(false);}}>
          <div style={{...mBox,maxWidth:440}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <h3 style={{fontSize:17,fontWeight:800,color:"#fff"}}>Dispute this grade</h3>
              <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",color:C.dim,fontSize:20,cursor:"pointer"}}>✕</button>
            </div>
            <p style={{color:C.dim,fontSize:13,lineHeight:1.6,marginBottom:14}}>
              You're disputing the <strong style={{color:C.text}}>{grade}</strong> grade on this report. While it's under review the grade will display as <span style={{color:C.blue,fontWeight:700}}>Disputing</span>. A dispute analyst will approve or reject it.
            </p>
            <label style={lbl}>Why is this grade inaccurate?</label>
            <textarea style={{...inp,minHeight:120,resize:"vertical",lineHeight:1.6}} placeholder="Explain what the analysis got wrong, with any context an analyst should weigh…" value={reason} onChange={e=>setReason(e.target.value)}/>
            <button onClick={submit} disabled={sending} style={{...bGold,width:"100%",justifyContent:"center",marginTop:14,opacity:sending?0.7:1}}>{sending?<><Spinner/> Submitting…</>:"Submit dispute →"}</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Review queue (dispute_analyst / admin) ───────────────────
export function DisputesQueue({session, showToast, onChanged}){
  const [disputes,setDisputes]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState("pending");
  const [busyId,setBusyId]=useState(null);
  const [noteFor,setNoteFor]=useState(null);
  const [note,setNote]=useState("");

  const load=async()=>{
    if(!session?.token)return;
    setLoading(true);
    try{
      const res=await fetch("/api/disputes",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.token}`},
        body:JSON.stringify({action:"list",status:filter||undefined}),
      });
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||"Could not load disputes.");
      setDisputes(data.disputes||[]);
    }catch(e){showToast&&showToast(e.message,"error");}
    finally{setLoading(false);}
  };

  useEffect(()=>{load();/* eslint-disable-next-line */},[filter]);

  const resolve=async(d,decision)=>{
    setBusyId(d.id);
    try{
      const res=await fetch("/api/disputes",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.token}`},
        body:JSON.stringify({action:"resolve",disputeId:d.id,decision,note:note||undefined}),
      });
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||"Could not update dispute.");
      showToast&&showToast(decision==="approved"?"Dispute approved — grade restored.":"Dispute rejected — grade restored.");
      setNoteFor(null);setNote("");
      await load();
      onChanged&&onChanged();
    }catch(e){showToast&&showToast(e.message,"error");}
    finally{setBusyId(null);}
  };

  const statusColor=s=>s==="pending"?C.blue:s==="approved"?C.green:C.red;
  const fmtWhen=(iso)=>{try{return iso?new Date(iso).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"";}catch{return "";}};

  return (
    <div style={{maxWidth:960,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",marginBottom:4}}>Dispute Review</h2>
          <p style={{color:C.dim,fontSize:14}}>Inspectors' grade disputes. Approve or reject — either way the grade returns to display once resolved.</p>
        </div>
        <button onClick={load} style={bGhost}>↻ Refresh</button>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
        {[["pending","Pending"],["approved","Approved"],["rejected","Rejected"],["","All"]].map(([k,label])=>{
          const on=filter===k;
          return <button key={k||"all"} onClick={()=>setFilter(k)} style={{padding:"8px 14px",borderRadius:8,border:`1.5px solid ${on?C.gold:"#222"}`,background:on?"rgba(200,168,75,0.1)":"#0a0a0a",color:on?C.gold:C.dim,cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit"}}>{label}</button>;
        })}
      </div>

      {loading?(
        <div style={{textAlign:"center",padding:"60px 0"}}><Spinner lg/><p style={{color:C.dim,marginTop:16,fontSize:14}}>Loading disputes…</p></div>
      ):disputes.length===0?(
        <div style={{textAlign:"center",padding:"60px 0",border:`1px dashed ${C.border}`,borderRadius:12}}>
          <div style={{fontSize:48,marginBottom:14}}>⚖</div>
          <p style={{color:C.dim}}>No {filter||""} disputes{filter?"":" yet"}.</p>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {disputes.map(d=>(
            <div key={d.id} style={card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4,flexWrap:"wrap"}}>
                    <span style={{fontWeight:700,fontSize:15,color:"#fff"}}>{d.inspector_name||"Unknown inspector"}</span>
                    {d.grade&&<span style={{...tag(C.gold),fontSize:12,fontWeight:800,fontFamily:"monospace"}}>Disputed grade: {d.grade}</span>}
                    <span style={{...tag(statusColor(d.status)),fontSize:11,textTransform:"capitalize"}}>{d.status}</span>
                  </div>
                  <div style={{color:C.dim,fontSize:12,marginBottom:8}}>📍 {d.property_address||"No address"} · filed {fmtWhen(d.created_at)}{d.filed_by_name?` by ${d.filed_by_name}`:""}</div>
                  <div style={{background:"#0d0d0d",border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px"}}>
                    <div style={{...cTitle,marginBottom:6}}>Inspector's reason</div>
                    <p style={{fontSize:13,color:"#bbb",lineHeight:1.65,whiteSpace:"pre-wrap"}}>{d.reason}</p>
                  </div>
                  {d.status!=="pending"&&(d.resolution_note||d.reviewed_by_name)&&(
                    <div style={{marginTop:10,fontSize:12,color:C.dim}}>
                      <span style={{color:statusColor(d.status),fontWeight:700,textTransform:"capitalize"}}>{d.status}</span>
                      {d.reviewed_by_name?` by ${d.reviewed_by_name}`:""}{d.reviewed_at?` · ${fmtWhen(d.reviewed_at)}`:""}
                      {d.resolution_note?<div style={{marginTop:4,color:"#999"}}>Note: {d.resolution_note}</div>:null}
                    </div>
                  )}
                </div>
              </div>

              {d.status==="pending"&&(
                <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
                  {noteFor===d.id&&(
                    <textarea style={{...inp,minHeight:70,resize:"vertical",marginBottom:10,lineHeight:1.5}} placeholder="Optional note explaining the decision…" value={note} onChange={e=>setNote(e.target.value)}/>
                  )}
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                    {noteFor!==d.id&&<button onClick={()=>{setNoteFor(d.id);setNote("");}} style={bGhost}>Add a note</button>}
                    <button onClick={()=>resolve(d,"approved")} disabled={busyId===d.id} style={{...bGrn,opacity:busyId===d.id?0.6:1}}>{busyId===d.id?<><Spinner/> Working…</>:"✓ Approve"}</button>
                    <button onClick={()=>resolve(d,"rejected")} disabled={busyId===d.id} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,background:C.red,color:"#fff",border:"none",borderRadius:8,padding:"11px 20px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:busyId===d.id?0.6:1}}>{busyId===d.id?<><Spinner/> Working…</>:"✕ Reject"}</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
