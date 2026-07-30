import { useMemo, useState } from "react";

const CATEGORY_RULES = [
  { id: "all", label: "전체", keywords: [] },
  { id: "electric", label: "전기·공사", keywords: ["전기", "전기공사", "배선", "전력", "소방전기"] },
  { id: "safety", label: "안전", keywords: ["안전", "위험물", "가스", "소방", "산업위생", "건설"] },
  { id: "electronics", label: "전자", keywords: ["전자", "전자캐드", "반도체", "정보기기", "의료전자"] },
  { id: "mechanical", label: "기계·자동화", keywords: ["기계", "승강기", "자동화", "로봇", "설비", "공조", "냉동", "용접", "자동차"] },
  { id: "it", label: "정보통신·IT", keywords: ["정보", "통신", "컴퓨터", "웹", "소프트웨어", "네트워크", "정보처리"] },
];

function normalize(value = "") {
  return String(value).trim().toLowerCase();
}

function certificateCategory(certificate) {
  const explicit = normalize(certificate?.category || certificate?.field || certificate?.division);
  const haystack = normalize([
    certificate?.name,
    certificate?.grade,
    certificate?.category,
    certificate?.field,
    certificate?.division,
    ...(certificate?.tags || []),
  ].join(" "));

  for (const rule of CATEGORY_RULES.slice(1)) {
    if (explicit === normalize(rule.label) || explicit === rule.id) return rule.id;
    if (rule.keywords.some((keyword) => haystack.includes(normalize(keyword)))) return rule.id;
  }
  return "other";
}

export default function CatalogPage({ certificates, onSelect, history = [], wrongNotes = [], pdfLibrary = [], onNavigate }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const categorized = useMemo(() => certificates.map((certificate) => ({
    ...certificate,
    makerCategory: certificateCategory(certificate),
  })), [certificates]);

  const categoryCounts = useMemo(() => {
    const counts = { all: categorized.length, other: 0 };
    CATEGORY_RULES.slice(1).forEach((rule) => { counts[rule.id] = 0; });
    categorized.forEach((certificate) => {
      counts[certificate.makerCategory] = (counts[certificate.makerCategory] || 0) + 1;
    });
    return counts;
  }, [categorized]);

  const visibleCategories = useMemo(() => [
    CATEGORY_RULES[0],
    ...CATEGORY_RULES.slice(1).filter((rule) => categoryCounts[rule.id] > 0 || ["electric", "safety", "electronics"].includes(rule.id)),
    ...(categoryCounts.other > 0 ? [{ id: "other", label: "기타", keywords: [] }] : []),
  ], [categoryCounts]);

  const filtered = useMemo(() => {
    const term = normalize(query);
    return categorized.filter((certificate) => {
      const matchesCategory = category === "all" || certificate.makerCategory === category;
      const matchesQuery = !term || normalize([
        certificate.name,
        certificate.grade,
        certificate.description,
        ...(certificate.tags || []),
      ].join(" ")).includes(term);
      return matchesCategory && matchesQuery;
    });
  }, [categorized, category, query]);

  const solved = history.reduce((sum, item) => sum + (item.total || 0), 0);
  const recent = history[0];
  const selectedCategoryLabel = visibleCategories.find((item) => item.id === category)?.label || "전체";

  function resetFilters() {
    setCategory("all");
    setQuery("");
  }

  return <main className="catalog-page">
    <section className="catalog-hero coach-hero">
      <div className="coach-hero-copy">
        <span>AI 기반 자기주도학습 코치</span>
        <h1>혼자 공부해도<br/>길을 잃지 않도록</h1>
        <p>CBT와 PDF 학습을 한곳에서 관리하고, 오늘 필요한 공부를 추천받아 보세요.</p>
        <div className="hero-actions">
          <button className="primary" onClick={() => document.querySelector(".certificate-grid")?.scrollIntoView({ behavior: "smooth" })}>자격증 학습 시작</button>
          <button className="secondary" onClick={() => onNavigate?.("library")}>PDF 학습 시작</button>
        </div>
      </div>
      <div className="coach-preview" aria-label="MakerOS 학습 흐름">
        <div><span>1</span><strong>학습</strong><small>CBT와 PDF로 공부</small></div>
        <div><span>2</span><strong>분석</strong><small>오답과 취약 개념 확인</small></div>
        <div><span>3</span><strong>추천</strong><small>다음 학습 순서 제안</small></div>
      </div>
    </section>

    <section className="home-status-grid">
      <article><span>누적 풀이</span><strong>{solved}문제</strong><small>CBT 학습 기록</small></article>
      <article><span>복습 대기</span><strong>{wrongNotes.length}문제</strong><small>저장된 CBT 오답</small></article>
      <article><span>학습 자료</span><strong>{pdfLibrary.length}개</strong><small>등록된 PDF</small></article>
      <article><span>최근 학습</span><strong>{recent ? "기록 있음" : "학습 전"}</strong><small>{recent?.title || "첫 학습을 시작해 보세요"}</small></article>
    </section>

    <section className="catalog-heading"><div><span className="eyebrow">CERTIFICATE CBT</span><h2>학습할 자격증 선택</h2><p>학습할 자격증을 선택하고 맞춤형 CBT 학습을 시작하세요.</p></div></section>
    <div className="catalog-filters" role="group" aria-label="자격증 분야 필터">
      {visibleCategories.map((item) => <button
        key={item.id}
        type="button"
        className={category === item.id ? "active" : ""}
        aria-pressed={category === item.id}
        onClick={() => setCategory(item.id)}
      >
        <span>{item.label}</span><b>{categoryCounts[item.id] || 0}</b>
      </button>)}
    </div>
    <label className="search-box"><span>검색</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="원하는 자격증을 검색해보세요" />{query && <button type="button" className="catalog-search-clear" onClick={() => setQuery("")} aria-label="검색어 지우기">×</button>}</label>
    <div className="catalog-result-summary"><strong>{selectedCategoryLabel}</strong><span>{filtered.length}개 자격증</span>{(category !== "all" || query) && <button type="button" onClick={resetFilters}>필터 초기화</button>}</div>
    <section className="certificate-grid">{filtered.map((cert) => {
      const categoryLabel = visibleCategories.find((item) => item.id === cert.makerCategory)?.label || "기타";
      return <article className="certificate-card" key={cert.id}>
        <span className="certificate-category-chip">{categoryLabel}</span>
        <h2>{cert.name}</h2>
        <p>{cert.grade || "국가기술자격"}</p>
        <button onClick={() => onSelect(cert)}>학습 시작</button>
      </article>;
    })}{!filtered.length && <div className="catalog-empty-state"><strong>조건에 맞는 자격증을 찾지 못했어요.</strong><p>분야를 바꾸거나 다른 검색어로 다시 찾아보세요.</p><button type="button" className="secondary" onClick={resetFilters}>전체 자격증 보기</button></div>}</section>
  </main>;
}
