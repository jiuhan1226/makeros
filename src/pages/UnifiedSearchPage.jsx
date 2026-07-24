import { useMemo, useState } from "react";
import { normalizeText } from "../utils/studyPlatform";

export default function UnifiedSearchPage({ searchCbt, pdfLibrary, wrongNotes, bookmarks = [], notes = [], cards = [], onOpenCbt, onOpenPdf }) {
  const [query,setQuery]=useState(""); const [remote,setRemote]=useState([]); const [busy,setBusy]=useState(false); const [type,setType]=useState("all");
  const local=useMemo(()=>{
    const term=normalizeText(query); if(!term)return[];
    const pdf=(pdfLibrary||[]).flatMap(doc=>(doc.pages||[]).filter(p=>normalizeText(p.text).includes(term)).slice(0,8).map(p=>({type:"PDF",title:doc.name,subtitle:`${p.page}쪽`,text:p.text,id:`${doc.id}-${p.page}`,doc,page:p.page})));
    const wrong=(wrongNotes||[]).filter(q=>normalizeText([q.question,q.subject,q.explanation].join(" ")).includes(term)).map(q=>({type:"오답",title:q.subject||q.examTitle||"CBT 오답",subtitle:q.examTitle||"",text:q.question,id:`wrong-${q.id}-${q.createdAt}`,question:q}));
    const saved=(bookmarks||[]).filter(q=>normalizeText([q.question,q.subject].join(" ")).includes(term)).map(q=>({type:"북마크",title:q.subject||"북마크",subtitle:q.examTitle||"",text:q.question,id:`bookmark-${q.id}`,question:q}));
    const noteItems=(notes||[]).filter(n=>normalizeText([n.title,n.summary,...(n.keyPoints||[])].join(" ")).includes(term)).map(n=>({type:"AI 노트",title:n.title,subtitle:n.sourceName||"",text:n.summary,id:n.id}));
    const cardItems=(cards||[]).filter(c=>normalizeText([c.front,c.back,c.sourceName].join(" ")).includes(term)).map(c=>({type:"암기카드",title:c.front,subtitle:c.sourceName||"",text:c.back,id:c.id}));
    return [...pdf,...wrong,...saved,...noteItems,...cardItems];
  },[query,pdfLibrary,wrongNotes,bookmarks,notes,cards]);
  const results=[...remote,...local].filter(x=>type==="all"||x.type===type);
  async function run(){if(!query.trim())return;setBusy(true);try{const cbt=await searchCbt(query);setRemote(cbt.map(({exam,q})=>({type:"CBT",title:q.subject||exam?.title,subtitle:exam?.title||"",text:q.question,id:`cbt-${q.id}`,exam,question:q})));}finally{setBusy(false)}}
  return <main className="page-shell"><section className="page-title"><div><span className="eyebrow">STUDYLOCK KNOWLEDGE</span><h1>통합 검색</h1><p>CBT, PDF, 오답, 북마크, AI 노트와 암기카드를 한 번에 찾습니다.</p></div></section>
    <section className="panel knowledge-search"><div className="knowledge-search-row"><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&run()} placeholder="예: 핀치오프, 접지, 산업안전심리"/><button className="primary" onClick={run} disabled={busy}>{busy?"검색 중…":"통합 검색"}</button></div><div className="chip-row">{["all","CBT","PDF","오답","북마크","AI 노트","암기카드"].map(v=><button key={v} className={type===v?"chip active":"chip"} onClick={()=>setType(v)}>{v==="all"?"전체":v}</button>)}</div></section>
    <section className="search-result-grid">{results.map(r=><article className="panel knowledge-result" key={r.id}><span className="result-type">{r.type}</span><h3>{r.title}</h3><small>{r.subtitle}</small><p>{String(r.text||"").slice(0,240)}</p>{r.type==="CBT"&&<button className="secondary" onClick={()=>onOpenCbt(r.exam,r.question)}>문제 열기</button>}{r.type==="오답"&&<button className="secondary" onClick={()=>onOpenCbt(null,r.question)}>다시 풀기</button>}{r.type==="PDF"&&<button className="secondary" onClick={()=>onOpenPdf(r.doc,r.page)}>PDF 학습 열기</button>}</article>)}{query&&results.length===0&&<div className="empty-state">검색 결과가 없습니다.</div>}</section>
  </main>;
}
