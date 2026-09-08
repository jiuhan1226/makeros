import React,{useEffect,useMemo,useState} from "react";
import { postJson } from "../utils/api";

const TUTOR_DAILY_LIMIT=5;
const TUTOR_USAGE_KEY="makeros:ai-tutor-usage:v1";

function seoulDayKey(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function readTutorRemaining(userKey="guest"){
  try{
    const saved=JSON.parse(localStorage.getItem(`${TUTOR_USAGE_KEY}:${userKey}`)||"{}");
    const savedRemaining=Number(saved.remaining);
    return saved.day===seoulDayKey()&&Number.isFinite(savedRemaining)?Math.max(0,Math.min(TUTOR_DAILY_LIMIT,savedRemaining)):TUTOR_DAILY_LIMIT;
  }catch{return TUTOR_DAILY_LIMIT;}
}
function saveTutorRemaining(userKey,remaining){
  try{localStorage.setItem(`${TUTOR_USAGE_KEY}:${userKey}`,JSON.stringify({day:seoulDayKey(),remaining}));}catch{/* 브라우저 저장소를 사용할 수 없어도 서버 제한은 유지됩니다. */}
}
function readImageFile(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>{
      const preview=String(reader.result||"");
      resolve({name:file.name||"학습 이미지",mimeType:file.type,data:preview.split(",")[1]||"",preview});
    };
    reader.onerror=()=>reject(new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function stripPdf(name=""){return String(name).replace(/\.pdf$/i,"").trim();}
function norm(value=""){return stripPdf(value).toLowerCase().replace(/[^가-힣a-z0-9]/g,"");}
function belongsToPdf(item,doc){
  if(!item||!doc)return false;
  if(item.pdfId)return item.pdfId===doc.id;
  return norm(item.sourceName)===norm(doc.name);
}

function selectPdfPages(doc,question=""){
  const pages=(doc?.pages||[]).filter(page=>String(page?.text||"").trim());
  if(!pages.length)return [];
  const tokens=String(question).toLowerCase().split(/[^가-힣a-z0-9]+/).filter(token=>token.length>=2&&!['pdf','내용','정리','설명','핵심','알려줘','관련'].includes(token));
  const matched=tokens.length?pages.filter(page=>tokens.some(token=>String(page.text||"").toLowerCase().includes(token))):[];
  let selected=matched.slice(0,8);
  if(!selected.length){
    const count=Math.min(8,pages.length);
    selected=Array.from({length:count},(_,index)=>pages[Math.min(pages.length-1,Math.round(index*(pages.length-1)/Math.max(1,count-1)))]);
  }
  return [...new Map(selected.map(page=>[page.page,page])).values()].map(page=>({page:page.page,text:String(page.text||"").slice(0,1800)}));
}

export default function AiTutorPage({certificate,initialQuery="",initialPdfId="",wrongNotes,pdfLibrary,assets,userKey="guest",searchCbt,onOpenCbt,onOpenPdf,onOpenGraph}){
  const initialPdf=useMemo(()=>(pdfLibrary||[]).find(doc=>doc.id===initialPdfId||doc.id===initialQuery||norm(doc.name)===norm(initialQuery)),[initialPdfId,initialQuery,pdfLibrary]);
  const [scope,setScope]=useState(()=>initialPdf?`pdf:${initialPdf.id}`:(certificate?.id?`cbt:${certificate.id}`:"all"));
  const [messages,setMessages]=useState([{role:"assistant",text:"안녕하세요. MakerOS AI Tutor입니다. 먼저 참고할 자료 범위를 선택하면 서로 다른 PDF와 CBT가 섞이지 않도록 답변해 드릴게요."}]);
  const [input,setInput]=useState(initialQuery||"");
  const [busy,setBusy]=useState(false);
  const [image,setImage]=useState(null);
  const [imageError,setImageError]=useState("");
  const [remaining,setRemaining]=useState(()=>readTutorRemaining(userKey));

  useEffect(()=>{
    if(initialPdf)setScope(`pdf:${initialPdf.id}`);
  },[initialPdf?.id]);
  useEffect(()=>{if(initialQuery)setInput(initialQuery);},[initialQuery]);
  useEffect(()=>setRemaining(readTutorRemaining(userKey)),[userKey]);

  const selectedPdf=useMemo(()=>scope.startsWith("pdf:")?(pdfLibrary||[]).find(doc=>doc.id===scope.slice(4)):null,[scope,pdfLibrary]);
  const isCbtScope=scope.startsWith("cbt:");
  const isPdfScope=scope.startsWith("pdf:");
  const scopedWrongNotes=useMemo(()=>{
    if(isPdfScope)return [];
    if(isCbtScope)return (wrongNotes||[]).filter(item=>item.certificateId?item.certificateId===certificate?.id:true);
    return wrongNotes||[];
  },[wrongNotes,isPdfScope,isCbtScope,certificate?.id]);
  const scopedPdfs=useMemo(()=>isPdfScope?(selectedPdf?[selectedPdf]:[]):scope==="all"?(pdfLibrary||[]):[],[isPdfScope,selectedPdf,scope,pdfLibrary]);
  const scopedNotes=useMemo(()=>{
    const notes=assets?.notes||[];
    if(isPdfScope)return notes.filter(item=>belongsToPdf(item,selectedPdf));
    if(isCbtScope)return notes.filter(item=>item.certificateId===certificate?.id||item.folderId===`cbt:${certificate?.id}`);
    return notes;
  },[assets,isPdfScope,isCbtScope,selectedPdf,certificate?.id]);
  const scopedCards=useMemo(()=>{
    const cards=assets?.cards||[];
    if(isPdfScope)return cards.filter(item=>belongsToPdf(item,selectedPdf));
    if(isCbtScope)return cards.filter(item=>item.certificateId===certificate?.id||item.folderId===`cbt:${certificate?.id}`);
    return cards;
  },[assets,isPdfScope,isCbtScope,selectedPdf,certificate?.id]);

  const suggestions=useMemo(()=>isPdfScope
    ? ["이 PDF의 핵심 내용을 구조적으로 정리해줘","이 PDF에서 꼭 이해해야 할 개념을 설명해줘","이 자료를 복습하는 순서를 알려줘","이 PDF의 개념을 쉽게 외우는 방법을 알려줘"]
    : ["최근 오답에서 가장 약한 개념을 알려줘","현재 자격증의 취약 과목을 정리해줘","오답을 줄이기 위한 복습 순서를 알려줘","시험에 자주 나오는 핵심만 정리해줘"],[isPdfScope]);

  async function selectImage(event){
    const file=event.target.files?.[0];
    event.target.value="";
    if(!file)return;
    setImageError("");
    if(!/^image\/(?:png|jpeg|webp|gif)$/.test(file.type))return setImageError("PNG, JPG, WEBP, GIF 이미지만 첨부할 수 있습니다.");
    if(file.size>4*1024*1024)return setImageError("이미지는 4MB 이하만 첨부할 수 있습니다.");
    try{setImage(await readImageFile(file));}catch(error){setImageError(error.message);}
  }

  async function ask(text=input){
    const activeImage=image;
    const question=String(text||"").trim()||(activeImage?"이 이미지를 분석해서 문제 풀이와 핵심 개념을 설명해 주세요.":"");
    if(!question||busy)return;
    if(remaining<=0){
      setMessages(m=>[...m,{role:"assistant",text:"오늘 사용할 수 있는 AI 튜터 5회를 모두 사용했습니다. 내일 다시 이용해 주세요.",error:true}]);
      return;
    }
    setInput("");setImage(null);setImageError("");setMessages(m=>[...m,{role:"user",text:question,imageUrl:activeImage?.preview}]);setBusy(true);
    try{
      const cbt=isPdfScope?[]:await searchCbt(question).catch(()=>[]);
      const context={
        scope:isPdfScope?{type:"pdf",id:selectedPdf?.id,name:selectedPdf?.name}:isCbtScope?{type:"certificate",id:certificate?.id,name:certificate?.name}:{type:"all"},
        certificate:isCbtScope?(certificate?.name||""):"",
        wrongNotes:scopedWrongNotes.slice(0,18).map(q=>({question:q.question,choices:q.choices,answerIndex:q.answerIndex,selectedAnswerIndex:q.selectedAnswerIndex,explanation:q.explanation,subject:q.subject,topic:q.topic})),
        pdf:scopedPdfs.slice(0,8).map(d=>({id:d.id,name:d.name,pages:selectPdfPages(d,question)})),
        notes:scopedNotes.slice(0,24).map(note=>({title:note.title,summary:note.summary,keyPoints:(note.keyPoints||[]).slice(0,12),sourceName:note.sourceName,pdfId:note.pdfId})),
        cards:scopedCards.slice(0,24).map(card=>({front:card.front,back:card.back,sourceName:card.sourceName,pdfId:card.pdfId})),
        cbt:(cbt||[]).slice(0,12).map(x=>({exam:x.exam,q:x.q})),
      };
      const result=await postJson("/api/ai-tutor",{question,context,image:activeImage?{label:activeImage.name,mimeType:activeImage.mimeType,data:activeImage.data}:null},"AI 답변 생성에 실패했습니다.");
      const nextRemaining=Math.max(0,Number(result.remainingDailyRequests??remaining-1));
      setRemaining(nextRemaining);saveTutorRemaining(userKey,nextRemaining);
      setMessages(m=>[...m,{role:"assistant",text:result.answer,resources:result.resources||[]}]);
    }catch(e){
      if(e.status===429||e.body?.requiresLogin){setRemaining(0);saveTutorRemaining(userKey,0);}
      setMessages(m=>[...m,{role:"assistant",text:e.message||"답변을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.",error:true}]);
    }finally{setBusy(false);}
  }

  const scopeLabel=isPdfScope?stripPdf(selectedPdf?.name||"PDF"):isCbtScope?`${certificate?.name||"자격증"} CBT`:"전체 학습 자료";

  return <main className="page-shell tutor-page">
    <section className="tutor-compact-head">
      <div><span className="eyebrow">AI 튜터</span><h1>{scopeLabel}</h1></div>
      <div className="tutor-compact-actions"><select aria-label="AI 튜터 참고 자료" value={scope} onChange={e=>setScope(e.target.value)}>
        {certificate?.id&&<option value={`cbt:${certificate.id}`}>{certificate.name} CBT·오답</option>}
        {(pdfLibrary||[]).map(doc=><option key={doc.id} value={`pdf:${doc.id}`}>PDF · {stripPdf(doc.name)}</option>)}
        <option value="all">전체 학습 자료</option>
      </select>{isPdfScope&&selectedPdf&&<button className="secondary" onClick={()=>onOpenGraph(selectedPdf.name)}>개념 트리</button>}</div>
    </section>

    <div className="tutor-layout"><aside className="card tutor-sidebar"><h3>추천 질문</h3>{suggestions.map(s=><button key={s} disabled={busy||remaining<=0} onClick={()=>ask(s)}>{s}</button>)}<div className="tutor-context"><b>현재 참고 범위</b><strong>{scopeLabel}</strong><span>CBT 오답 {scopedWrongNotes.length}개</span><span>PDF {scopedPdfs.length}개</span><span>AI 노트 {scopedNotes.length}개</span><span>개념카드 {scopedCards.length}개</span></div></aside>
      <section className="card tutor-chat"><div className="tutor-messages">{messages.map((m,i)=><article key={i} className={`tutor-message ${m.role} ${m.error?"error":""}`}><div>{m.role==="assistant"?"AI":"나"}</div>{m.imageUrl&&<img className="tutor-message-image" src={m.imageUrl} alt="질문에 첨부한 이미지"/>}<p>{m.text}</p>{m.resources?.length>0&&<section className="tutor-resources">{m.resources.map((r,k)=><button key={k} onClick={()=>r.type==="PDF"?onOpenPdf((pdfLibrary||[]).find(d=>d.id===r.id),r.page||1):r.type==="CBT"&&r.question?onOpenCbt(r.exam,r.question):onOpenGraph(r.label)}><b>{r.type}</b><span>{r.label}</span></button>)}</section>}</article>)}{busy&&<article className="tutor-message assistant"><div>AI</div><p>{scopeLabel}과 첨부 자료를 기준으로 답변을 만들고 있어요…</p></article>}</div><div className="tutor-composer">
        {image&&<div className="tutor-image-preview"><img src={image.preview} alt="첨부 이미지 미리보기"/><span>{image.name}</span><button type="button" aria-label="첨부 이미지 제거" onClick={()=>setImage(null)}>×</button></div>}
        {imageError&&<div className="tutor-image-error" role="alert">{imageError}</div>}
        <div className="tutor-composer-row"><label className="tutor-image-upload">이미지 첨부<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={selectImage} disabled={busy||remaining<=0}/></label><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();ask();}}} placeholder={remaining>0?`${scopeLabel}에 대해 질문하거나 문제 이미지를 첨부하세요.`:"오늘의 AI 튜터 5회를 모두 사용했습니다."} disabled={busy||remaining<=0}/><button className="primary" onClick={()=>ask()} disabled={busy||remaining<=0||(!input.trim()&&!image)}>질문하기</button></div>
        <small className="tutor-usage">오늘 <b>{remaining}</b>/{TUTOR_DAILY_LIMIT}회 남음 · 한국 시간 자정에 초기화</small>
      </div></section></div>
  </main>;
}
