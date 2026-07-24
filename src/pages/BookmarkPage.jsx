import { useMemo, useState } from "react";
import { buildWrongNoteAnalysis, circled } from "../utils/exam";

export default function BookmarkPage({ wrongNotes, history, certificateName, onStartRecommended, onStartWrongReview }) {
  const analysis = useMemo(() => buildWrongNoteAnalysis(wrongNotes, history), [wrongNotes, history]);
  const [subject, setSubject] = useState("전체");
  const [selected, setSelected] = useState([]);

  const subjects = useMemo(
    () => ["전체", ...new Set(wrongNotes.map((item) => item.subject || "공통"))],
    [wrongNotes],
  );
  const filtered = useMemo(
    () => wrongNotes.filter((item) => subject === "전체" || (item.subject || "공통") === subject),
    [wrongNotes, subject],
  );
  const keyOf = (item, index) => `cbt:${item.examId || "exam"}:${item.id || item.questionNumber || index}:${item.createdAt || index}`;
  const selectedItems = filtered.filter((item, index) => selected.includes(keyOf(item, index)));
  const toggle = (key) => setSelected((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);

  return <main className="page-shell cbt-only-page">
    <div className="page-heading cbt-page-heading">
      <div className="learning-type-badge cbt-badge">자격증 CBT</div>
      <span className="eyebrow">CBT WRONG NOTE</span>
      <h1>{certificateName || "자격증"} CBT 오답노트</h1>
      <p>현재 선택한 자격증의 CBT 오답을 과목별로 정리하고 다시 풀 수 있습니다.</p>
    </div>

    <section className="ai-wrong-summary panel">
      <div><span className="eyebrow">AI CBT ANALYSIS</span><h2>{analysis.headline}</h2><p>{analysis.summary}</p></div>
      <div className="recommendation-list">{analysis.recommendations.map((item) => <article key={item.title}><span>우선순위 {item.priority}</span><strong>{item.title}</strong><small>{item.detail}</small><button className="secondary" onClick={() => onStartRecommended?.(item.title.replace(" 취약문제 복습", ""), item.count)}>추천 CBT 풀기</button></article>)}</div>
    </section>

    <section className="cbt-wrong-overview">
      <article className="panel"><strong>{wrongNotes.length}</strong><span>전체 CBT 오답</span></article>
      <article className="panel"><strong>{filtered.length}</strong><span>현재 과목 오답</span></article>
      <article className="panel"><strong>{Math.max(0, subjects.length - 1)}</strong><span>오답이 있는 과목</span></article>
    </section>

    <div className="wrong-note-toolbar panel">
      <div>
        <small className="toolbar-label">CBT 과목 선택</small>
        <div className="wrong-note-filter">{subjects.map((value) => <button className={subject === value ? "active" : ""} onClick={() => { setSubject(value); setSelected([]); }} key={value}>{value}</button>)}</div>
      </div>
      <div className="wrong-note-actions"><span>{selected.length}개 선택</span><button className="secondary" disabled={!selectedItems.length} onClick={() => onStartWrongReview?.(selectedItems)}>선택 CBT 다시 풀기</button><button className="primary" disabled={!filtered.length} onClick={() => onStartWrongReview?.(filtered)}>현재 과목 전체 풀기</button></div>
    </div>

    <section className="review-list">{filtered.map((item, index) => {
      const key = keyOf(item, index);
      return <article className="wrong-note-card detailed-cbt-wrong" key={key}>
        <div className="wrong-card-top"><label className="wrong-select"><input type="checkbox" checked={selected.includes(key)} onChange={() => toggle(key)}/> 선택</label><div><span className="content-source-chip cbt-source-chip">CBT</span><strong>{item.subject || "공통"}</strong><small>틀린 문제</small></div><button className="secondary" onClick={() => onStartWrongReview?.([item])}>다시 풀기</button></div>
        <h3>{item.question}</h3>
        <p>내 답: {item.selectedAnswerIndex == null ? "미응답" : circled[item.selectedAnswerIndex]} · 정답: {circled[item.answerIndex]}</p>
        <details><summary>문제 자세히 보기</summary>{(item.questionImageUrls?.length ? item.questionImageUrls : (item.imageUrl ? [item.imageUrl] : [])).map((url, imageIndex) => <img className="question-image" src={url} alt="문제 자료" key={url + imageIndex}/>)}<ol className="wrong-choice-detail">{(item.choices || []).map((choice, choiceIndex) => <li className={choiceIndex === item.answerIndex ? "correct-line" : ""} key={choiceIndex}>{circled[choiceIndex]} {choice}</li>)}</ol><div className="wrong-explanation"><strong>해설</strong><p>{item.explanation || "등록된 해설이 없습니다."}</p></div></details>
      </article>;
    })}{!filtered.length && <div className="empty-state">이 과목에 저장된 CBT 오답이 없습니다.</div>}</section>
  </main>;
}
