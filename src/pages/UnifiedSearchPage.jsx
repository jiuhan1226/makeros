import { useMemo, useState } from "react";
import { normalizeText } from "../utils/studyPlatform";

const APP_SHORTCUTS = [
  { page: "catalog", title: "전체 자격증", subtitle: "지원하는 자격증과 CBT 종목 보기", aliases: "자격증 기능사 기사 산업기사 종목 전체 CBT 문제은행" },
  { page: "meals", title: "학교 급식", subtitle: "선택한 학교의 날짜별 급식 확인", aliases: "급식 점심 밥 식단 메뉴 알레르기 나이스" },
  { page: "timetable", title: "학교 시간표", subtitle: "학급별·선생님별 수업과 직접 수정", aliases: "시간표 컴시간 수업 교시 선생님 학급" },
  { page: "partnerCalendar", title: "캘린더", subtitle: "목표와 일정을 월간 달력으로 확인", aliases: "달력 일정 날짜 스케줄" },
  { page: "partnerPlan", title: "전체 계획", subtitle: "AI가 가능한 시간에 나눈 학습 계획", aliases: "계획 플랜 공부 분량 주간 오늘" },
  { page: "partnerGoals", title: "목표 설정", subtitle: "자격증·내신·진로·할 일을 등록", aliases: "목표 추가 자격증 내신 할일 마감" },
  { page: "library", title: "내신 PDF 학습", subtitle: "학습 자료를 올리고 문제·노트를 만들기", aliases: "내신 PDF 업로드 교과서 학습자료" },
  { page: "notes", title: "AI 노트·개념카드", subtitle: "PDF별로 정리된 노트와 개념카드", aliases: "노트 개념카드 단어카드 암기 플래시카드" },
  { page: "tutor", title: "AI 튜터", subtitle: "질문이나 문제 이미지를 올려 해설 받기", aliases: "튜터 질문 이미지 해설 AI" },
  { page: "opportunities", title: "공모전·대외활동", subtitle: "고등학생 참여 가능 공고 찾기", aliases: "공모전 대회 대외활동 봉사 캠프 교육" },
  { page: "portfolio", title: "이력서·자기소개서", subtitle: "학교 양식에 맞춰 작성하고 인쇄", aliases: "이력서 자소서 자기소개서 취업 지원서" },
  { page: "career", title: "진로 로드맵·생기부 기록", subtitle: "직무 준비와 활동 근거를 단계별로 정리", aliases: "진로 직무 로드맵 생기부 학교생활기록부 세특" },
  { page: "invent", title: "발명", subtitle: "문제 발견부터 발명노트까지", aliases: "발명 아이디어 특허 지식재산" },
  { page: "projects", title: "프로젝트", subtitle: "제작 일정·역할·결과 기록", aliases: "프로젝트 제작 과제 팀 활동" },
];

