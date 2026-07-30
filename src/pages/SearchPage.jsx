import { useMemo, useState } from "react";

export default function SearchPage({ exams = [], searchQuestions, onOpenResult }) {
  const [keyword, setKeyword] = useState(""); const [results, setResults] = useState([]); const [busy, setBusy] = useState(false); const [searched, setSearched] = useState(false);
  const examMap = useMemo(() => new Map(exams.map(e => [e.id, e])), [exams]);
  async function run(e){ e?.preventDefault(); const q=keyword.trim(); if(q.length<2)return; setBusy(true); try{setResults(await searchQuestions(q));setSearched(true);}finally{setBusy(false);} }
  return <main className="page-shell"><section className="page-title"><div><span className="eyebrow">SMART SEARCH</span><h1>기출문제 검색</h1><p>문제, 보기, 해설을 한 번에 검색하세요.</p></div></section>
    <form className="search-panel panel" onSubmit={run}><input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="예: 접지, 추락 방지, 변압기"/><button className="primary" disabled={busy||keyword.trim().length<2}>{busy?"검색 중":"검색"}</button></form>
    <section className="search-results">{results.map((q,i)=>{const exam=examMap.get(q.examId);return <button className="search-result-card" key={`${q.id}-${i}`} onClick={()=>onOpenResult(exam,q)}><span>{exam?.year || q.year}년 {exam?.round || q.round} · {q.subject}</span><strong>{q.questionNumber}. {q.question}</strong><small>{q.explanation ? `해설: ${q.explanation.slice(0,100)}` : "해설 준비 중"}</small></button>})}{searched&&!results.length&&<div className="empty-state">검색 결과가 없습니다.</div>}</section>
  </main>;
}
