import { useEffect, useMemo, useState } from "react";

function sourceGroup(item) {
  const type = String(item.sourceType || "").toLowerCase();
  if (type.includes("pdf")) return { root: "PDF", folder: item.sourceName || "PDF 자료" };
  return { root: "CBT", folder: item.certificateName || item.sourceName || "CBT 학습" };
}

export default function NotesCardsPage({ assets, onDelete, onUpdate, onDeleteFolder, onGenerateFromWrong, busy, initialFocus }) {
  const [tab, setTab] = useState("notes");
  const [flipped, setFlipped] = useState({});
  const [root, setRoot] = useState("전체");
  const [folder, setFolder] = useState("전체");
  const [focusedId, setFocusedId] = useState("");
  const [editing, setEditing] = useState(null);
  const all = useMemo(() => tab === "notes" ? assets.notes || [] : assets.cards || [], [tab, assets]);
  const folders = useMemo(() => [...new Set(all.filter((item) => root === "전체" || sourceGroup(item).root === root).map((item) => sourceGroup(item).folder))], [all, root]);
  const items = useMemo(() => all.filter((item) => { const group = sourceGroup(item); return (root === "전체" || group.root === root) && (folder === "전체" || group.folder === folder); }), [all, root, folder]);
  const counts = useMemo(() => ({ CBT: all.filter((item) => sourceGroup(item).root === "CBT").length, PDF: all.filter((item) => sourceGroup(item).root === "PDF").length }), [all]);

  useEffect(() => {
    if (!initialFocus?.id) return undefined;
    const collection = initialFocus.type === "cards" ? assets.cards || [] : assets.notes || [];
    const item = collection.find((entry) => entry.id === initialFocus.id);
    if (!item) return undefined;
    const group = sourceGroup(item);
    setTab(initialFocus.type === "cards" ? "cards" : "notes");
    setRoot(group.root); setFolder(group.folder); setFocusedId(item.id);
    const timer = setTimeout(() => document.getElementById(`study-asset-${item.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
    const clear = setTimeout(() => setFocusedId(""), 2600);
    return () => { clearTimeout(timer); clearTimeout(clear); };
  }, [initialFocus, assets.cards, assets.notes]);

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

  return <main className="page-shell">
    <section className="page-title"><div><span className="eyebrow">AI STUDY ASSETS</span><h1>AI 노트 · 개념카드</h1><p>CBT 과목과 PDF 파일별로 정리된 AI 노트와 개념카드를 확인하고 직접 수정하세요.</p></div><button className="primary" disabled={busy} onClick={onGenerateFromWrong}>{busy ? "AI 생성 중…" : "현재 CBT 오답으로 생성"}</button></section>
    <div className="tab-switch"><button className={tab === "notes" ? "active" : ""} onClick={() => { setTab("notes"); setRoot("전체"); setFolder("전체"); }}>AI 노트 {assets.notes?.length || 0}</button><button className={tab === "cards" ? "active" : ""} onClick={() => { setTab("cards"); setRoot("전체"); setFolder("전체"); }}>개념카드 {assets.cards?.length || 0}</button></div>
    <section className="asset-folder-layout">
      <aside className="panel asset-folder-sidebar"><strong>자료 폴더</strong>{["전체", "CBT", "PDF"].map((value) => <button key={value} className={root === value ? "active" : ""} onClick={() => { setRoot(value); setFolder("전체"); }}>{value}<span>{value === "전체" ? all.length : counts[value]}</span></button>)}{root !== "전체" && <><div className="folder-divider"/><small>{root} 세부 폴더</small><button className={folder === "전체" ? "active" : ""} onClick={() => setFolder("전체")}>전체 보기<span>{all.filter((item) => sourceGroup(item).root === root).length}</span></button>{folders.map((value) => <button key={value} className={folder === value ? "active" : ""} onClick={() => setFolder(value)}>📁 {value}<span>{all.filter((item) => sourceGroup(item).root === root && sourceGroup(item).folder === value).length}</span></button>)}</>}</aside>
      <div>
        {root === "전체" && <section className="folder-overview">{["CBT", "PDF"].map((value) => <button key={value} className="panel folder-tile" onClick={() => { setRoot(value); setFolder("전체"); }}><b>📁</b><strong>{value} 학습자료</strong><span>{counts[value]}개</span></button>)}</section>}
        {root === "PDF" && folder !== "전체" && <div className="asset-folder-toolbar"><strong>{folder}</strong><button className="danger-text" onClick={removeFolder}>이 PDF 학습자료 전체 삭제</button></div>}
        {tab === "notes" ? <section className="note-grid">{items.map((note) => <article id={`study-asset-${note.id}`} className={`panel ai-note-card ${focusedId === note.id ? "asset-focus-highlight" : ""}`} key={note.id}><span className="result-type">{sourceGroup(note).root} · {note.sourceType || "학습 자료"}</span><h3>{note.title}</h3><p>{note.summary}</p>{note.details && <p className="pdf-note-details">{note.details}</p>}<ul>{(note.keyPoints || []).map((point, index) => <li key={index}>{point}</li>)}</ul><small>📁 {sourceGroup(note).folder}{note.pageStart ? ` · ${note.pageStart}${note.pageEnd && note.pageEnd !== note.pageStart ? `~${note.pageEnd}` : ""}쪽` : ""}</small><div className="asset-card-actions"><button className="text-button" onClick={() => startEdit("notes", note)}>수정</button><button className="text-button danger-text" onClick={() => onDelete("notes", note.id)}>삭제</button></div></article>)}{!items.length && <div className="empty-state">이 폴더에는 아직 AI 노트가 없어요.</div>}</section>
          : <section className="flashcard-grid">{items.map((card) => <article id={`study-asset-${card.id}`} className={`${flipped[card.id] ? "flashcard flipped" : "flashcard"} ${focusedId === card.id ? "asset-focus-highlight" : ""}`} key={card.id}><button className="flashcard-flip" onClick={() => setFlipped((value) => ({ ...value, [card.id]: !value[card.id] }))}><span>{flipped[card.id] ? "정답" : "질문"}</span><strong>{flipped[card.id] ? card.back : card.front}</strong><small>📁 {sourceGroup(card).folder} · 눌러서 뒤집기</small></button><div className="asset-card-actions"><button className="text-button" onClick={() => startEdit("cards", card)}>수정</button><button className="text-button danger-text" onClick={() => onDelete("cards", card.id)}>삭제</button></div></article>)}{!items.length && <div className="empty-state">이 폴더에는 아직 개념카드가 없어요.</div>}</section>}
      </div>
    </section>
    {editing && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setEditing(null)}><section className="modal asset-edit-modal" role="dialog" aria-modal="true"><button className="modal-close" onClick={() => setEditing(null)} aria-label="닫기">×</button><span className="eyebrow">EDIT</span><h2>{editing.type === "notes" ? "AI 노트 수정" : "개념카드 수정"}</h2>{editing.type === "notes" ? <><label>제목<input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })}/></label><label>요약<textarea value={editing.summary} onChange={(event) => setEditing({ ...editing, summary: event.target.value })}/></label><label>상세 내용<textarea value={editing.details} onChange={(event) => setEditing({ ...editing, details: event.target.value })}/></label><label>핵심 개념 · 한 줄에 하나<textarea value={editing.keyPoints} onChange={(event) => setEditing({ ...editing, keyPoints: event.target.value })}/></label></> : <><label>앞면<input value={editing.front} onChange={(event) => setEditing({ ...editing, front: event.target.value })}/></label><label>뒷면<textarea value={editing.back} onChange={(event) => setEditing({ ...editing, back: event.target.value })}/></label></>}<div className="asset-edit-actions"><button className="secondary" onClick={() => setEditing(null)}>취소</button><button className="primary" onClick={saveEdit}>저장</button></div></section></div>}
  </main>;
}
