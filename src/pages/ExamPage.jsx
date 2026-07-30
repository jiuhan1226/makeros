import { useEffect, useState } from "react";
import AnswerSheet from "../components/AnswerSheet";
import { circled, formatTime } from "../utils/exam";
import {
  explanationFingerprint,
  requestVerifiedCbtExplanation,
  submitExplanationFeedback,
} from "../utils/cbtExplanation";

function registeredExplanation(question) {
  const official = String(question?.explanation || "").trim();
  if (official) {
    return {
      status: "ready",
      source: "official",
      explanation: official,
      keyPoint: "",
      choiceReasons: [],
      label: "등록 해설",
    };
  }

  const embedded = String(question?.aiExplanation || "").trim();
  const embeddedAnswer = Number(question?.aiExplanationAnswerIndex);
  if (
    embedded
    && question?.aiExplanationStatus === "verified"
    && embeddedAnswer === Number(question?.answerIndex)
  ) {
    return {
      status: "ready",
      source: "ai",
      explanation: embedded,
      keyPoint: String(question?.aiExplanationKeyPoint || "").trim(),
      choiceReasons: Array.isArray(question?.aiExplanationChoiceReasons)
        ? question.aiExplanationChoiceReasons
        : [],
      label: "AI 해설 · 검증 완료",
      model: question?.aiExplanationModel || "",
    };
  }
  return null;
}

function resultToExplanationState(result) {
  if (result?.verified && result?.status === "verified") {
    return {
      status: "ready",
      source: "ai",
      explanation: result.explanation || "",
      keyPoint: result.keyPoint || "",
      choiceReasons: Array.isArray(result.choiceReasons) ? result.choiceReasons : [],
      label: result.cached
        ? "AI 해설 · 저장된 해설"
        : "AI 해설 · 정답 검증 완료",
      model: result.model || "",
      questionHash: result.questionHash || "",
      signature: result.signature || "",
      version: Number(result.version || 1),
      rawResult: result,
    };
  }

  if (result?.status === "unsupported_media") {
    return {
      status: "blocked",
      source: "ai",
      message: result.message || "이미지 내용까지 확인할 수 없어 자동 해설을 제공하지 않았어요.",
    };
  }

  return {
    status: "blocked",
    source: "ai",
    message: result?.message || "공식 정답과 일치하는지 확인하지 못해 해설을 표시하지 않았어요.",
    issues: Array.isArray(result?.issues) ? result.issues : [],
  };
}

