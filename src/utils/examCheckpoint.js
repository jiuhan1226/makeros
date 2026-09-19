const DB_NAME = "makeros-learning-v1";
const DB_VERSION = 2;
const STORE_NAME = "examCheckpoints";
const LEGACY_ACTIVE_KEY = "active";
const META_KEY = "makeros:active-exam-meta:v2";
const META_INDEX_KEY = "makeros:exam-checkpoint-index:v3";
const ACTIVE_SESSION_KEY = "makeros:active-exam-key:v3";
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

function readJson(storage, key, fallback) {
  try { return JSON.parse(storage?.getItem(key) || "null") ?? fallback; }
  catch { return fallback; }
}

export function examCheckpointKey(payload = {}) {
  const exam = payload.exam || payload;
  const certificate = String(exam?.certificateId || exam?.certificateName || "general").trim();
  const examId = String(exam?.id || exam?.examId || exam?.title || "learning").trim();
  const scope = String(exam?.studyScope || "exam").trim();
  return [certificate, examId, scope].map((value) => encodeURIComponent(value).slice(0, 120)).join("__");
}

export function buildExamCheckpoint(payload = {}) {
  if (!payload.exam || !Array.isArray(payload.questions) || !payload.questions.length) return null;
  const checkpointKey = String(payload.checkpointKey || examCheckpointKey(payload));
  return { version: 3, ...payload, checkpointKey, savedAt: Number(payload.savedAt || Date.now()) };
}

export function examCheckpointMeta(payload = {}) {
  return {
    version: 3,
    checkpointKey: String(payload.checkpointKey || examCheckpointKey(payload)),
    examId: payload.exam?.id || "",
    title: payload.exam?.title || payload.exam?.certificateName || "학습",
    certificateId: payload.exam?.certificateId || "",
    certificateName: payload.exam?.certificateName || "",
    studyScope: payload.exam?.studyScope || "",
    mode: payload.mode || "시험모드",
    current: Number(payload.current || 0),
    total: Array.isArray(payload.questions) ? payload.questions.length : Number(payload.total || 0),
    answered: Object.values(payload.answers || {}).filter((value) => value !== undefined).length,
    savedAt: Number(payload.savedAt || Date.now()),
  };
}

export function listExamCheckpointMeta(storage = globalThis.localStorage) {
  const items = readJson(storage, META_INDEX_KEY, []);
  return (Array.isArray(items) ? items : []).filter((item) => item?.checkpointKey).sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0));
}

export function readActiveExamCheckpointKey(storage = globalThis.localStorage) {
  try { return String(storage?.getItem(ACTIVE_SESSION_KEY) || ""); }
  catch { return ""; }
}

export function readExamCheckpointMeta(storage = globalThis.localStorage) {
  const activeKey = readActiveExamCheckpointKey(storage);
  const indexed = listExamCheckpointMeta(storage);
  if (activeKey) return indexed.find((item) => item.checkpointKey === activeKey) || null;
  return readJson(storage, META_KEY, null) || indexed[0] || null;
}

function saveMeta(storage, checkpoint, makeActive = true) {
  const meta = examCheckpointMeta(checkpoint);
  const next = [meta, ...listExamCheckpointMeta(storage).filter((item) => item.checkpointKey !== meta.checkpointKey)].slice(0, 30);
  try {
    storage?.setItem(META_INDEX_KEY, JSON.stringify(next));
    if (makeActive) {
      storage?.setItem(ACTIVE_SESSION_KEY, meta.checkpointKey);
      storage?.setItem(META_KEY, JSON.stringify(meta));
    }
    storage?.removeItem(LEGACY_KEY);
  } catch {
    // IndexedDB 저장은 완료되었으므로 시험 진행 자체는 유지합니다.
  }
  return meta;
}

export async function writeExamCheckpoint(payload, { storage = globalThis.localStorage, indexedDb = globalThis.indexedDB, makeActive = true } = {}) {
  const checkpoint = buildExamCheckpoint(payload);
  if (!checkpoint) return null;
  const db = await openDb(indexedDb);
  try { await transact(db, "readwrite", (store) => store.put(checkpoint, checkpoint.checkpointKey)); } finally { db.close(); }
  saveMeta(storage, checkpoint, makeActive);
  return checkpoint;
}

export async function readExamCheckpoint({ key = "", storage = globalThis.localStorage, indexedDb = globalThis.indexedDB } = {}) {
  const activeKey = String(key || readActiveExamCheckpointKey(storage) || readExamCheckpointMeta(storage)?.checkpointKey || "");
  const db = await openDb(indexedDb);
  let saved;
  try {
    saved = activeKey ? await transact(db, "readonly", (store) => store.get(activeKey)) : null;
    if (!saved) saved = await transact(db, "readonly", (store) => store.get(LEGACY_ACTIVE_KEY));
  } finally { db.close(); }
  const checkpoint = buildExamCheckpoint(saved || {});
  if (!checkpoint) return null;
  saveMeta(storage, checkpoint, true);
  const elapsed = checkpoint.mode === "실전모드" && !checkpoint.submitted
    ? Math.max(0, Math.floor((Date.now() - checkpoint.savedAt) / 1000))
    : 0;
  return { ...checkpoint, remaining: Math.max(0, Number(checkpoint.remaining || 0) - elapsed) };
}

export async function clearExamCheckpoint({ key = "", all = false, storage = globalThis.localStorage, indexedDb = globalThis.indexedDB } = {}) {
  const targetKey = String(key || readActiveExamCheckpointKey(storage) || "");
  const db = indexedDb ? await openDb(indexedDb) : null;
  try {
    if (db) {
      if (all) await transact(db, "readwrite", (store) => store.clear());
      else if (targetKey) await transact(db, "readwrite", (store) => store.delete(targetKey));
      if (!all) await transact(db, "readwrite", (store) => store.delete(LEGACY_ACTIVE_KEY));
    }
  } finally { db?.close(); }
  try {
    const next = all ? [] : listExamCheckpointMeta(storage).filter((item) => item.checkpointKey !== targetKey);
    storage?.setItem(META_INDEX_KEY, JSON.stringify(next));
    storage?.removeItem(META_KEY);
    storage?.removeItem(LEGACY_KEY);
    if (all || readActiveExamCheckpointKey(storage) === targetKey) {
      const fallback = next[0];
      if (fallback) {
        storage?.setItem(ACTIVE_SESSION_KEY, fallback.checkpointKey);
        storage?.setItem(META_KEY, JSON.stringify(fallback));
      } else storage?.removeItem(ACTIVE_SESSION_KEY);
    }
  } catch { /* 저장소 접근이 막혀도 IndexedDB 삭제 결과는 유지합니다. */ }
}
