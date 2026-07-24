import AnswerSheet from "../components/AnswerSheet";
import { circled, formatTime } from "../utils/exam";

export default function ExamPage({ session, onExit }) {
  const {
    questions,
    exam,
    mode,
    answers,
    bookmarks,
    reviewChecks,
    current,
    submitted,
    remaining,
    result,
  } = session;

  const q = questions[current];
  if (!q) return null;

  const isPracticeAssessment = result.assessmentType === "practice";
  const practiceAnswered = mode === "연습모드" && answers[current] !== undefined;
  const revealCurrent = submitted || practiceAnswered;
  const isFirst = current === 0;
  const isLast = current === questions.length - 1;

  function moveTo(index) {
    session.setCurrent(Math.max(0, Math.min(questions.length - 1, index)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function choiceClass(index) {
    const selected = answers[current] === index;
    if (!revealCurrent) return selected ? "selected" : "";
    if (index === q.answerIndex) return "correct";
    if (selected && index !== q.answerIndex) return "wrong";
    return "";
  }

  return (
    <main className="exam-page qnet-exam-layout">
      <section className="exam-main">
        <header className="exam-toolbar qnet-toolbar">
          <div className="exam-title-block">
            <strong>{exam?.title || "맞춤 모의고사"}</strong>
            <span>{mode}</span>
          </div>
          <div className="question-progress">
            <span>현재 문제</span>
            <strong>{current + 1}</strong>
            <small>/ {questions.length}</small>
          </div>
          {mode === "실전모드" ? (
            <div className="timer-block"><span>남은 시간</span><strong>{formatTime(remaining)}</strong></div>
          ) : (
            <div className="timer-block"><span>풀이 상태</span><strong>{answers[current] !== undefined ? "응답 완료" : "미응답"}</strong></div>
          )}
        </header>

        {submitted && (
          <section className={`result-banner ${isPracticeAssessment ? "practice" : result.passed ? "pass" : "fail"}`}>
            <div><strong>{result.score}점</strong><span>{result.correct}/{result.total} 정답</span></div>
            <div className="result-status"><strong>{result.resultLabel}</strong><span>{isPracticeAssessment ? "합격·불합격 판정 없이 이해한 내용을 확인하는 학습 결과입니다." : `평균 ${result.passScore}점 이상${result.cutoffEnabled ? ` · 과목별 ${result.cutoffScore}점 이상` : ""}`}</span></div>
          </section>
        )}

        {submitted && !isPracticeAssessment && result.cutoffEnabled && (
          <section className="subject-result-grid">
            {result.subjects.map((subject) => (
              <article className={subject.score < result.cutoffScore ? "cutoff-failed" : ""} key={subject.subject}>
                <span>{subject.subject}</span><strong>{subject.score}점</strong><small>{subject.correct}/{subject.total} 정답</small>
                {subject.score < result.cutoffScore && <em>과락</em>}
              </article>
            ))}
          </section>
        )}

        <article className="question-focus qnet-question-card">
          <div className="question-meta qnet-question-meta">
            <div className="question-number-badge">문제 {q.questionNumber || current + 1}</div>
            <em>{q.subject}</em>
            <div className="question-actions">
              <button
                type="button"
                className={reviewChecks[current] ? "review-active" : ""}
                onClick={() => session.toggleReviewCheck(current)}
              >
                {reviewChecks[current] ? "✓ 검토 체크됨" : "□ 검토 체크"}
              </button>
              <button type="button" onClick={() => session.toggleBookmark(current)}>{bookmarks[current] ? "★ 저장됨" : "☆ 북마크"}</button>
            </div>
          </div>

          <h2>{q.question}</h2>
          {(q.questionImageUrls?.length ? q.questionImageUrls : q.imageUrl ? [q.imageUrl] : []).map((url) => (
            <img className="question-image" src={url} alt="문제 자료" key={url} />
          ))}

          <div className="choice-list qnet-choice-list">
            {q.choices.map((choice, index) => (
              <button
                type="button"
                key={index}
                className={choiceClass(index)}
                onClick={() => session.answer(current, index)}
                disabled={submitted || practiceAnswered}
              >
                <span className="choice-number">{circled[index]}</span>
                <span>{q.choiceImageUrls?.[index] && <img src={q.choiceImageUrls[index]} alt={`${index + 1}번 보기`} />}{choice}</span>
              </button>
            ))}
          </div>

          {revealCurrent && (
            <div className={`practice-feedback ${answers[current] === q.answerIndex ? "is-correct" : "is-wrong"}`}>
              <strong>{answers[current] === q.answerIndex ? "정답입니다." : `오답입니다. 정답은 ${circled[q.answerIndex]}입니다.`}</strong>
            </div>
          )}
          {revealCurrent && <div className="explanation"><strong>정답 {circled[q.answerIndex]}</strong><p>{q.explanation || "등록된 해설이 없습니다."}</p></div>}
        </article>

        <footer className="exam-navigation-bar">
          <button type="button" className="nav-move" onClick={() => moveTo(current - 1)} disabled={isFirst}>← 이전 문제</button>
          <div className="exam-navigation-center">
            <button type="button" className="secondary" onClick={onExit}>나가기</button>
            {submitted
              ? <button type="button" className="primary" onClick={onExit}>결과 저장 후 종료</button>
               : <button type="button" className="primary" onClick={session.submit}>{isPracticeAssessment ? "학습 결과 확인" : "시험 제출"}</button>}
          </div>
          <button type="button" className="nav-move" onClick={() => moveTo(current + 1)} disabled={isLast}>다음 문제 →</button>
        </footer>
      </section>

      <AnswerSheet
        questions={questions}
        answers={answers}
        bookmarks={bookmarks}
        reviewChecks={reviewChecks}
        current={current}
        onMove={moveTo}
        onAnswer={session.answer}
        onToggleReviewCheck={session.toggleReviewCheck}
        revealAnswers={submitted || mode === "연습모드"}
      />
    </main>
  );
}
