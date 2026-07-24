import { useMemo, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { readStudyAssets, saveStudyAssets, upsertPdfDocument } from "../utils/studyPlatform";
import { generateStudyAssetsFromPages } from "../utils/aiStudyAssets";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
const clean = (value = "") => String(value).replace(/\u0000/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
const normalizedName = (value = "") => String(value).replace(/\.pdf$/i, "").trim().toLowerCase();

async function extractPdfPages(file, onProgress) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    pages.push({ page: n, text: clean(content.items.map((item) => item.str).join(" ")) });
    onProgress?.(Math.round((n / pdf.numPages) * 100));
  }
  return pages;
}

function assetsForDocument(document) {
  if (!document) return { notes: [], cards: [] };
  const saved = readStudyAssets();
  const matches = (item) => item.pdfId === document.id || normalizedName(item.sourceName) === normalizedName(document.name);
  return {
    notes: (saved.notes || []).filter(matches),
    cards: (saved.cards || []).filter(matches),
  };
}

export default function PdfStudyPage({ library, onRefresh, onStartQuiz, onOpenTutor }) {
  const [doc, setDoc] = useState(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState("보통");
  const [tab, setTab] = useState("setup");
  const [assets, setAssets] = useState({ notes: [], cards: [] });
  const [flipped, setFlipped] = useState({});

  const selectedPages = useMemo(
    () => doc?.pages?.filter((page) => page.page >= startPage && page.page <= endPage) || [],
    [doc, startPage, endPage],
  );
  const sourceName = doc?.name || "PDF 학습 자료";

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus("PDF 전체 페이지의 텍스트를 분석하고 있습니다…");
    setProgress(1);
    try {
      const pages = await extractPdfPages(file, setProgress);
      const next = {
        id: `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        pageCount: pages.length,
        pages,
        lastPage: 1,
        createdAt: Date.now(),
      };
      upsertPdfDocument(next);
      onRefresh?.();
      setDoc(next);
      setAssets(assetsForDocument(next));
      setStartPage(1);
      setEndPage(pages.length);
      setStatus(`${pages.length}쪽 전체 분석 완료`);
    } catch (error) {
      setStatus(error.message || "PDF 분석에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function loadDocument(item) {
    setDoc(item);
    setAssets(assetsForDocument(item));
    setStartPage(1);
    setEndPage(item.pageCount || item.pages?.length || 1);
    setTab("setup");
    setStatus(`${item.name}을 불러왔습니다.`);
  }

  async function generateQuiz() {
    if (!selectedPages.length) return;
    setBusy(true);
    setStatus("선택한 PDF 범위를 바탕으로 이해도 확인 퀴즈를 만들고 있습니다…");
    try {
      const response = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages: selectedPages, count, difficulty, mode: "PDF 이해도 확인", fileName: sourceName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "문제 생성 실패");
      onStartQuiz(data.questions || [], { name: sourceName, startPage, endPage, pdfId: doc?.id });
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function generateSet() {
    if (!selectedPages.length) return;
    setBusy(true);
    setProgress(0);
    setStatus("전체 범위를 여러 구간으로 나누어 자세한 학습 자료를 만들고 있습니다…");
    try {
      const created = await generateStudyAssetsFromPages({
        pages: selectedPages,
        sourceName,
        pdfId: doc?.id || "",
        onProgress: ({ index, total, pageStart, pageEnd }) => {
          setProgress(Math.round(((index - 1) / total) * 100));
          setStatus(`${index}/${total} 구간 분석 중 · ${pageStart}~${pageEnd}쪽`);
        },
      });
      const saved = readStudyAssets();
      const sameDocument = (item) => item.pdfId === doc?.id || normalizedName(item.sourceName) === normalizedName(sourceName);
      const next = {
        notes: [...created.notes, ...(saved.notes || []).filter((item) => !sameDocument(item))],
        cards: [...created.cards, ...(saved.cards || []).filter((item) => !sameDocument(item))],
      };
      saveStudyAssets(next);
      setAssets({ notes: created.notes, cards: created.cards });
      setProgress(100);
      setTab("summary");
      setStatus(`${selectedPages.length}쪽을 ${created.chunkCount}개 구간으로 분석해 노트 ${created.notes.length}개, 카드 ${created.cards.length}개를 만들었습니다.`);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  const mindmap = useMemo(
    () => assets.notes.map((note, index) => ({ title: note.title, children: note.keyPoints || [], index })),
    [assets.notes],
  );

  return <main className="page-shell pdf-native-page">
    <section className="page-title">
      <div>
        <span className="eyebrow">AI PDF STUDY</span>
        <h1>PDF 학습</h1>
        <p>PDF는 시험 종목이 아니라 학습 자료로 관리합니다. AI 퀴즈는 이해도 확인용이며 합격·불합격이나 과락을 판정하지 않습니다.</p>
      </div>
      {doc && <button className="secondary" onClick={() => { setDoc(null); setAssets({ notes: [], cards: [] }); }}>다른 PDF 선택</button>}
    </section>

    <section className="pdf-study-shell">
      <aside className="panel pdf-study-sidebar">
        <strong>PDF 학습 메뉴</strong>
        {[["setup", "학습 설정"], ["summary", "AI 상세 노트"], ["cards", "단어카드"], ["mindmap", "개념 구조"]].map(([key, label]) => (
          <button key={key} className={tab === key ? "active" : ""} disabled={key !== "setup" && !assets.notes.length} onClick={() => setTab(key)}>{label}</button>
        ))}
        <button onClick={() => onOpenTutor?.(sourceName)} disabled={!doc}>AI Tutor 질문</button>
        <div className="pdf-sidebar-divider" />
        <small>최근 PDF</small>
        {(library || []).map((item) => <button className="pdf-recent-item" key={item.id} onClick={() => loadDocument(item)} title={item.name}>{item.name}</button>)}
      </aside>

      <section className="pdf-study-main">
        {tab === "setup" && <>
          {!doc ? <section className="panel pdf-native-upload">
            <div className="pdf-native-icon">PDF</div>
            <h2>학습 자료를 업로드하세요</h2>
            <p>페이지 수가 많아도 전체 내용을 저장하고, AI 생성 시 구간별로 나누어 빠짐없이 정리합니다.</p>
            <label className="primary upload-button"><input type="file" accept="application/pdf" onChange={handleFile} />PDF 선택</label>
            {progress > 0 && progress < 100 && <div className="progress-track"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>}
          </section> : <div className="pdf-native-grid">
            <section className="panel pdf-source-card">
              <div className="pdf-source-head"><div className="pdf-file-icon">PDF</div><div><h2>{doc.name}</h2><p>{doc.pageCount || doc.pages?.length}쪽 · 전체 텍스트 저장 완료</p></div></div>
              <div className="pdf-text-preview">{selectedPages.map((page) => <details key={page.page} open={selectedPages.length <= 3}><summary>{page.page}쪽</summary><p>{page.text || "추출된 텍스트가 없습니다."}</p></details>)}</div>
            </section>
            <section className="panel pdf-config-card">
              <h2>학습 범위 설정</h2>
              <div className="settings-grid">
                <label>시작 페이지<input type="number" min="1" max={doc.pageCount} value={startPage} onChange={(event) => setStartPage(Number(event.target.value))} /></label>
                <label>종료 페이지<input type="number" min="1" max={doc.pageCount} value={endPage} onChange={(event) => setEndPage(Number(event.target.value))} /></label>
                <label>퀴즈 문항 수<select value={count} onChange={(event) => setCount(Number(event.target.value))}>{[5, 10, 15, 20].map((value) => <option key={value}>{value}</option>)}</select></label>
                <label>퀴즈 난이도<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option>쉬움</option><option>보통</option><option>어려움</option><option>최상</option></select></label>
              </div>
              <div className="pdf-range-summary"><span>선택 범위</span><strong>{startPage}~{endPage}쪽 · {selectedPages.length}페이지</strong></div>
              <div className="pdf-primary-actions"><button className="primary" disabled={busy} onClick={generateQuiz}>이해도 확인 퀴즈</button><button className="secondary" disabled={busy} onClick={generateSet}>상세 학습 자료 생성</button></div>
              {progress > 0 && progress < 100 && <div className="progress-track"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>}
              <p className="status">{status}</p>
            </section>
          </div>}
        </>}

        {tab === "summary" && <section className="panel pdf-feature-panel">
          <div className="section-title"><div><span className="eyebrow">DETAILED AI NOTES</span><h2>전체 범위 상세 노트</h2><p>요약 길이를 임의로 잘라내지 않고 구간별 핵심 설명과 세부 포인트를 모두 표시합니다.</p></div><button className="primary" onClick={generateQuiz}>이 범위로 퀴즈 풀기</button></div>
          <div className="pdf-note-outline">{assets.notes.map((note, index) => <a key={note.id} href={`#pdf-note-${index}`}>{note.pageStart ? `${note.pageStart}${note.pageEnd && note.pageEnd !== note.pageStart ? `~${note.pageEnd}` : ""}쪽 · ` : ""}{note.title}</a>)}</div>
          <div className="note-grid pdf-detailed-note-grid">{assets.notes.map((note, index) => <article className="ai-note-card" id={`pdf-note-${index}`} key={note.id}><span className="result-type">{note.pageStart ? `${note.pageStart}${note.pageEnd && note.pageEnd !== note.pageStart ? `~${note.pageEnd}` : ""}쪽` : "PDF"}</span><h3>{note.title}</h3><p>{note.summary}</p>{note.details && <p className="pdf-note-details">{note.details}</p>}<ul>{(note.keyPoints || []).map((point, pointIndex) => <li key={pointIndex}>{point}</li>)}</ul></article>)}</div>
        </section>}

        {tab === "cards" && <section className="panel pdf-feature-panel">
          <div className="section-title"><div><span className="eyebrow">FLASH CARDS</span><h2>AI 단어카드</h2></div><span>{assets.cards.length}장</span></div>
          <div className="flashcard-grid">{assets.cards.map((card) => <button className={`flashcard ${flipped[card.id] ? "flipped" : ""}`} key={card.id} onClick={() => setFlipped((value) => ({ ...value, [card.id]: !value[card.id] }))}><span>{flipped[card.id] ? "정답" : "질문"}</span><strong>{flipped[card.id] ? card.back : card.front}</strong><small>{card.pageStart ? `${card.pageStart}${card.pageEnd && card.pageEnd !== card.pageStart ? `~${card.pageEnd}` : ""}쪽 · ` : ""}카드를 눌러 뒤집기</small></button>)}</div>
        </section>}

        {tab === "mindmap" && <section className="panel pdf-feature-panel">
          <div className="section-title"><div><span className="eyebrow">PDF CONCEPT STRUCTURE</span><h2>PDF 개념 구조</h2><p>이 PDF에서 생성된 노트만 사용하며 다른 PDF나 CBT 기록을 섞지 않습니다.</p></div></div>
          <div className="pdf-mindmap"><div className="mindmap-center">{sourceName.replace(/\.pdf$/i, "")}</div>{mindmap.map((node) => <article key={node.index}><h3>{node.title}</h3>{node.children.map((point, pointIndex) => <span key={pointIndex}>{point}</span>)}</article>)}</div>
        </section>}
      </section>
    </section>
  </main>;
}
