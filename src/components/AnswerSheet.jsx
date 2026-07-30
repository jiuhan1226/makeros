import { useEffect, useMemo, useState } from "react";
import ExamScratchpad from "./ExamScratchpad";

const FILTERS = [
  { id: "all", label: "전체" },
  { id: "unanswered", label: "미응답" },
  { id: "checked", label: "체크" },
  { id: "bookmarked", label: "북마크" },
  { id: "answered", label: "완료" },
];

export default function AnswerSheet({
  questions,
  answers,
  bookmarks,
  reviewChecks,
  current,
  onMove,
  onAnswer,
  onToggleReviewCheck,
  revealAnswers = false,
}) {
  const [filter, setFilter] = useState("all");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [panelMode, setPanelMode] = useState("omr");

  const counts = useMemo(() => ({
    all: questions.length,
    unanswered: questions.filter((_, index) => answers[index] === undefined).length,
    checked: questions.filter((_, index) => reviewChecks[index]).length,
    bookmarked: questions.filter((_, index) => bookmarks[index]).length,
    answered: questions.filter((_, index) => answers[index] !== undefined).length,
  }), [answers, bookmarks, questions, reviewChecks]);

  const visibleIndexes = useMemo(() => questions
    .map((_, index) => index)
    .filter((index) => {
      if (filter === "unanswered") return answers[index] === undefined;
      if (filter === "checked") return Boolean(reviewChecks[index]);
      if (filter === "bookmarked") return Boolean(bookmarks[index]);
      if (filter === "answered") return answers[index] !== undefined;
      return true;
    }), [answers, bookmarks, filter, questions, reviewChecks]);

  useEffect(() => {
    document.body.classList.toggle("answer-sheet-open", mobileOpen);
    function handleKeydown(event) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", handleKeydown);
    return () => {
      document.body.classList.remove("answer-sheet-open");
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [mobileOpen]);

  function moveTo(index) {
    onMove(index);
    if (window.innerWidth <= 760) setMobileOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="answer-sheet-mobile-trigger"
        onClick={() => { setPanelMode("omr"); setMobileOpen(true); }}
        aria-expanded={mobileOpen}
        aria-controls="mobile-answer-sheet"
      >
        <span className="answer-sheet-trigger-icon" aria-hidden="true">▦</span>
        <span>OMR</span>
        <strong>{counts.answered}/{counts.all}</strong>
      </button>

      <button
        type="button"
        className={`answer-sheet-backdrop ${mobileOpen ? "visible" : ""}`}
        onClick={() => setMobileOpen(false)}
        aria-label="답안지 닫기"
      />

      <aside id="mobile-answer-sheet" className={`answer-sheet ${mobileOpen ? "mobile-open" : ""}`} aria-label="시험 보조 패널">
        <div className="answer-sheet-title">
          <div>
            <span>시험 보조 패널</span>
            <small>{counts.answered}문제 응답 · {counts.unanswered}문제 미응답</small>
          </div>
          <button type="button" className="answer-sheet-close" onClick={() => setMobileOpen(false)} aria-label="답안지 닫기">×</button>
        </div>

        <div className="answer-sheet-mode-tabs" role="tablist" aria-label="시험 보조 도구 선택">
          <button
            type="button"
            className={panelMode === "omr" ? "active" : ""}
            onClick={() => setPanelMode("omr")}
            role="tab"
            aria-selected={panelMode === "omr"}
          >
            <span aria-hidden="true">▦</span> OMR 답안지
          </button>
          <button
            type="button"
            className={panelMode === "note" ? "active" : ""}
            onClick={() => setPanelMode("note")}
            role="tab"
            aria-selected={panelMode === "note"}
          >
            <span aria-hidden="true">✎</span> 필기 노트
          </button>
        </div>

        {panelMode === "omr" ? (
          <>
            <div className="answer-sheet-scroll">
              {visibleIndexes.length === 0 ? (
                <div className="answer-sheet-empty">해당하는 문제가 없습니다.</div>
              ) : visibleIndexes.map((index) => {
                const question = questions[index];
                const answered = answers[index] !== undefined;
                const correct = answered && answers[index] === question.answerIndex;
                const choiceCount = Math.max(4, question.choices?.length || 4);

                return (
                  <div className={`answer-row ${current === index ? "current" : ""}`} key={index}>
                    <button
                      type="button"
                      className={`review-checkbox ${reviewChecks[index] ? "checked" : ""}`}
                      onClick={() => onToggleReviewCheck(index)}
                      aria-pressed={Boolean(reviewChecks[index])}
                      aria-label={`${index + 1}번 문제 검토 체크`}
                      title="나중에 다시 볼 문제로 직접 체크"
                    >
                      {reviewChecks[index] ? "✓" : ""}
                    </button>

                    <button type="button" className="answer-number" onClick={() => moveTo(index)}>
                      {String(index + 1).padStart(2, "0")}
                    </button>

                    <div className="answer-choices">
                      {Array.from({ length: choiceCount }, (_, choice) => {
                        const selected = answers[index] === choice;
                        const revealCorrect = revealAnswers && answered && choice === question.answerIndex;
                        const revealWrong = revealAnswers && selected && choice !== question.answerIndex;
                        return (
                          <button
                            type="button"
                            key={choice}
                            className={`${selected ? "selected" : ""} ${revealCorrect ? "correct" : ""} ${revealWrong ? "wrong" : ""}`}
                            onClick={() => onAnswer(index, choice)}
                            disabled={revealAnswers && answered}
                            aria-label={`${index + 1}번 문제 ${choice + 1}번 답 선택`}
                          >
                            {choice + 1}
                          </button>
                        );
                      })}
                    </div>

                    {bookmarks[index] && <span className="answer-bookmark" title="북마크됨">★</span>}
                    {revealAnswers && answered && (
                      <span className={`answer-result-dot ${correct ? "correct" : "wrong"}`} aria-label={correct ? "정답" : "오답"} />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="answer-filter-panel">
              <div className="answer-filter-tabs" role="tablist" aria-label="문제 상태별 보기">
                {FILTERS.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={filter === item.id ? "active" : ""}
                    onClick={() => setFilter(item.id)}
                    role="tab"
                    aria-selected={filter === item.id}
                  >
                    <span>{item.label}</span>
                    <strong>{counts[item.id]}</strong>
                  </button>
                ))}
              </div>

              {filter === "checked" && counts.checked > 0 && (
                <div className="checked-number-list" aria-label="체크한 문제 번호">
                  {questions.map((_, index) => reviewChecks[index] ? (
                    <button type="button" key={index} onClick={() => moveTo(index)}>{index + 1}</button>
                  ) : null)}
                </div>
              )}
            </div>
          </>
        ) : (
          <ExamScratchpad active={panelMode === "note"} />
        )}
      </aside>
    </>
  );
}