export default function UnifiedSearchPage({ searchCbt, pdfLibrary, wrongNotes, bookmarks = [], notes = [], cards = [], onOpenCbt, onOpenPdf, onNavigate }) {
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState([]);
  const [remoteQuery, setRemoteQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [type, setType] = useState("all");
  const local = useMemo(() => {
    const term = normalizeText(query);
    if (!term) return [];
    const pdf = (pdfLibrary || []).flatMap((doc) => (doc.pages || []).filter((page) => normalizeText(page.text).includes(term)).slice(0, 8).map((page) => ({ type: "PDF", title: doc.name, subtitle: `${page.page}쪽`, text: page.text, id: `${doc.id}-${page.page}`, doc, page: page.page })));
    const wrong = (wrongNotes || []).filter((question) => normalizeText([question.question, question.subject, question.explanation].join(" ")).includes(term)).map((question) => ({ type: "오답", title: question.subject || question.examTitle || "CBT 오답", subtitle: question.examTitle || "", text: question.question, id: `wrong-${question.id}-${question.createdAt}`, question }));
    const saved = (bookmarks || []).filter((question) => normalizeText([question.question, question.subject].join(" ")).includes(term)).map((question) => ({ type: "북마크", title: question.subject || "북마크", subtitle: question.examTitle || "", text: question.question, id: `bookmark-${question.id}`, question }));
    const noteItems = (notes || []).filter((note) => normalizeText([note.title, note.summary, ...(note.keyPoints || [])].join(" ")).includes(term)).map((note) => ({ type: "AI 노트", title: note.title, subtitle: note.sourceName || "", text: note.summary, id: note.id }));
    const cardItems = (cards || []).filter((card) => normalizeText([card.front, card.back, card.sourceName].join(" ")).includes(term)).map((card) => ({ type: "개념카드", title: card.front, subtitle: card.sourceName || "", text: card.back, id: card.id }));
    return [...pdf, ...wrong, ...saved, ...noteItems, ...cardItems];
  }, [query, pdfLibrary, wrongNotes, bookmarks, notes, cards]);
  const shortcuts = useMemo(() => {
    const term = normalizeText(query);
    if (!term) return [];
    return APP_SHORTCUTS.filter((item) => normalizeText(`${item.title} ${item.subtitle} ${item.aliases}`).includes(term));
  }, [query]);
  const visibleShortcuts = type === "all" || type === "바로가기" ? shortcuts : [];
  const currentRemote = normalizeText(remoteQuery) === normalizeText(query) ? remote : [];
  const results = [...currentRemote, ...local].filter((item) => type === "all" || item.type === type);

  async function run() {
    const searchTerm = query.trim();
    if (!searchTerm) return;
    const exactShortcut = shortcuts.some((item) => normalizeText(item.title) === normalizeText(searchTerm));
    if (type === "바로가기" || exactShortcut) {
      setRemote([]);
      setRemoteQuery(searchTerm);
      return;
    }
    setBusy(true);
    setSearchError("");
    try {
      const cbt = await searchCbt(searchTerm);
      setRemote(cbt.map(({ exam, q }) => ({ type: "CBT", title: q.subject || exam?.title, subtitle: exam?.title || "", text: q.question, id: `cbt-${q.id}`, exam, question: q })));
      setRemoteQuery(searchTerm);
    } catch (error) {
      setRemote([]);
      setRemoteQuery(searchTerm);
      setSearchError(error?.message || "CBT 문제 검색에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="page-shell">
    <section className="page-title"><div><span className="eyebrow">MAKEROS SEARCH</span><h1>통합 검색</h1><p>MakerOS 기능, 자격증 문제, 내신 자료를 한 번에 찾습니다.</p></div></section>
    <section className="knowledge-search-sources" aria-label="검색 범위">
      <article><span>바로가기</span><strong>메뉴·기능</strong><small>전체 자격증, 급식, 시간표, 진로 등</small></article>
      <article><span>자격증</span><strong>CBT 문제·과목명</strong><small>기출문제, 저장한 오답과 북마크</small></article>
      <article><span>내신</span><strong>업로드한 PDF 본문</strong><small>AI 노트와 개념카드 내용</small></article>
    </section>
    <section className="panel knowledge-search">
      <label htmlFor="knowledge-search-input">찾고 싶은 개념이나 문제의 핵심 단어</label>
      <div className="knowledge-search-row"><input id="knowledge-search-input" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && run()} placeholder="예: 접지, 옴의 법칙, 산업안전심리"/><button className="primary" onClick={run} disabled={busy}>{busy ? "검색 중…" : "검색"}</button></div>
      <p>예를 들어 ‘급식’, ‘전체 자격증’, ‘옴의 법칙’을 검색하면 관련 기능이나 학습 내용을 바로 열 수 있어요.</p>
      <div className="chip-row">{["all", "바로가기", "CBT", "PDF", "오답", "북마크", "AI 노트", "개념카드"].map((value) => <button key={value} className={type === value ? "chip active" : "chip"} onClick={() => setType(value)}>{value === "all" ? "전체" : value}</button>)}</div>
    </section>
    {searchError && <p role="alert" className="maker-error">{searchError}</p>}
    {!!query && !!visibleShortcuts.length && <section className="app-shortcut-results" aria-label="MakerOS 바로가기 검색 결과">
      <header><span>바로가기</span><strong>{visibleShortcuts.length}개 기능</strong></header>
      <div>{visibleShortcuts.map((item) => <button type="button" key={item.page} onClick={() => onNavigate?.(item.page)}><span>↗</span><div><strong>{item.title}</strong><small>{item.subtitle}</small></div></button>)}</div>
    </section>}
    <section className="search-result-grid">
      {results.map((result) => <article className="panel knowledge-result" key={result.id}><span className="result-type">{result.type}</span><h3>{result.title}</h3><small>{result.subtitle}</small><p>{String(result.text || "").slice(0, 240)}</p>{result.type === "CBT" && <button className="secondary" onClick={() => onOpenCbt(result.exam, result.question)}>문제 열기</button>}{result.type === "오답" && <button className="secondary" onClick={() => onOpenCbt(null, result.question)}>다시 풀기</button>}{result.type === "PDF" && <button className="secondary" onClick={() => onOpenPdf(result.doc, result.page)}>PDF 학습 열기</button>}</article>)}
      {query && results.length === 0 && visibleShortcuts.length === 0 && <div className="empty-state">해당 단어와 연결된 기능이나 학습 자료가 없습니다.</div>}
    </section>
  </main>;
}
