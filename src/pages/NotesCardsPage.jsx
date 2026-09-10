import { useEffect, useMemo, useState } from "react";
import { applyCardResult, buildQuizChoices, cardMastery, filterCardsByMastery, shuffleCards } from "../utils/flashcardLearning";

function sourceGroup(item) {
  const type = String(item.sourceType || "").toLowerCase();
  if (type.includes("pdf")) return { root: "PDF", folder: item.sourceName || "PDF 자료" };
  return { root: "CBT", folder: item.certificateName || item.sourceName || "CBT 학습" };
}

const masteryLabels = { new: "새 카드", learning: "학습 중", known: "암기 완료" };

export default function NotesCardsPage({ assets, onDelete, onUpdate, onDeleteFolder, onGenerateFromWrong, busy, initialFocus }) {
  const [tab, setTab] = useState("notes");
  const [flipped, setFlipped] = useState({});
  const [root, setRoot] = useState("전체");
  const [folder, setFolder] = useState("전체");
  const [focusedId, setFocusedId] = useState("");
  const [editing, setEditing] = useState(null);
  const [masteryFilter, setMasteryFilter] = useState("all");
  const [session, setSession] = useState(null);
  const all = useMemo(() => tab === "notes" ? assets.notes || [] : assets.cards || [], [tab, assets]);
  const rootItems = useMemo(() => all.filter((item) => root === "전체" || sourceGroup(item).root === root), [all, root]);
  const folders = useMemo(() => [...new Set(rootItems.map((item) => sourceGroup(item).folder))], [rootItems]);
  const folderItems = useMemo(() => rootItems.filter((item) => folder === "전체" || sourceGroup(item).folder === folder), [rootItems, folder]);
  const items = useMemo(() => tab === "cards" ? filterCardsByMastery(folderItems, masteryFilter) : folderItems, [folderItems, masteryFilter, tab]);
  const counts = useMemo(() => ({ CBT: all.filter((item) => sourceGroup(item).root === "CBT").length, PDF: all.filter((item) => sourceGroup(item).root === "PDF").length }), [all]);
  const masteryCounts = useMemo(() => ({
    all: folderItems.length,
    new: folderItems.filter((item) => cardMastery(item) === "new").length,
    learning: folderItems.filter((item) => cardMastery(item) === "learning").length,
    known: folderItems.filter((item) => cardMastery(item) === "known").length,
  }), [folderItems]);
  const currentCard = session?.cards?.[session.index] || null;
  const quizChoices = useMemo(() => currentCard && session?.mode === "quiz" ? buildQuizChoices(currentCard, session.cards) : [], [currentCard, session?.cards, session?.mode]);

  useEffect(() => {
    if (!initialFocus?.id) return undefined;
    const collection = initialFocus.type === "cards" ? assets.cards || [] : assets.notes || [];
    const item = collection.find((entry) => entry.id === initialFocus.id);
    if (!item) return undefined;
    const group = sourceGroup(item);
    setTab(initialFocus.type === "cards" ? "cards" : "notes");
    setRoot(group.root); setFolder(group.folder); setMasteryFilter("all"); setFocusedId(item.id);
    const timer = setTimeout(() => document.getElementById(`study-asset-${item.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
    const clear = setTimeout(() => setFocusedId(""), 2600);
    return () => { clearTimeout(timer); clearTimeout(clear); };
  }, [initialFocus, assets.cards, assets.notes]);

  useEffect(() => {
    if (!session || session.finished || session.mode !== "study") return undefined;
    const handleKeydown = (event) => {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      if (event.code === "Space") { event.preventDefault(); setSession((value) => ({ ...value, flipped: !value.flipped })); }
      if (event.key === "ArrowLeft") moveSession(-1);
      if (event.key === "ArrowRight") moveSession(1);
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [session]);

  function startEdit(type, item) {
    setEditing(type === "notes"
      ? { type, id: item.id, title: item.title || "", summary: item.summary || "", details: item.details || "", keyPoints: (item.keyPoints || []).join("\n") }
      : { type, id: item.id, front: item.front || "", back: item.back || "" });
  }

  function saveEdit() {
    if (!editing) return;
    const patch = editing.type === "notes"
      ? { title: editing.title.trim(), summary: editing.summary.trim(), details: editing.details.trim(), keyPoints: editing.keyPoints.split("\n").map((item) => item.trim()).filter(Boolean) }
      : { front: editing.front.trim(), back: editing.back.trim() };
    onUpdate?.(editing.type, editing.id, patch);
    setEditing(null);
  }

  function removeFolder() {
    if (!window.confirm(`‘${folder}’에서 만든 AI 노트와 개념카드를 모두 삭제할까요?`)) return;
    onDeleteFolder?.(root, folder);
    setFolder("전체");
  }

  function startStudy(mode) {
    if (!items.length) return;
    if (mode === "quiz" && items.length < 2) { window.alert("선택 퀴즈는 카드가 2개 이상 필요합니다."); return; }
    setSession({ mode, cards: shuffleCards(items), index: 0, flipped: false, answered: "", correct: 0, wrong: 0, finished: false });
  }

  function updateCurrent(result) {
    if (!currentCard) return;
    const patch = applyCardResult(currentCard, result);
    onUpdate?.("cards", currentCard.id, patch);
    setSession((value) => ({ ...value, cards: value.cards.map((card) => card.id === currentCard.id ? { ...card, ...patch } : card) }));
  }

  function moveSession(amount = 1) {
    setSession((value) => {
      if (!value) return value;
      const nextIndex = Math.max(0, Math.min(value.cards.length - 1, value.index + amount));
      return { ...value, index: nextIndex, flipped: false, answered: "" };
    });
  }

  function finishOrNext() {
    setSession((value) => value.index >= value.cards.length - 1
      ? { ...value, finished: true }
      : { ...value, index: value.index + 1, flipped: false, answered: "" });
  }

  function gradeStudy(result) {
    updateCurrent(result);
    setSession((value) => ({ ...value, correct: value.correct + (result === "known" ? 1 : 0), wrong: value.wrong + (result === "known" ? 0 : 1) }));
    finishOrNext();
  }

  function answerQuiz(choice) {
    if (session.answered) return;
    const correct = choice === currentCard.back;
    updateCurrent(correct ? "correct" : "again");
    setSession((value) => ({ ...value, answered: choice, correct: value.correct + (correct ? 1 : 0), wrong: value.wrong + (correct ? 0 : 1) }));
  }

  function resetFilters(nextTab) {
    setTab(nextTab); setRoot("전체"); setFolder("전체"); setMasteryFilter("all");
  }

  return <main className="page-shell">
    <section className="page-title"><div><span className="eyebrow">AI STUDY ASSETS</span><h1>AI 노트 · 개념카드</h1><p>자료별 핵심을 확인하고, 카드 학습과 퀴즈로 기억 상태를 점검하세요.</p></div><button className="primary" disabled={busy} onClick={onGenerateFromWrong}>{busy ? "AI 생성 중…" : "현재 CBT 오답으로 생성"}</button></section>
    <div className="tab-switch"><button className={tab === "notes" ? "active" : ""} onClick={() => resetFilters("notes")}>AI 노트 {assets.notes?.length || 0}</button><button className={tab === "cards" ? "active" : ""} onClick={() => resetFilters("cards")}>개념카드 {assets.cards?.length || 0}</button></div>
    <section className="asset-folder-layout">
      <aside className="panel asset-folder-sidebar"><strong>자료 폴더</strong>{["전체", "CBT", "PDF"].map((value) => <button key={value} className={root === value ? "active" : ""} onClick={() => { setRoot(value); setFolder("전체"); }}>{value}<span>{value === "전체" ? all.length : counts[value]}</span></button>)}{root !== "전체" && <><div className="folder-divider"/><small>{root} 세부 폴더</small><button className={folder === "전체" ? "active" : ""} onClick={() => setFolder("전체")}>전체 보기<span>{rootItems.length}</span></button>{folders.map((value) => <button key={value} className={folder === value ? "active" : ""} onClick={() => setFolder(value)}>📁 {value}<span>{rootItems.filter((item) => sourceGroup(item).folder === value).length}</span></button>)}</>}</aside>
      <div>
        {root === "전체" && <section className="folder-overview">{["CBT", "PDF"].map((value) => <button key={value} className="panel folder-tile" onClick={() => { setRoot(value); setFolder("전체"); }}><b>📁</b><strong>{value} 학습자료</strong><span>{counts[value]}개</span></button>)}</section>}
        {root === "PDF" && folder !== "전체" && <div className="asset-folder-toolbar"><strong>{folder}</strong><button className="danger-text" onClick={removeFolder}>이 PDF 학습자료 전체 삭제</button></div>}
        {tab === "cards" && <section className="classcard-toolbar panel">
          <div><span>현재 카드 묶음</span><strong>{folder === "전체" ? `${root} 전체` : folder}</strong><small>새 카드 {masteryCounts.new} · 학습 중 {masteryCounts.learning} · 암기 완료 {masteryCounts.known}</small></div>
          <div className="classcard-actions"><button className="secondary" disabled={!items.length} onClick={() => startStudy("quiz")}>선택 퀴즈</button><button className="primary" disabled={!items.length} onClick={() => startStudy("study")}>카드 학습 시작</button></div>
          <nav aria-label="암기 상태 필터">{[["all", "전체"], ["new", "새 카드"], ["learning", "학습 중"], ["known", "암기 완료"]].map(([value, label]) => <button key={value} className={masteryFilter === value ? "active" : ""} onClick={() => setMasteryFilter(value)}>{label}<b>{masteryCounts[value]}</b></button>)}</nav>
        </section>}
        {tab === "notes" ? <section className="note-grid">{items.map((note) => <article id={`study-asset-${note.id}`} className={`panel ai-note-card ${focusedId === note.id ? "asset-focus-highlight" : ""}`} key={note.id}><span className="result-type">{sourceGroup(note).root} · {note.sourceType || "학습 자료"}</span><h3>{note.title}</h3><p>{note.summary}</p>{note.details && <p className="pdf-note-details">{note.details}</p>}<ul>{(note.keyPoints || []).map((point, index) => <li key={index}>{point}</li>)}</ul><small>📁 {sourceGroup(note).folder}{note.pageStart ? ` · ${note.pageStart}${note.pageEnd && note.pageEnd !== note.pageStart ? `~${note.pageEnd}` : ""}쪽` : ""}</small><div className="asset-card-actions"><button className="text-button" onClick={() => startEdit("notes", note)}>수정</button><button className="text-button danger-text" onClick={() => onDelete("notes", note.id)}>삭제</button></div></article>)}{!items.length && <div className="empty-state">이 폴더에는 아직 AI 노트가 없어요.</div>}</section>
          : <section className="flashcard-grid classcard-grid">{items.map((card) => { const mastery = cardMastery(card); return <article id={`study-asset-${card.id}`} className={`${flipped[card.id] ? "flashcard flipped" : "flashcard"} ${focusedId === card.id ? "asset-focus-highlight" : ""}`} key={card.id}><span className={`card-mastery ${mastery}`}>{masteryLabels[mastery]}</span><button className="flashcard-flip" onClick={() => setFlipped((value) => ({ ...value, [card.id]: !value[card.id] }))}><span>{flipped[card.id] ? "개념 설명" : "핵심 질문"}</span><strong>{flipped[card.id] ? card.back : card.front}</strong><small>📁 {sourceGroup(card).folder} · 눌러서 뒤집기</small></button><div className="card-study-meta"><span>학습 {Number(card.studyCount || 0)}회</span><span>정답 {Number(card.correctCount || 0)}회</span></div><div className="asset-card-actions"><button className="text-button" onClick={() => startEdit("cards", card)}>수정</button><button className="text-button danger-text" onClick={() => onDelete("cards", card.id)}>삭제</button></div></article>; })}{!items.length && <div className="empty-state">이 상태의 개념카드가 없어요.</div>}</section>}
      </div>
    </section>

    {session && <div className="modal-backdrop classcard-backdrop"><section className="modal classcard-session" role="dialog" aria-modal="true" aria-labelledby="classcard-session-title"><header><div><span>{session.mode === "study" ? "카드 학습" : "선택 퀴즈"}</span><strong id="classcard-session-title">{session.finished ? "학습 완료" : `${session.index + 1} / ${session.cards.length}`}</strong></div><button onClick={() => setSession(null)} aria-label="학습 종료">×</button></header><div className="classcard-progress"><i style={{ width: `${session.finished ? 100 : ((session.index + 1) / session.cards.length) * 100}%` }}/></div>
      {session.finished ? <div className="classcard-finish"><span>오늘의 카드 학습</span><h2>{session.cards.length}장 완료</h2><div><article><strong>{session.correct}</strong><small>{session.mode === "study" ? "알아요" : "정답"}</small></article><article><strong>{session.wrong}</strong><small>{session.mode === "study" ? "다시 보기" : "오답"}</small></article></div><button className="primary" onClick={() => setSession(null)}>카드 목록으로</button></div> : session.mode === "study" ? <>
        <button className={`classcard-stage ${session.flipped ? "flipped" : ""}`} onClick={() => setSession((value) => ({ ...value, flipped: !value.flipped }))}><span>{session.flipped ? "개념 설명" : "핵심 질문"}</span><strong>{session.flipped ? currentCard.back : currentCard.front}</strong><small>{session.flipped ? "아래에서 기억 상태를 선택하세요" : "눌러서 답 확인 · Space"}</small></button>
        <footer className="classcard-session-actions"><button className="secondary" disabled={session.index === 0} onClick={() => moveSession(-1)}>이전</button>{session.flipped ? <><button className="classcard-again" onClick={() => gradeStudy("again")}>다시 보기</button><button className="classcard-known" onClick={() => gradeStudy("known")}>알고 있어요</button></> : <button className="primary" onClick={() => setSession((value) => ({ ...value, flipped: true }))}>답 확인</button>}<button className="secondary" disabled={session.index === session.cards.length - 1} onClick={() => moveSession(1)}>다음</button></footer>
      </> : <div className="classcard-quiz"><span>알맞은 설명을 고르세요.</span><h2>{currentCard.front}</h2><div>{quizChoices.map((choice) => { const answered = Boolean(session.answered); const correct = choice === currentCard.back; const selected = choice === session.answered; return <button key={choice} className={answered ? correct ? "correct" : selected ? "wrong" : "" : ""} onClick={() => answerQuiz(choice)} disabled={answered}>{choice}</button>; })}</div>{session.answered && <div className={`classcard-feedback ${session.answered === currentCard.back ? "correct" : "wrong"}`}><strong>{session.answered === currentCard.back ? "정답이에요" : "다시 확인해 보세요"}</strong><p>{currentCard.back}</p><button className="primary" onClick={finishOrNext}>{session.index === session.cards.length - 1 ? "결과 보기" : "다음 문제"}</button></div>}</div>}
    </section></div>}

    {editing && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setEditing(null)}><section className="modal asset-edit-modal" role="dialog" aria-modal="true"><button className="modal-close" onClick={() => setEditing(null)} aria-label="닫기">×</button><span className="eyebrow">EDIT</span><h2>{editing.type === "notes" ? "AI 노트 수정" : "개념카드 수정"}</h2>{editing.type === "notes" ? <><label>제목<input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })}/></label><label>요약<textarea value={editing.summary} onChange={(event) => setEditing({ ...editing, summary: event.target.value })}/></label><label>상세 내용<textarea value={editing.details} onChange={(event) => setEditing({ ...editing, details: event.target.value })}/></label><label>핵심 개념 · 한 줄에 하나<textarea value={editing.keyPoints} onChange={(event) => setEditing({ ...editing, keyPoints: event.target.value })}/></label></> : <><label>앞면<input value={editing.front} onChange={(event) => setEditing({ ...editing, front: event.target.value })}/></label><label>뒷면<textarea value={editing.back} onChange={(event) => setEditing({ ...editing, back: event.target.value })}/></label></>}<div className="asset-edit-actions"><button className="secondary" onClick={() => setEditing(null)}>취소</button><button className="primary" onClick={saveEdit}>저장</button></div></section></div>}
  </main>;
}
