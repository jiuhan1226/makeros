import { useMemo, useState } from "react";
import { normalizeText } from "../utils/studyPlatform";

export default function UnifiedSearchPage({ searchCbt, pdfLibrary, wrongNotes, bookmarks = [], notes = [], cards = [], onOpenCbt, onOpenPdf }) {
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState([]);
  const [remoteQuery, setRemoteQuery] = useState("");
  const [busy, setBusy] = useState(false);
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
  const currentRemote = normalizeText(remoteQuery) === normalizeText(query) ? remote : [];
  const results = [...currentRemote, ...local].filter((item) => type === "all" || item.type === type);

  async function run() {
    const searchTerm = query.trim();
    if (!searchTerm) return;
    setBusy(true);
    try {
      const cbt = await searchCbt(searchTerm);
      setRemote(cbt.map(({ exam, q }) => ({ type: "CBT", title: q.subject || exam?.title, subtitle: exam?.title || "", text: q.question, id: `cbt-${q.id}`, exam, question: q })));
      setRemoteQuery(searchTerm);
    } finally {
      setBusy(false);
    }
  }

  return <main className="page-shell">
    <section className="page-title"><div><span className="eyebrow">MAKEROS KNOWLEDGE</span><h1>통합 검색</h1><p>내가 푼 자격증 문제와 업로드한 내신 자료 안에서 내용을 찾습니다.</p></div></section>
    <section className="knowledge-search-sources" aria-label="검색 범위">
      <article><span>자격증</span><strong>CBT 문제·과목명</strong><small>기출문제, 저장한 오답과 북마크</small></article>
      <article><span>내신</span><strong>업로드한 PDF 본문</strong><small>AI 노트와 개념카드 내용</small></article>
    </section>
    <section className="panel knowledge-search">
      <label htmlFor="knowledge-search-input">찾고 싶은 개념이나 문제의 핵심 단어</label>
      <div className="knowledge-search-row"><input id="knowledge-search-input" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && run()} placeholder="예: 접지, 옴의 법칙, 산업안전심리"/><button className="primary" onClick={run} disabled={busy}>{busy ? "검색 중…" : "검색"}</button></div>
      <p>입력한 단어가 포함된 문제 지문, PDF 본문, 오답, 노트와 개념카드를 찾아줍니다.</p>
      <div className="chip-row">{["all", "CBT", "PDF", "오답", "북마크", "AI 노트", "개념카드"].map((value) => <button key={value} className={type === value ? "chip active" : "chip"} onClick={() => setType(value)}>{value === "all" ? "전체" : value}</button>)}</div>
    </section>
    <section className="search-result-grid">
      {results.map((result) => <article className="panel knowledge-result" key={result.id}><span className="result-type">{result.type}</span><h3>{result.title}</h3><small>{result.subtitle}</small><p>{String(result.text || "").slice(0, 240)}</p>{result.type === "CBT" && <button className="secondary" onClick={() => onOpenCbt(result.exam, result.question)}>문제 열기</button>}{result.type === "오답" && <button className="secondary" onClick={() => onOpenCbt(null, result.question)}>다시 풀기</button>}{result.type === "PDF" && <button className="secondary" onClick={() => onOpenPdf(result.doc, result.page)}>PDF 학습 열기</button>}</article>)}
      {query && results.length === 0 && <div className="empty-state">해당 단어가 포함된 학습 자료가 없습니다.</div>}
    </section>
  </main>;
}
