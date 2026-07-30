import { useEffect, useMemo, useState } from "react";
import { gradeExam } from "../utils/exam";

export function useExamSession() {
  const [questions, setQuestions] = useState([]);
  const [exam, setExam] = useState(null);
  const [mode, setMode] = useState("시험모드");
  const [answers, setAnswers] = useState({});
  const [bookmarks, setBookmarks] = useState({});
  const [reviewChecks, setReviewChecks] = useState({});
  const [confidenceByQuestion, setConfidenceByQuestion] = useState({});
  const [current, setCurrent] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [startedAt, setStartedAt] = useState(0);

  useEffect(() => {
    if (!exam || mode !== "실전모드" || submitted) return undefined;
    const id = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          setSubmitted(true);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [exam, mode, submitted]);

  const result = useMemo(
    () => gradeExam(questions, answers, exam, mode),
    [answers, exam, mode, questions],
  );
  const score = result.correct;

  function start(nextExam, nextQuestions, nextMode = "시험모드") {
    setExam(nextExam);
    setQuestions(nextQuestions);
    setMode(nextMode);
    setAnswers({});
    setBookmarks({});
    setReviewChecks({});
    setConfidenceByQuestion({});
    setCurrent(0);
    setSubmitted(false);
    setRemaining((nextExam?.durationMinutes || Math.max(1, nextQuestions.length)) * 60);
    setStartedAt(Date.now());
  }

  function answer(index, choice) {
    if (submitted) return;
    if (mode === "연습모드" && answers[index] !== undefined) return;
    setAnswers((prev) => ({ ...prev, [index]: choice }));
  }

  function toggleBookmark(index) {
    setBookmarks((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  function toggleReviewCheck(index) {
    setReviewChecks((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  function setConfidence(questionId, confidence) {
    if (!questionId) return;
    setConfidenceByQuestion((previous) => ({ ...previous, [questionId]: confidence }));
  }

  return {
    questions,
    exam,
    mode,
    answers,
    bookmarks,
    reviewChecks,
    confidenceByQuestion,
    current,
    submitted,
    remaining,
    startedAt,
    elapsedSeconds: startedAt ? Math.max(0, Math.round((Date.now() - startedAt) / 1000)) : 0,
    score,
    result,
    start,
    answer,
    toggleBookmark,
    toggleReviewCheck,
    setConfidence,
    setCurrent,
    submit: () => setSubmitted(true),
  };
}
