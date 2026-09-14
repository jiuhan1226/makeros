import { useEffect, useMemo, useRef, useState } from "react";
import { gradeExam } from "../utils/exam.js";

const EXAM_SESSION_KEY = "makeros:active-exam-session:v1";

export function readSavedExamSession(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage?.getItem(EXAM_SESSION_KEY) || "null");
    if (!saved?.exam || !Array.isArray(saved.questions) || !saved.questions.length) return null;
    const elapsed = saved.mode === "실전모드" && !saved.submitted
      ? Math.max(0, Math.floor((Date.now() - Number(saved.savedAt || Date.now())) / 1000))
      : 0;
    return {
      ...saved,
      remaining: Math.max(0, Number(saved.remaining || 0) - elapsed),
    };
  } catch {
    return null;
  }
}

export function useExamSession() {
  const restored = useRef(readSavedExamSession()).current;
  const [questions, setQuestions] = useState(restored?.questions || []);
  const [exam, setExam] = useState(restored?.exam || null);
  const [mode, setMode] = useState(restored?.mode || "시험모드");
  const [answers, setAnswers] = useState(restored?.answers || {});
  const [bookmarks, setBookmarks] = useState(restored?.bookmarks || {});
  const [reviewChecks, setReviewChecks] = useState(restored?.reviewChecks || {});
  const [confidenceByQuestion, setConfidenceByQuestion] = useState(restored?.confidenceByQuestion || {});
  const [current, setCurrent] = useState(Math.max(0, Math.min(Number(restored?.current || 0), Math.max(0, (restored?.questions?.length || 1) - 1))));
  const [submitted, setSubmitted] = useState(Boolean(restored?.submitted));
  const [remaining, setRemaining] = useState(Number(restored?.remaining || 0));
  const [startedAt, setStartedAt] = useState(Number(restored?.startedAt || 0));
  const [checkpointEnabled, setCheckpointEnabled] = useState(Boolean(restored));

  useEffect(() => {
    if (!checkpointEnabled || !exam || !questions.length) {
      try { localStorage.removeItem(EXAM_SESSION_KEY); } catch { /* 저장소가 막힌 환경 */ }
      return undefined;
    }
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(EXAM_SESSION_KEY, JSON.stringify({
          version: 1,
          exam,
          questions,
          mode,
          answers,
          bookmarks,
          reviewChecks,
          confidenceByQuestion,
          current,
          submitted,
          remaining,
          startedAt,
          savedAt: Date.now(),
        }));
      } catch (error) {
        console.warn("시험 진행 상태를 이 기기에 저장하지 못했습니다.", error);
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [answers, bookmarks, checkpointEnabled, confidenceByQuestion, current, exam, mode, questions, reviewChecks, startedAt, submitted]);

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
    setCheckpointEnabled(true);
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

  function clearCheckpoint() {
    setCheckpointEnabled(false);
    try { localStorage.removeItem(EXAM_SESSION_KEY); } catch { /* 저장소가 막힌 환경 */ }
  }

  function setBookmark(index, value) {
    setBookmarks((prev) => ({ ...prev, [index]: Boolean(value) }));
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
    resumable: Boolean(checkpointEnabled && exam && questions.length && !submitted),
    score,
    result,
    start,
    answer,
    toggleBookmark,
    setBookmark,
    toggleReviewCheck,
    setConfidence,
    setCurrent,
    submit: () => setSubmitted(true),
    clearCheckpoint,
  };
}
