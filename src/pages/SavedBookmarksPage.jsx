import { useMemo, useState } from "react";
import { circled } from "../utils/exam";

export default function SavedBookmarksPage({ certificate, bookmarks = [], onStart, onRemove, onNavigate }) {
  const [subject, setSubject] = useState("전체");
  const subjects = useMemo(
    () => ["전체", ...new Set(bookmarks.map((item) => String(item.subject || "공통").trim() || "공통"))],
    [bookmarks],
  );
  const filtered = useMemo(
    () => bookmarks.filter((item) => subject === "전체" || (String(item.subject || "공통").trim() || "공통") === subject),
    [bookmarks, subject],
  );

  function start(items) {
    const questions = items.map((item, index) => ({ ...item, questionNumber: index + 1 }));
    if (!questions.length) return;
    onStart?.(questions, {
      id: `bookmarked-${certificate?.id || "general"}-${Date.now()}`,
      title: `${certificate?.name || "자격증"} · 북마크 문제`,
      durationMinutes: Math.max(1, questions.length),
      hasSubjectCutoff: false,
      assessmentType: "practice",
      studyScope: "saved-bookmark",
      learningType: "bookmarkPractice",
      returnPage: "saved",
      questionCount: questions.length,
      certificateId: certificate?.id || "",
      certificateName: certificate?.name || "",
    });
  }

  return <main className="cbt-learning-layout">
    <aside className="cbt-side-menu">
      <button onClick={() => onNavigate?.("past")}>기출문제 학습</button>
      <button onClick={() => onNavigate?.("subject")}>과목별 학습</button>
      <button onClick={() => onNavigate?.("all")}>전체 문제</button>
      <button className="active" aria-current="page" disabled>북마크</button>
    </aside>

    <section className="cbt-learning-content saved-bookmarks-page">
      <div className="topic-result-heading">
        <div>
          <span className="eyebrow">SAVED QUESTIONS</span>
          <h1>북마크한 문제</h1>
          <p>문제를 풀며 저장한 항목만 따로 모았습니다.</p>
        </div>
        <span>{bookmarks.length.toLocaleString()}문제</span>
      </div>

      {!!bookmarks.length && <div className="wrong-note-toolbar panel bookmark-toolbar">
        <div>
          <small className="toolbar-label">과목</small>
          <div className="wrong-note-filter">{subjects.map((value) => <button key={value} className={subject === value ? "active" : ""} onClick={() => setSubject(value)}>{value}</button>)}</div>
        </div>
        <button className="primary" disabled={!filtered.length} onClick={() => start(filtered)}>현재 목록 풀기</button>
      </div>}

      <section className="review-list bookmark-only-list">
        {filtered.map((item, index) => <article className="wrong-note-card detailed-cbt-wrong" key={`${item.id || item.questionNumber || "q"}-${index}`}>
          <div className="wrong-card-top">
            <div><span className="content-source-chip cbt-source-chip">북마크</span><strong>{item.subject || "공통"}</strong><small>{item.examTitle || item.sourceName || "CBT 문제"}</small></div>
            <div className="bookmark-card-actions"><button className="secondary" onClick={() => start([item])}>이 문제 풀기</button><button className="danger-button" onClick={() => onRemove?.(item)}>삭제</button></div>
          </div>
          <h3>{item.question || "이미지 문제"}</h3>
          <details><summary>문제 미리보기</summary>{(item.questionImageUrls?.length ? item.questionImageUrls : (item.imageUrl ? [item.imageUrl] : [])).map((url, imageIndex) => <img className="question-image" src={url} alt="문제 자료" key={url + imageIndex}/>)}<ol className="wrong-choice-detail">{(item.choices || []).map((choice, choiceIndex) => <li className={choiceIndex === item.answerIndex ? "correct-line" : ""} key={choiceIndex}>{circled[choiceIndex]} {choice}</li>)}</ol></details>
        </article>)}
        {!filtered.length && <div className="empty-state">아직 북마크한 문제가 없습니다. CBT 문제의 ‘북마크’를 누르면 여기에 저장됩니다.</div>}
      </section>
    </section>
  </main>;
}
