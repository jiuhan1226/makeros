import { useEffect, useMemo, useRef, useState } from "react";
import { gradeExam } from "../utils/exam.js";
import { clearExamCheckpoint, readExamCheckpoint, readExamCheckpointMeta, writeExamCheckpoint } from "../utils/examCheckpoint.js";

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
  const savedMeta = useRef(readExamCheckpointMeta()).current;
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
  const [checkpointEnabled, setCheckpointEnabled] = useState(Boolean(restored || savedMeta));
  const [restoring, setRestoring] = useState(Boolean(!restored && savedMeta));
  const [checkpointStatus, setCheckpointStatus] = useState(restored ? "saved" : savedMeta ? "restoring" : "idle");
  const [lastSavedAt, setLastSavedAt] = useState(Number(restored?.savedAt || savedMeta?.savedAt || 0));
  const checkpointGeneration = useRef(0);
  const writeQueue = useRef(Promise.resolve());

  useEffect(() => {
    if (restored || !savedMeta) return undefined;
    let alive = true;
    readExamCheckpoint()
      .then((saved) => {
        if (!alive) return;
        if (!saved) {
          setCheckpointEnabled(false);
          setCheckpointStatus("idle");
          return;
        }
        setExam(saved.exam);
        setQuestions(saved.questions);
        setMode(saved.mode || "시험모드");
        setAnswers(saved.answers || {});
        setBookmarks(saved.bookmarks || {});
        setReviewChecks(saved.reviewChecks || {});
        setConfidenceByQuestion(saved.confidenceByQuestion || {});
        setCurrent(Math.max(0, Math.min(Number(saved.current || 0), saved.questions.length - 1)));
        setSubmitted(Boolean(saved.submitted));
        setRemaining(Number(saved.remaining || 0));
        setStartedAt(Number(saved.startedAt || 0));
        setLastSavedAt(Number(saved.savedAt || 0));
        setCheckpointStatus("saved");
      })
      .catch((error) => {
        console.warn("저장된 시험 진행 상태를 불러오지 못했습니다.", error);
        setCheckpointEnabled(false);
        setCheckpointStatus("error");
      })
      .finally(() => { if (alive) setRestoring(false); });
    return () => { alive = false; };
  }, [restored, savedMeta]);

  useEffect(() => {
    if (restoring || !checkpointEnabled || !exam || !questions.length) return undefined;
    const generation = checkpointGeneration.current;
    setCheckpointStatus("saving");
    const id = window.setTimeout(() => {
      writeQueue.current = writeQueue.current.catch(() => undefined).then(() => {
        if (generation !== checkpointGeneration.current) return null;
        return writeExamCheckpoint({
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
        });
      });
      writeQueue.current
        .then((savedAt) => {
          if (generation !== checkpointGeneration.current) return;
          setLastSavedAt(Number(savedAt || 0));
          setCheckpointStatus("saved");
        })
        .catch((error) => {
          if (generation !== checkpointGeneration.current) return;
          setCheckpointStatus("error");
        console.warn("시험 진행 상태를 이 기기에 저장하지 못했습니다.", error);
        });
    }, 250);
    return () => window.clearTimeout(id);
  }, [answers, bookmarks, checkpointEnabled, confidenceByQuestion, current, exam, mode, questions, restoring, reviewChecks, startedAt, submitted]);

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
    checkpointGeneration.current += 1;
    setCheckpointEnabled(true);
    setCheckpointStatus("saving");
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
    checkpointGeneration.current += 1;
    setCheckpointEnabled(false);
    setCheckpointStatus("idle");
    setLastSavedAt(0);
    writeQueue.current = writeQueue.current.catch(() => undefined).then(() => clearExamCheckpoint());
    writeQueue.current.catch((error) => console.warn("시험 저장 상태를 지우지 못했습니다.", error));
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
    restoring,
    checkpointStatus,
    lastSavedAt,
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