export default function ExamPage({ session, onExit, onSaveConfidence, getDifficulty }) {
  const {
    questions,
    exam,
    mode,
    answers,
    bookmarks,
    reviewChecks,
    confidenceByQuestion = {},
    current,
    submitted,
    remaining,
    result,
  } = session;

  const [progressMessage, setProgressMessage] = useState("");
  const [savingConfidence, setSavingConfidence] = useState(false);
  const [explanationState, setExplanationState] = useState({ status: "idle" });
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);

  useEffect(() => {
    document.body.classList.add("makeros-exam-mode");
    return () => document.body.classList.remove("makeros-exam-mode");
  }, []);

  const q = questions[current];
  const isPracticeAssessment = result.assessmentType === "practice";
  const practiceAnswered = mode === "연습모드" && answers[current] !== undefined;
  const revealCurrent = submitted || practiceAnswered;
  const currentExplanationFingerprint = explanationFingerprint(q || {});
  const answeredCount = Object.values(answers).filter((value) => value !== undefined).length;
  const examContextLabel = [
    exam?.year ? `${exam.year}년` : "",
    exam?.round ? `${exam.round}회` : "",
  ].filter(Boolean).join(" · ");

  useEffect(() => {
    let alive = true;

    setFeedbackMessage("");
    if (!q || !revealCurrent) {
      setExplanationState({ status: "idle" });
      return () => { alive = false; };
    }

    const existing = registeredExplanation(q);
    if (existing) {
      setExplanationState(existing);
      return () => { alive = false; };
    }

    setExplanationState({
      status: "loading",
      message: "AI 해설을 1차 생성한 뒤 공식 정답과 다시 대조하고 있습니다.",
    });

    requestVerifiedCbtExplanation(q)
      .then((response) => {
        if (alive) setExplanationState(resultToExplanationState(response));
      })
      .catch((error) => {
        if (!alive) return;
        setExplanationState({
          status: "error",
          message: error?.message || "AI 해설을 생성하지 못했습니다.",
        });
      });

    return () => { alive = false; };
  }, [currentExplanationFingerprint, revealCurrent]);

  if (!q) return null;

  const isFirst = current === 0;
  const isLast = current === questions.length - 1;
  const difficulty = getDifficulty?.(q) || { id: "pending", label: "분석 중" };

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

  async function handleConfidence(confidence) {
    if (answers[current] === undefined) {
      setProgressMessage("먼저 답안을 선택해 주세요.");
      return;
    }

    const selectedAnswerIndex = Number(answers[current]);
    const isCorrect = selectedAnswerIndex === Number(q.answerIndex);
    const attemptId = `${session.startedAt || Date.now()}:${q.id || current}`;

    try {
      setSavingConfidence(true);
      setProgressMessage("");
      session.setConfidence(q.id, confidence);
      await onSaveConfidence?.({
        question: q,
        exam,
        mode,
        studyScope: exam?.studyScope,
        attemptId,
        selectedAnswerIndex,
        isCorrect,
        confidence,
      });
      const labels = { high: "확실함", medium: "애매함", low: "모름" };
      setProgressMessage(`${labels[confidence]}으로 저장했습니다. 복습 일정에 반영됩니다.`);
    } catch (error) {
      console.error("자기평가 저장 실패:", error);
      setProgressMessage(error?.message || "자기평가를 저장하지 못했습니다.");
    } finally {
      setSavingConfidence(false);
    }
  }

  async function sendExplanationFeedback(reason) {
    if (!q || explanationState.source !== "ai") return;
    try {
      setFeedbackBusy(true);
      setFeedbackMessage("");
      await submitExplanationFeedback({
        question: q,
        result: explanationState.rawResult || explanationState,
        reason,
      });
      const labels = {
        helpful: "도움이 됐다는 의견을 저장했습니다.",
        insufficient: "설명이 부족하다는 의견을 저장했습니다.",
        answer_conflict: "정답과 다른 부분을 검토 요청으로 보냈어요.",
        content_error: "내용 오류를 검토 요청으로 보냈어요.",
      };
      setFeedbackMessage(labels[reason] || "의견을 저장했습니다.");
    } catch (error) {
      setFeedbackMessage(error?.message || "의견을 저장하지 못했습니다.");
    } finally {
      setFeedbackBusy(false);
    }
  }

  function handleDeviceSubmit() {
    if (submitted) {
      onExit();
      return;
    }
    const shouldSubmit = window.confirm(
      `현재 ${answeredCount}/${questions.length}문제를 답했습니다. ${isPracticeAssessment ? "학습 결과를 확인할까요?" : "시험을 제출할까요?"}`,
    );
    if (shouldSubmit) session.submit();
  }

  async function retryExplanation() {
    setExplanationState({
      status: "loading",
      message: "AI 해설을 만들고 공식 정답과 대조하고 있어요.",
    });
    try {
      const response = await requestVerifiedCbtExplanation(q, { force: true });
      setExplanationState(resultToExplanationState(response));
    } catch (error) {
      setExplanationState({
        status: "error",
        message: error?.message || "AI 해설을 다시 생성하지 못했습니다.",
      });
    }
  }

  return (
    <main className="exam-page qnet-exam-layout">
      <header className="exam-device-header">
        <button type="button" className="exam-device-exit" onClick={onExit} aria-label="시험 나가기">←</button>
        <div className="exam-device-title">
          <strong>{exam?.certificateName || exam?.title || "CBT 학습"}</strong>
          <span>{examContextLabel || mode}</span>
        </div>
        <div className="exam-device-status">
          <div>
            <small>{mode === "실전모드" ? "남은 시간" : "풀이 현황"}</small>
            <strong>{mode === "실전모드" ? formatTime(remaining) : `${answeredCount}/${questions.length}`}</strong>
          </div>
          <button type="button" onClick={handleDeviceSubmit}>{submitted ? "종료" : isPracticeAssessment ? "결과" : "제출"}</button>
        </div>
      </header>

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
            <div>
              <strong>{result.score}점</strong>
              <span>{result.correct}/{result.total} 정답</span>
            </div>
            <div className="result-status">
              <strong>{result.resultLabel}</strong>
              <span>
                {isPracticeAssessment
                  ? `연습 결과는 답한 ${result.total}문제를 기준으로 계산했어요. 미응답 ${result.unanswered}문제는 점수에 포함되지 않아요.`
                  : `평균 ${result.passScore}점 이상${result.cutoffEnabled ? ` · 과목별 ${result.cutoffScore}점 이상` : ""}`}
              </span>
            </div>
          </section>
        )}

        {submitted && !isPracticeAssessment && result.cutoffEnabled && (
          <section className="subject-result-grid">
            {result.subjects.map((subject) => (
              <article className={subject.score < result.cutoffScore ? "cutoff-failed" : ""} key={subject.subject}>
                <span>{subject.subject}</span>
                <strong>{subject.score}점</strong>
                <small>{subject.correct}/{subject.total} 정답</small>
                {subject.score < result.cutoffScore && <em>과락</em>}
              </article>
            ))}
          </section>
        )}

        <article className="question-focus qnet-question-card">
          <div className="question-meta qnet-question-meta">
            <div className="question-number-badge">문제 {q.questionNumber || current + 1}</div>
            <em>{q.subject}</em>
            <span className={`question-difficulty difficulty-${difficulty.id}`}>난이도 {difficulty.label}</span>
            <div className="question-actions">
              <button
                type="button"
                className={reviewChecks[current] ? "review-active" : ""}
                onClick={() => session.toggleReviewCheck(current)}
              >
                {reviewChecks[current] ? "✓ 검토 체크됨" : "□ 검토 체크"}
              </button>
              <button type="button" onClick={() => session.toggleBookmark(current)}>
                {bookmarks[current] ? "★ 저장됨" : "☆ 북마크"}
              </button>
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
                <span>
                  {q.choiceImageUrls?.[index] && <img src={q.choiceImageUrls[index]} alt={`${index + 1}번 보기`} />}
                  {choice}
                </span>
              </button>
            ))}
          </div>

          {revealCurrent && (
            <>
              <div className={`practice-feedback ${answers[current] === q.answerIndex ? "is-correct" : "is-wrong"}`}>
                <strong>
                  {answers[current] === q.answerIndex
                    ? "정답입니다."
                    : `오답입니다. 정답은 ${circled[q.answerIndex]}입니다.`}
                </strong>
              </div>

              <section className="confidence-assessment">
                <div className="confidence-heading">
                  <div>
                    <strong>이 문제를 얼마나 이해했나요?</strong>
                    <p>자기평가를 남기면 이해도에 맞춰 다음 복습일을 정해드려요.</p>
                  </div>
                  {confidenceByQuestion[q.id] && <span className="confidence-completed">저장 완료</span>}
                </div>

                <div className="confidence-buttons">
                  <button
                    type="button"
                    className={`confidence-high ${confidenceByQuestion[q.id] === "high" ? "active" : ""}`}
                    onClick={() => handleConfidence("high")}
                    disabled={savingConfidence}
                  >
                    <strong>확실함</strong>
                    <span>개념과 풀이를 설명할 수 있어요</span>
                  </button>
                  <button
                    type="button"
                    className={`confidence-medium ${confidenceByQuestion[q.id] === "medium" ? "active" : ""}`}
                    onClick={() => handleConfidence("medium")}
                    disabled={savingConfidence}
                  >
                    <strong>애매함</strong>
                    <span>맞혔지만 일부 내용이 헷갈려요</span>
                  </button>
                  <button
                    type="button"
                    className={`confidence-low ${confidenceByQuestion[q.id] === "low" ? "active" : ""}`}
                    onClick={() => handleConfidence("low")}
                    disabled={savingConfidence}
                  >
                    <strong>모름</strong>
                    <span>찍었거나 개념을 다시 공부해야 해요</span>
                  </button>
                </div>

                {(savingConfidence || progressMessage) && (
                  <p className="confidence-message">
                    {savingConfidence ? "학습 기록을 저장하고 있습니다." : progressMessage}
                  </p>
                )}
              </section>

              <div className={`explanation ${explanationState.source === "ai" ? "ai-explanation" : ""}`}>
                <div className="explanation-title-row">
                  <strong>정답 {circled[q.answerIndex]}</strong>
                  {explanationState.label && <span>{explanationState.label}</span>}
                </div>

                {explanationState.status === "loading" && (
                  <div className="ai-explanation-loading">
                    <i aria-hidden="true" />
                    <p>{explanationState.message}</p>
                  </div>
                )}

                {explanationState.status === "ready" && (
                  <>
                    <p className="explanation-body">{explanationState.explanation}</p>
                    {explanationState.keyPoint && (
                      <div className="ai-key-point">
                        <strong>핵심 개념</strong>
                        <p>{explanationState.keyPoint}</p>
                      </div>
                    )}
                    {explanationState.choiceReasons?.some((item) => String(item?.reason || "").trim()) && (
                      <ol className="ai-choice-reasons">
                        {explanationState.choiceReasons.map((item, index) => (
                          String(item?.reason || "").trim() ? (
                            <li key={item.index ?? index}>
                              <b>{circled[Number(item.index ?? index)] || `${index + 1}번`}</b>
                              <span>{item.reason}</span>
                            </li>
                          ) : null
                        ))}
                      </ol>
                    )}
                    {explanationState.source === "ai" && (
                      <>
                        <small className="ai-explanation-safety">
                          공식 정답과 대조해 검증을 마친 해설만 보여드려요.
                        </small>
                        <div className="ai-explanation-feedback" aria-label="AI 해설 의견">
                          <span>이 해설은 어땠나요?</span>
                          <button type="button" onClick={() => sendExplanationFeedback("helpful")} disabled={feedbackBusy}>도움 됨</button>
                          <button type="button" onClick={() => sendExplanationFeedback("insufficient")} disabled={feedbackBusy}>설명 부족</button>
                          <button type="button" onClick={() => sendExplanationFeedback("answer_conflict")} disabled={feedbackBusy}>정답과 다름</button>
                          <button type="button" onClick={() => sendExplanationFeedback("content_error")} disabled={feedbackBusy}>내용 오류</button>
                        </div>
                        {feedbackMessage && <p className="ai-feedback-message">{feedbackMessage}</p>}
                      </>
                    )}
                  </>
                )}

                {(explanationState.status === "blocked" || explanationState.status === "error") && (
                  <div className="ai-explanation-blocked">
                    <strong>안전한 해설을 표시하지 않았습니다.</strong>
                    <p>{explanationState.message}</p>
                    {explanationState.issues?.length > 0 && (
                      <ul>
                        {explanationState.issues.slice(0, 3).map((issue) => <li key={issue}>{issue}</li>)}
                      </ul>
                    )}
                    {explanationState.status === "error" && (
                      <button type="button" className="secondary" onClick={retryExplanation}>다시 생성</button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </article>

    <section className="confidence-assessment">
      <div className="confidence-heading">
        <div>
          <strong>이 문제를 얼마나 이해했나요?</strong>
          <p>
            정답 여부와 함께 자기평가를 저장하면 다음 복습일을
            자동으로 계산합니다.
          </p>
        </div>

        {confidenceByQuestion[q.id] && (
          <span className="confidence-completed">
            저장 완료
          </span>
        )}
      </div>

      <div className="confidence-buttons">
        <button
          type="button"
          className={
            confidenceByQuestion[q.id] === "high"
              ? "confidence-high active"
              : "confidence-high"
          }
          onClick={() => handleConfidence("high")}
          disabled={savingConfidence}
        >
          <strong>확실함</strong>
          <span>개념과 풀이를 설명할 수 있어요</span>
        </button>

        <button
          type="button"
          className={
            confidenceByQuestion[q.id] === "medium"
              ? "confidence-medium active"
              : "confidence-medium"
          }
          onClick={() => handleConfidence("medium")}
          disabled={savingConfidence}
        >
          <strong>애매함</strong>
          <span>맞혔지만 일부 내용이 헷갈려요</span>
        </button>

        <button
          type="button"
          className={
            confidenceByQuestion[q.id] === "low"
              ? "confidence-low active"
              : "confidence-low"
          }
          onClick={() => handleConfidence("low")}
          disabled={savingConfidence}
        >
          <strong>모름</strong>
          <span>찍었거나 개념을 다시 공부해야 해요</span>
        </button>
      </div>

      {savingConfidence && (
        <p className="confidence-message">
          학습 기록을 저장하고 있습니다.
        </p>
      )}

      {!savingConfidence && progressMessage && (
        <p className="confidence-message">
          {progressMessage}
        </p>
      )}
    </section>

        <div className="explanation">
      <strong>정답 {circled[q.answerIndex]}</strong>
      <p>
        {q.explanation || "등록된 해설이 없습니다."}
      </p>
    </div>
  </>
)}

</article>
          
        <footer className="exam-navigation-bar">
          <button type="button" className="nav-move nav-prev" onClick={() => moveTo(current - 1)} disabled={isFirst}><span aria-hidden="true">←</span><b>이전 문제</b></button>
          <div className="exam-navigation-center">
            <button type="button" className="secondary" onClick={onExit}>나가기</button>
            {submitted ? (
              <button type="button" className="primary" onClick={onExit}>결과 저장 후 종료</button>
            ) : (
              <button type="button" className="primary" onClick={session.submit}>
                {isPracticeAssessment ? "학습 결과 확인" : "시험 제출"}
              </button>
            )}
          </div>
          <button type="button" className="nav-move nav-next" onClick={() => moveTo(current + 1)} disabled={isLast}><b>다음 문제</b><span aria-hidden="true">→</span></button>
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
