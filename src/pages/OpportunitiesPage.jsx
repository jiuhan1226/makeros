import React, { useEffect, useMemo, useState } from "react";

const KEY = "makeros-opportunity-bookmarks-v1";
const readSaved = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
function fieldOf(value = "") {
  if (/AI|SW|소프트웨어|게임|웹|모바일/i.test(value)) return "IT·소프트웨어";
  if (/과학|공학|로봇|전기|전자|기계/i.test(value)) return "과학·공학";
  if (/취업|창업|아이디어/i.test(value)) return "취업·창업";
  return "기타";
}

export default function OpportunitiesPage({ portfolioItems = [], onChangePortfolioItems }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [query, setQuery] = useState("");
  const [field, setField] = useState("전체");
  const [saved, setSaved] = useState(readSaved);

  async function load() {
    setBusy(true); setError(""); setWarning("");
    try {
      const response = await fetch("/api/opportunities");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "공고를 불러오지 못했습니다.");
      setItems(body.items || []); setWarning(body.warning || "");
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(saved)); }, [saved]);
  const visible = useMemo(() => items.filter((item) => {
    const source = `${item.title} ${item.categories}`;
    return (!query.trim() || source.toLowerCase().includes(query.toLowerCase())) && (field === "전체" || fieldOf(source) === field);
  }), [items, query, field]);

  function addActivity(item) {
    if (portfolioItems.some((entry) => entry.sourceUrl === item.url)) return alert("이미 이력서 활동에 저장된 공고입니다.");
    onChangePortfolioItems([{ id: `opportunity-${item.id}`, type: "대외활동", title: item.title, organization: item.organization || "", startDate: "", endDate: item.deadline || "", role: "", description: "참여 후 역할과 성과를 입력하세요.", sourceUrl: item.url }, ...portfolioItems]);
    alert("이력서의 교내외 활동에 저장했습니다.");
  }

  return <main className="maker-page opportunities-page">
    <section className="maker-page-head"><div><span>OPPORTUNITIES</span><h1>공모전 · 대외활동</h1><p>고등학생이 지원할 수 있는 공고를 찾고 이력서 활동으로 연결합니다.</p></div><button className="maker-ghost" onClick={load}>새로고침</button></section>
    <section className="maker-card opportunity-filter"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="공모전명 또는 분야 검색"/><div>{["전체", "IT·소프트웨어", "과학·공학", "취업·창업"].map((item) => <button key={item} className={field === item ? "active" : ""} onClick={() => setField(item)}>{item}</button>)}</div></section>
    <p className="opportunity-notice">지원 전 주최기관의 공식 공고에서 대상, 일정, 제출물을 다시 확인하세요.</p>
    {warning && <p className="opportunity-warning" role="status">{warning}</p>}
    {error && <section className="maker-error opportunity-error"><strong>{error}</strong><a href="https://www.wevity.com/?c=find&cidx=30&gub=2&s=1" target="_blank" rel="noreferrer">청소년 공고 직접 보기</a></section>}
    {busy ? <div className="maker-card maker-inline-empty"><h3>공고를 불러오는 중…</h3></div> : <section className="opportunity-grid">
      {visible.map((item) => { const bookmarked = saved.includes(item.id); return <article className="maker-card opportunity-card" key={item.id}><header><span>{fieldOf(`${item.title} ${item.categories}`)}</span><b>{item.dday || item.status || "공고 확인"}</b></header><h2>{item.title}</h2><p>{item.organization || "주최기관 상세 확인"}</p><small>{item.categories}</small><footer><button className={bookmarked ? "saved" : ""} onClick={() => setSaved(bookmarked ? saved.filter((savedId) => savedId !== item.id) : [...saved, item.id])}>{bookmarked ? "★ 저장됨" : "☆ 관심 저장"}</button><button onClick={() => addActivity(item)}>이력서에 저장</button><a href={item.url} target="_blank" rel="noreferrer">상세 보기</a></footer></article>; })}
      {!visible.length && !error && <div className="maker-card maker-inline-empty"><h3>조건에 맞는 공고가 없습니다.</h3><p>검색어나 분야를 바꿔 보세요.</p></div>}
    </section>}
    <footer className="opportunity-source">출처: WEVITY 청소년 공모전 목록 · MakerOS는 공고를 주최하지 않습니다.</footer>
  </main>;
}
