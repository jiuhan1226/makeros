import { useEffect, useMemo, useRef, useState } from "react";
import { gradeExam } from "../utils/exam.js";
import { clearExamCheckpoint, examCheckpointKey, listExamCheckpointMeta, readExamCheckpoint, readExamCheckpointMeta, remainingForCheckpoint, writeExamCheckpoint } from "../utils/examCheckpoint.js";

const EXAM_SESSION_KEY = "makeros:active-exam-session:v1";
const loadCloudDraftApi = () => import("../firebase.js");

export function readSavedExamSession(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage?.getItem(EXAM_SESSION_KEY) || "null");
    if (!saved?.exam || !Array.isArray(saved.questions) || !saved.questions.length) return null;
    return {
      ...saved,
      remaining: remainingForCheckpoint(saved),
    };
  } catch {
    return null;
  }
}

export function useExamSession({ userId = "" } = {}) {
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
  const [submitted, setSubmitted] = useState(Boolean(restored?.submitted || (restored?.mode === "실전모드" && restored?.remaining <= 0)));
  const [remaining, setRemaining] = useState(Number(restored?.remaining || 0));
  const [deadlineAt, setDeadlineAt] = useState(Number(restored?.deadlineAt || 0) || (restored?.mode === "실전모드" ? Date.now() + Number(restored?.remaining || 0) * 1000 : 0));
  const [startedAt, setStartedAt] = useState(Number(restored?.startedAt || 0));
  const [checkpointEnabled, setCheckpointEnabled] = useState(Boolean(restored || savedMeta));
  const [restoring, setRestoring] = useState(Boolean(!restored && savedMeta));
  const [checkpointStatus, setCheckpointStatus] = useState(restored ? "saved" : savedMeta ? "restoring" : "idle");
  const [lastSavedAt, setLastSavedAt] = useState(Number(restored?.savedAt || savedMeta?.savedAt || 0));
  const [checkpointKey, setCheckpointKey] = useState(String(restored?.checkpointKey || savedMeta?.checkpointKey || ""));
  const [drafts, setDrafts] = useState(() => listExamCheckpointMeta());
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
        setSubmitted(Boolean(saved.submitted || (saved.mode === "실전모드" && saved.remaining <= 0)));
        setRemaining(Number(saved.remaining || 0));
        setDeadlineAt(Number(saved.deadlineAt || 0) || (saved.mode === "실전모드" ? Date.now() + Number(saved.remaining || 0) * 1000 : 0));
        setStartedAt(Number(saved.startedAt || 0));
        setLastSavedAt(Number(saved.savedAt || 0));
        setCheckpointKey(String(saved.checkpointKey || examCheckpointKey(saved)));
        setDrafts(listExamCheckpointMeta());
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
    if (!userId) return undefined;
    let alive = true;
    loadCloudDraftApi().then(({ loadCloudExamDrafts }) => loadCloudExamDrafts(userId)).then(async (cloudDrafts) => {
      for (const draft of cloudDrafts.filter((item) => item?.exam && Array.isArray(item.questions) && item.questions.length)) {
        const localMeta = listExamCheckpointMeta().find((item) => item.checkpointKey === draft.checkpointKey);
        if (!localMeta || Number(draft.savedAt || 0) > Number(localMeta.savedAt || 0)) {
          await writeExamCheckpoint(draft, { makeActive: false });
        }
      }
      if (alive) setDrafts(listExamCheckpointMeta());
    }).catch((error) => console.warn("클라우드 CBT 진행 상태를 불러오지 못했습니다.", error));
    return () => { alive = false; };
  }, [userId]);

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
          deadlineAt,
          startedAt,
          savedAt: Date.now(),
          checkpointKey,
        });
      });
      writeQueue.current
        .then((checkpoint) => {
          if (generation !== checkpointGeneration.current) return;
          setLastSavedAt(Number(checkpoint?.savedAt || 0));
          setDrafts(listExamCheckpointMeta());
          if (userId && checkpoint) loadCloudDraftApi().then(({ saveCloudExamDraft }) => saveCloudExamDraft(userId, checkpoint)).catch((error) => console.warn("CBT 진행 상태 클라우드 저장 실패", error));
          setCheckpointStatus("saved");
        })
        .catch((error) => {
          if (generation !== checkpointGeneration.current) return;
          setCheckpointStatus("error");
        console.warn("시험 진행 상태를 이 기기에 저장하지 못했습니다.", error);
        });
    }, 250);
    return () => window.clearTimeout(id);
  }, [answers, bookmarks, checkpointEnabled, checkpointKey, confidenceByQuestion, current, deadlineAt, exam, mode, questions, restoring, reviewChecks, startedAt, submitted, userId]);

  useEffect(() => {
    if (!exam || mode !== "실전모드" || submitted) return undefined;
    const refresh = () => {
      const next = remainingForCheckpoint({ mode, deadlineAt, remaining });
      setRemaining(next);
      if (next <= 0) setSubmitted(true);
    };
    refresh();
    const id = window.setInterval(refresh, 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", refresh); };
  }, [exam, mode, submitted, deadlineAt]);

  const result = useMemo(
    () => gradeExam(questions, answers, exam, mode),
    [answers, exam, mode, questions],
  );
  const score = result.correct;

  function start(nextExam, nextQuestions, nextMode = "시험모드") {
    const nextKey = examCheckpointKey({ exam: nextExam });
    if (checkpointEnabled && exam && questions.length && !submitted) {
      const sameDraft = nextKey === checkpointKey;
      const accepted = window.confirm(sameDraft
        ? "이 시험의 저장된 진행 상태를 지우고 처음부터 다시 시작할까요?"
        : `진행 중인 '${exam.title || "CBT 학습"}'은 저장해 두고 새 학습을 시작할까요?`);
      if (!accepted) return false;
      if (sameDraft) {
        clearExamCheckpoint({ key: checkpointKey }).catch(() => undefined);
        if (userId) loadCloudDraftApi().then(({ deleteCloudExamDraft }) => deleteCloudExamDraft(userId, checkpointKey)).catch(() => undefined);
      } else {
        const currentCheckpoint = { exam, questions, mode, answers, bookmarks, reviewChecks, confidenceByQuestion, current, submitted, remaining, deadlineAt, startedAt, savedAt: Date.now(), checkpointKey };
        writeExamCheckpoint(currentCheckpoint, { makeActive: false }).then((saved) => userId && saved ? loadCloudDraftApi().then(({ saveCloudExamDraft }) => saveCloudExamDraft(userId, saved)) : null).catch(() => undefined);
      }
    }
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
    const startTime = Date.now();
    const durationSeconds = (nextExam?.durationMinutes || Math.max(1, nextQuestions.length)) * 60;
    setRemaining(durationSeconds);
    setDeadlineAt(nextMode === "실전모드" ? startTime + durationSeconds * 1000 : 0);
    setStartedAt(startTime);
    setCheckpointKey(nextKey);
    return true;
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
    const key = checkpointKey;
    checkpointGeneration.current += 1;
    setCheckpointEnabled(false);
    setCheckpointStatus("idle");
    setLastSavedAt(0);
    writeQueue.current = writeQueue.current.catch(() => undefined).then(() => clearExamCheckpoint({ key }));
    if (userId && key) writeQueue.current = writeQueue.current.then(() => loadCloudDraftApi()).then(({ deleteCloudExamDraft }) => deleteCloudExamDraft(userId, key));
    writeQueue.current.catch((error) => console.warn("시험 저장 상태를 지우지 못했습니다.", error));
    setDrafts((items) => items.filter((item) => item.checkpointKey !== key));
  }

  async function flushCheckpoint() {
    if (restoring || !checkpointEnabled || !exam || !questions.length || submitted) return null;
    const generation = checkpointGeneration.current;
    const snapshot = {
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
      deadlineAt,
      startedAt,
      savedAt: Date.now(),
      checkpointKey,
    };
    setCheckpointStatus("saving");
    writeQueue.current = writeQueue.current.catch(() => undefined).then(() => {
      if (generation !== checkpointGeneration.current) return null;
      return writeExamCheckpoint(snapshot);
    });
    try {
      const checkpoint = await writeQueue.current;
      if (generation !== checkpointGeneration.current || !checkpoint) return checkpoint;
      setLastSavedAt(Number(checkpoint.savedAt || 0));
      setDrafts(listExamCheckpointMeta());
      if (userId) {
        loadCloudDraftApi()
          .then(({ saveCloudExamDraft }) => saveCloudExamDraft(userId, checkpoint))
          .catch((error) => console.warn("종료 직전 CBT 클라우드 저장 실패", error));
      }
      setCheckpointStatus("saved");
      return checkpoint;
    } catch (error) {
      if (generation === checkpointGeneration.current) setCheckpointStatus("error");
      console.warn("시험 종료 전 진행 상태를 저장하지 못했습니다.", error);
      return null;
    }
  }

  async function resumeDraft(key) {
    setRestoring(true);
    try {
      const saved = await readExamCheckpoint({ key });
      if (!saved) return false;
      checkpointGeneration.current += 1;
      setExam(saved.exam); setQuestions(saved.questions); setMode(saved.mode || "시험모드");
      setAnswers(saved.answers || {}); setBookmarks(saved.bookmarks || {}); setReviewChecks(saved.reviewChecks || {});
      setConfidenceByQuestion(saved.confidenceByQuestion || {}); setCurrent(Math.max(0, Math.min(Number(saved.current || 0), saved.questions.length - 1)));
      setSubmitted(Boolean(saved.submitted || (saved.mode === "실전모드" && saved.remaining <= 0)));
      setRemaining(Number(saved.remaining || 0)); setDeadlineAt(Number(saved.deadlineAt || 0) || (saved.mode === "실전모드" ? Date.now() + Number(saved.remaining || 0) * 1000 : 0)); setStartedAt(Number(saved.startedAt || 0));
      setCheckpointKey(String(saved.checkpointKey || key)); setCheckpointEnabled(true); setLastSavedAt(Number(saved.savedAt || 0)); setCheckpointStatus("saved");
      return true;
    } finally { setRestoring(false); }
  }

  async function clearAllDrafts() {
    checkpointGeneration.current += 1;
    await clearExamCheckpoint({ all: true });
    if (userId) {
      const { clearCloudExamDrafts } = await loadCloudDraftApi();
      await clearCloudExamDrafts(userId);
    }
    setDrafts([]); setCheckpointKey(""); setCheckpointEnabled(false); setCheckpointStatus("idle"); setLastSavedAt(0);
    setExam(null); setQuestions([]); setAnswers({}); setBookmarks({}); setReviewChecks({}); setConfidenceByQuestion({}); setCurrent(0); setSubmitted(false); setRemaining(0); setDeadlineAt(0); setStartedAt(0);
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
    checkpointKey,
    drafts,
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
    flushCheckpoint,
    resumeDraft,
    clearAllDrafts,
  };
}
