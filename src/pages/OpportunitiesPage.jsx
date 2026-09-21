import React, { useEffect, useMemo, useState } from "react";

function fieldOf(value = "") {
  if (/AI|SW|소프트웨어|게임|웹|모바일|코딩|데이터/i.test(value)) return "IT·소프트웨어";
  if (/과학|공학|로봇|전기|전자|기계|환경|에너지/i.test(value)) return "과학·공학";
  if (/취업|창업|아이디어|진로/i.test(value)) return "취업·창업";
  if (/영상|UCC|사진|디자인|문학|글|슬로건|웹툰/i.test(value)) return "콘텐츠·디자인";
  return "기타";
}

export default function OpportunitiesPage({ portfolioItems = [], onChangePortfolioItems, savedIds = [], onChangeSavedIds, onAddGoal }) {
  const [items, setItems] = useState([]);
  const [sources, setSources] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [query, setQuery] = useState("");
  const [field, setField] = useState("전체");
  const [sort, setSort] = useState("마감순");
  const [savedOnly, setSavedOnly] = useState(false);
  const [checkedAt, setCheckedAt] = useState(0);
  const saved = Array.isArray(savedIds) ? savedIds : [];

  async function load(force = false) {
    setBusy(true); setError(""); setWarning("");
    try {
      const response = await fetch(`/api/opportunities${force ? "?force=1" : ""}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "공고를 불러오지 못했습니다.");
      setItems(body.items || []); setSources(body.sources || []); setWarning(body.warning || ""); setCheckedAt(Number(body.checkedAt || Date.now()));
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }

  useEffect(() => { load(); }, []);
  const visible = useMemo(() => items.filter((item) => {
    const text = `${item.title} ${item.categories} ${item.organization} ${item.source}`;
    const queryMatches = !query.trim() || text.toLowerCase().includes(query.toLowerCase());
    const fieldMatches = field === "전체" || fieldOf(text) === field;
    const savedMatches = !savedOnly || saved.includes(item.id);
    return queryMatches && fieldMatches && savedMatches && item.verifiedAnnouncement && item.verifiedAudience;
  }).sort((a, b) => {
    if (sort === "출처순") return String(a.source).localeCompare(String(b.source), "ko");
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
    return a.deadline ? -1 : b.deadline ? 1 : a.title.localeCompare(b.title, "ko");
  }), [items, query, field, savedOnly, saved, sort]);

  function addActivity(item) {
    if (portfolioItems.some((entry) => entry.sourceUrl === item.url)) return alert("이미 이력서 활동에 저장된 공고입니다.");
    if (!window.confirm("이 대회에 실제로 참여했나요? 참여한 활동만 이력서에 기록해 주세요.")) return;
    onChangePortfolioItems([{ id: `opportunity-${item.id}`, type: "공모전", title: item.title, organization: item.organization || item.source || "", startDate: "", endDate: item.deadline === "상시" ? "" : (item.deadline || ""), role: "", description: "참여 후 맡은 역할, 행동, 결과, 배운 점을 입력하세요.", sourceUrl: item.url }, ...portfolioItems]);
    alert("이력서 활동에 추가했습니다. 실제 참여 기간과 역할을 확인해 주세요.");
  }

  function addGoal(item) {
    onAddGoal?.(item);
    alert("목표에 추가했습니다. 계획을 다시 만들면 마감일까지 가능한 시간에 배치됩니다.");
  }

  return <main className="maker-page opportunities-page">
    <section className="maker-page-head"><div><span>CONTEST NOTICES</span><h1>공모전 · 대회</h1><p>공개 공고에서 학생 대상과 접수 날짜를 찾아 정리합니다. 지원 전 모집 원문을 확인해 주세요.</p></div><button className="maker-ghost" onClick={() => load(true)}>새로고침</button></section>

    <section className="maker-card opportunity-source-health">
      <header><div><span>검증 출처</span><strong>{sources.filter((source) => source.ok).length}/{sources.length || 6}곳 확인</strong></div><small>{checkedAt ? `${new Date(checkedAt).toLocaleString("ko-KR")} 확인` : "수집 상태 확인 중"} · 교육부·교육청 공고 포함</small></header>
      <div>{sources.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className={source.ok ? "connected" : "delayed"}><i>{source.ok ? "●" : "○"}</i><span>{source.name}</span>{source.kind === "official" && <em>공공기관</em>}<b>{source.ok ? `${source.count}건` : source.failureCount ? `${source.failureCount}회 지연` : "확인 중"}</b><small>{source.lastSuccessAt ? `${new Date(source.lastSuccessAt).toLocaleString("ko-KR")} 성공` : "성공 기록 없음"}</small></a>)}</div>
    </section>

    <section className="maker-card opportunity-filter">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="대회명, 분야, 주최기관 검색"/>
      <div>{["전체", "IT·소프트웨어", "과학·공학", "취업·창업", "콘텐츠·디자인"].map((item) => <button key={item} className={field === item ? "active" : ""} onClick={() => setField(item)}>{item}</button>)}</div>
      <div className="opportunity-extra-filters"><select value={sort} onChange={(event) => setSort(event.target.value)}><option>마감순</option><option>출처순</option></select><label><input type="checkbox" checked={savedOnly} onChange={(event) => setSavedOnly(event.target.checked)}/> 관심 저장만</label></div>
    </section>
    <p className="opportunity-notice">공고 문구에서 모집 대상과 접수 마감일을 자동으로 추출합니다. 공고 원문에서 실제 자격·마감 시각·접수 방법을 확인하세요.</p>
    {warning && <p className="opportunity-warning" role="status">{warning}</p>}
    {error && <section className="maker-error opportunity-error"><strong>{error}</strong><button type="button" onClick={() => load(true)}>다시 시도</button></section>}
    {busy ? <div className="maker-card maker-inline-empty"><h3>공개 공고를 모으는 중…</h3></div> : <section className="opportunity-grid">
      {visible.map((item) => { const bookmarked = saved.includes(item.id); return <article className="maker-card opportunity-card" key={item.id}><header><span>{fieldOf(`${item.title} ${item.categories}`)}{item.sourceKind === "official" ? " · 공공기관 공고" : " · 외부 링크 포함"}</span><b>{item.dday}</b></header><h2>{item.title}</h2><p>{item.organization || item.source || "주최기관 확인 필요"}</p><div className="opportunity-audience"><span>공고에 표시된 참가 대상</span><strong>{item.audienceEvidence}</strong></div><div className="opportunity-verification">{(item.verification || []).map((entry) => <span key={entry}>{entry}</span>)}</div><small>{item.source}에서 수집 · {item.deadline === "상시" ? "상시 접수" : `${item.deadline} 접수 마감으로 표시됨`}</small><footer><button className={bookmarked ? "saved" : ""} onClick={() => onChangeSavedIds?.(bookmarked ? saved.filter((savedId) => savedId !== item.id) : [...saved, item.id])}>{bookmarked ? "★ 저장됨" : "☆ 관심 저장"}</button><button onClick={() => addGoal(item)}>목표에 추가</button><button onClick={() => addActivity(item)}>참여 기록하기</button><a href={item.url} target="_blank" rel="noreferrer">{item.sourceKind === "official" ? "공공기관 공고" : "연결된 공고"}</a>{item.listingUrl && <a className="secondary-link" href={item.listingUrl} target="_blank" rel="noreferrer">수집 페이지</a>}</footer></article>; })}
      {!visible.length && !error && <div className="maker-card maker-inline-empty"><h3>조건에 맞는 공고가 없습니다.</h3><p>검색어나 분야를 바꾸거나 연결 출처에서 직접 확인해 주세요.</p></div>}
    </section>}
    <footer className="opportunity-source">제공하는 날짜·참여 대상은 공고 문구를 기반으로 자동 추출한 참고 정보입니다. 주최기관의 최신 공고를 기준으로 신청하세요.</footer>
  </main>;
}
