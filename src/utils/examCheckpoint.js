const DB_NAME = "makeros-learning-v1";
const DB_VERSION = 1;
const STORE_NAME = "examCheckpoints";
const ACTIVE_KEY = "active";
const META_KEY = "makeros:active-exam-meta:v2";
const LEGACY_KEY = "makeros:active-exam-session:v1";

function openDb(indexedDb = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!indexedDb) return reject(new Error("IndexedDB를 사용할 수 없습니다."));
    const request = indexedDb.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("학습 저장소를 열지 못했습니다."));
  });
}

function transact(db, mode, action) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("학습 진행 상태를 저장하지 못했습니다."));
    transaction.onabort = () => reject(transaction.error || new Error("학습 저장 작업이 중단되었습니다."));
  });
}

export function buildExamCheckpoint(payload = {}) {
  if (!payload.exam || !Array.isArray(payload.questions) || !payload.questions.length) return null;
  return { version: 2, ...payload, savedAt: Number(payload.savedAt || Date.now()) };
}

export function examCheckpointMeta(payload = {}) {
  return {
    version: 2,
    title: payload.exam?.title || payload.exam?.certificateName || "학습",
    certificateId: payload.exam?.certificateId || "",
    studyScope: payload.exam?.studyScope || "",
    current: Number(payload.current || 0),
    total: Array.isArray(payload.questions) ? payload.questions.length : 0,
    answered: Object.values(payload.answers || {}).filter((value) => value !== undefined).length,
    savedAt: Number(payload.savedAt || Date.now()),
  };
}

export function readExamCheckpointMeta(storage = globalThis.localStorage) {
  try { return JSON.parse(storage?.getItem(META_KEY) || "null"); } catch { return null; }
}

export async function writeExamCheckpoint(payload, { storage = globalThis.localStorage, indexedDb = globalThis.indexedDB } = {}) {
  const checkpoint = buildExamCheckpoint(payload);
  if (!checkpoint) return null;
  const db = await openDb(indexedDb);
  try { await transact(db, "readwrite", (store) => store.put(checkpoint, ACTIVE_KEY)); } finally { db.close(); }
  try {
    storage?.setItem(META_KEY, JSON.stringify(examCheckpointMeta(checkpoint)));
    storage?.removeItem(LEGACY_KEY);
  } catch {
    // IndexedDB 저장은 완료되었으므로 시험 진행 자체는 안전하게 유지합니다.
  }
  return checkpoint.savedAt;
}

export async function readExamCheckpoint({ indexedDb = globalThis.indexedDB } = {}) {
  const db = await openDb(indexedDb);
  let saved;
  try { saved = await transact(db, "readonly", (store) => store.get(ACTIVE_KEY)); } finally { db.close(); }
  const checkpoint = buildExamCheckpoint(saved || {});
  if (!checkpoint) return null;
  const elapsed = checkpoint.mode === "실전모드" && !checkpoint.submitted
    ? Math.max(0, Math.floor((Date.now() - checkpoint.savedAt) / 1000))
    : 0;
  return { ...checkpoint, remaining: Math.max(0, Number(checkpoint.remaining || 0) - elapsed) };
}

export async function clearExamCheckpoint({ storage = globalThis.localStorage, indexedDb = globalThis.indexedDB } = {}) {
  try {
    storage?.removeItem(META_KEY);
    storage?.removeItem(LEGACY_KEY);
  } catch { /* 저장소 접근이 막혀도 IndexedDB 삭제를 계속합니다. */ }
  if (!indexedDb) return;
  const db = await openDb(indexedDb);
  try { await transact(db, "readwrite", (store) => store.delete(ACTIVE_KEY)); } finally { db.close(); }
}
