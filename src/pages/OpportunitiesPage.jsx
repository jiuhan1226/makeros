import React, { useEffect, useMemo, useState } from "react";

const KEY = "makeros-opportunity-bookmarks-v2";
const readSaved = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
function fieldOf(value = "") {
  if (/AI|SW|소프트웨어|게임|웹|모바일|코딩|데이터/i.test(value)) return "IT·소프트웨어";
  if (/과학|공학|로봇|전기|전자|기계|환경|에너지/i.test(value)) return "과학·공학";
  if (/취업|창업|아이디어|진로/i.test(value)) return "취업·창업";
  if (/봉사|서포터|기자단|캠프|멘토링|교육|체험/i.test(value)) return "활동·교육";
  return "기타";
}

export default function OpportunitiesPage({ portfolioItems = [], onChangePortfolioItems, onAddGoal }) {
  const [items, setItems] = useState([]);
  const [sources, setSources] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [query, setQuery] = useState("");
  const [field, setField] = useState("전체");
  const [kind, setKind] = useState("전체 유형");
  const [sort, setSort] = useState("마감순");
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState(readSaved);

  async function load(force = false) {
    setBusy(true); setError(""); setWarning("");
    try {
      const response = await fetch(`/api/opportunities${force ? "?force=1" : ""}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "공고를 불러오지 못했습니다.");
      setItems(body.items || []); setSources(body.sources || []); setWarning(body.warning || "");
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(saved)); }, [saved]);
  const visible = useMemo(() => items.filter((item) => {
    const text = `${item.title} ${item.categories} ${item.organization} ${item.source}`;
    const queryMatches = !query.trim() || text.toLowerCase().includes(query.toLowerCase());
    const fieldMatches = field === "전체" || fieldOf(text) === field;
    const kindMatches = kind === "전체 유형" || item.categories === kind;
    const savedMatches = !savedOnly || saved.includes(item.id);
    return queryMatches && fieldMatches && kindMatches && savedMatches;
  }).sort((a, b) => {
    if (sort === "출처순") return String(a.source).localeCompare(String(b.source), "ko");
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    return a.deadline ? -1 : b.deadline ? 1 : a.title.localeCompare(b.title, "ko");
  }), [items, query, field, kind, savedOnly, saved, sort]);

  function addActivity(item) {
    if (portfolioItems.some((entry) => entry.sourceUrl === item.url)) return alert("이미 이력서 활동에 저장된 공고입니다.");
    onChangePortfolioItems([{ id: `opportunity-${item.id}`, type: "대외활동", title: item.title, organization: item.organization || item.source || "", startDate: "", endDate: item.deadline || "", role: "", description: "참여 후 맡은 역할, 행동, 결과, 배운 점을 입력하세요.", sourceUrl: item.url }, ...portfolioItems]);
    alert("이력서의 교내외 활동에 저장했습니다.");
  }

  function addGoal(item) {
    onAddGoal?.(item);
    alert("목표에 추가했습니다. 계획을 다시 만들면 마감일까지 가능한 시간에 배치됩니다.");
  }

  return <main className="maker-page opportunities-page">
    <section className="maker-page-head"><div><span>OPPORTUNITIES</span><h1>공모전 · 대외활동</h1><p>여러 공개 공고 출처에서 고등학생·청소년 참여 대상이 확인된 항목을 모아봅니다.</p></div><button className="maker-ghost" onClick={() => load(true)}>새로고침</button></section>

    <section className="maker-card opportunity-source-health">
      <header><div><span>연결 출처</span><strong>{sources.filter((source) => source.ok).length}/{sources.length || 4}곳 수집</strong></div><small>같은 공고는 제목을 비교해 한 번만 표시합니다.</small></header>
      <div>{sources.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className={source.ok ? "connected" : "delayed"}><i>{source.ok ? "●" : "○"}</i><span>{source.name}</span><b>{source.ok ? `${source.count}건` : "지연"}</b></a>)}</div>
    </section>

    <section className="maker-card opportunity-filter">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="대회명, 분야, 주최기관 검색"/>
      <div>{["전체", "IT·소프트웨어", "과학·공학", "취업·창업", "활동·교육"].map((item) => <button key={item} className={field === item ? "active" : ""} onClick={() => setField(item)}>{item}</button>)}</div>
      <div className="opportunity-extra-filters"><select value={kind} onChange={(event) => setKind(event.target.value)}><option>전체 유형</option><option>공모전</option><option>대외활동</option><option>교육·캠프</option><option>봉사</option></select><select value={sort} onChange={(event) => setSort(event.target.value)}><option>마감순</option><option>출처순</option></select><label><input type="checkbox" checked={savedOnly} onChange={(event) => setSavedOnly(event.target.checked)}/> 관심 저장만</label></div>
    </section>
    <p className="opportunity-notice">자동 수집은 누락될 수 있습니다. 지원 전 주최기관의 공식 공고에서 참가 대상, 마감, 제출물을 반드시 다시 확인하세요.</p>
    {warning && <p className="opportunity-warning" role="status">{warning}</p>}
    {error && <section className="maker-error opportunity-error"><strong>{error}</strong><button type="button" onClick={() => load(true)}>다시 시도</button></section>}
    {busy ? <div className="maker-card maker-inline-empty"><h3>공개 공고를 모으는 중…</h3></div> : <section className="opportunity-grid">
      {visible.map((item) => { const bookmarked = saved.includes(item.id); return <article className="maker-card opportunity-card" key={item.id}><header><span>{fieldOf(`${item.title} ${item.categories}`)} · {item.categories || item.sourceType}</span><b>{item.dday || "마감일 확인"}</b></header><h2>{item.title}</h2><p>{item.organization || item.source || "주최기관 상세 확인"}</p><div className="opportunity-audience"><span>참여 대상 근거</span><strong>{item.audienceEvidence || "공고 상세에서 확인 필요"}</strong></div><small>{item.source}에서 확인 · {item.deadline || "마감일 상세 확인"}</small><footer><button className={bookmarked ? "saved" : ""} onClick={() => setSaved(bookmarked ? saved.filter((savedId) => savedId !== item.id) : [...saved, item.id])}>{bookmarked ? "★ 저장됨" : "☆ 관심 저장"}</button><button onClick={() => addGoal(item)}>목표에 추가</button><button onClick={() => addActivity(item)}>이력서에 저장</button><a href={item.url} target="_blank" rel="noreferrer">공식 공고 확인</a></footer></article>; })}
      {!visible.length && !error && <div className="maker-card maker-inline-empty"><h3>조건에 맞는 공고가 없습니다.</h3><p>검색어나 분야를 바꾸거나 연결 출처에서 직접 확인해 주세요.</p></div>}
    </section>}
    <footer className="opportunity-source">MakerOS는 공개 목록을 정리해 보여주며 공고를 주최하거나 지원 자격을 보증하지 않습니다.</footer>
  </main>;
}
