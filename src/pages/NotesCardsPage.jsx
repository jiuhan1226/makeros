import { useEffect, useMemo, useState } from "react";

function sourceGroup(item){
  const type=String(item.sourceType||"").toLowerCase();
  if(type.includes("pdf")) return {root:"PDF",folder:item.sourceName||"PDF 자료"};
  return {root:"CBT",folder:item.certificateName||item.sourceName||"CBT 학습"};
}

export default function NotesCardsPage({ assets, onDelete, onGenerateFromWrong, busy, initialFocus }){
 const [tab,setTab]=useState("notes"),[flipped,setFlipped]=useState({}),[root,setRoot]=useState("전체"),[folder,setFolder]=useState("전체"),[focusedId,setFocusedId]=useState("");
 const all=useMemo(()=>tab==="notes"?assets.notes||[]:assets.cards||[],[tab,assets]);
 const folders=useMemo(()=>[...new Set(all.filter(x=>root==="전체"||sourceGroup(x).root===root).map(x=>sourceGroup(x).folder))],[all,root]);
 const items=useMemo(()=>all.filter(x=>{const g=sourceGroup(x);return(root==="전체"||g.root===root)&&(folder==="전체"||g.folder===folder)}),[all,root,folder]);
 const counts=useMemo(()=>({CBT:all.filter(x=>sourceGroup(x).root==="CBT").length,PDF:all.filter(x=>sourceGroup(x).root==="PDF").length}),[all]);

 useEffect(()=>{
   if(!initialFocus?.id)return;
   const collection=initialFocus.type==="cards"?(assets.cards||[]):(assets.notes||[]);
   const item=collection.find(entry=>entry.id===initialFocus.id);
   if(!item)return;
   const group=sourceGroup(item);
   setTab(initialFocus.type==="cards"?"cards":"notes");
   setRoot(group.root);
   setFolder(group.folder);
   setFocusedId(item.id);
   const timer=setTimeout(()=>{
     document.getElementById(`study-asset-${item.id}`)?.scrollIntoView({behavior:"smooth",block:"center"});
   },120);
   const clear=setTimeout(()=>setFocusedId(""),2600);
   return()=>{clearTimeout(timer);clearTimeout(clear)};
 },[initialFocus,assets.cards,assets.notes]);

 return <main className="page-shell"><section className="page-title"><div><span className="eyebrow">AI STUDY ASSETS</span><h1>AI 노트 · 단어카드</h1><p>자료가 섞이지 않도록 CBT 과목과 PDF 파일별 폴더로 정리합니다.</p></div><button className="primary" disabled={busy} onClick={onGenerateFromWrong}>{busy?"AI 생성 중…":"현재 CBT 오답으로 생성"}</button></section>
 <div className="tab-switch"><button className={tab==="notes"?"active":""} onClick={()=>{setTab("notes");setRoot("전체");setFolder("전체")}}>AI 노트 {assets.notes?.length||0}</button><button className={tab==="cards"?"active":""} onClick={()=>{setTab("cards");setRoot("전체");setFolder("전체")}}>단어카드 {assets.cards?.length||0}</button></div>
 <section className="asset-folder-layout"><aside className="panel asset-folder-sidebar"><strong>자료 폴더</strong>{["전체","CBT","PDF"].map(v=><button key={v} className={root===v?"active":""} onClick={()=>{setRoot(v);setFolder("전체")}}>{v}<span>{v==="전체"?all.length:counts[v]}</span></button>)}{root!=="전체"&&<><div className="folder-divider"/><small>{root} 세부 폴더</small><button className={folder==="전체"?"active":""} onClick={()=>setFolder("전체")}>전체 보기<span>{all.filter(x=>sourceGroup(x).root===root).length}</span></button>{folders.map(v=><button key={v} className={folder===v?"active":""} onClick={()=>setFolder(v)}>📁 {v}<span>{all.filter(x=>sourceGroup(x).root===root&&sourceGroup(x).folder===v).length}</span></button>)}</>}</aside>
 <div>{root==="전체"&&<section className="folder-overview">{["CBT","PDF"].map(v=><button key={v} className="panel folder-tile" onClick={()=>{setRoot(v);setFolder("전체")}}><b>📁</b><strong>{v} 학습자료</strong><span>{counts[v]}개</span></button>)}</section>}
 {tab==="notes"?<section className="note-grid">{items.map(n=><article id={`study-asset-${n.id}`} className={`panel ai-note-card ${focusedId===n.id?"asset-focus-highlight":""}`} key={n.id}><span className="result-type">{sourceGroup(n).root} · {n.sourceType||"학습 자료"}</span><h3>{n.title}</h3><p>{n.summary}</p>{n.details&&<p className="pdf-note-details">{n.details}</p>}<ul>{(n.keyPoints||[]).map((x,i)=><li key={i}>{x}</li>)}</ul><small>📁 {sourceGroup(n).folder}{n.pageStart?` · ${n.pageStart}${n.pageEnd&&n.pageEnd!==n.pageStart?`~${n.pageEnd}`:""}쪽`:""}</small><button className="text-button danger-text" onClick={()=>onDelete("notes",n.id)}>삭제</button></article>)}{!items.length&&<div className="empty-state">이 폴더에 생성된 AI 노트가 없습니다.</div>}</section>:<section className="flashcard-grid">{items.map(c=><button id={`study-asset-${c.id}`} className={`${flipped[c.id]?"flashcard flipped":"flashcard"} ${focusedId===c.id?"asset-focus-highlight":""}`} key={c.id} onClick={()=>setFlipped(v=>({...v,[c.id]:!v[c.id]}))}><span>{flipped[c.id]?"정답":"질문"}</span><strong>{flipped[c.id]?c.back:c.front}</strong><small>📁 {sourceGroup(c).folder} · 눌러서 뒤집기</small></button>)}{!items.length&&<div className="empty-state">이 폴더에 생성된 단어카드가 없습니다.</div>}</section>}</div></section></main>
}
