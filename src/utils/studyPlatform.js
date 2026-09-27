export const PDF_LIBRARY_KEY = "studylock-pdf-library-v1";
export const STUDY_ASSETS_KEY = "studylock-study-assets-v1";
const PDF_DATABASE_NAME = "makeros-pdf-library";
const PDF_DATABASE_VERSION = 1;
const PDF_STORE_NAME = "library";
const PDF_STORE_KEY = "documents";
let pdfMemoryCache = null;
let pdfMemoryRevision = 0;

export function readJson(key, fallback = []) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}
export function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function localPdfLibrary() {
  const items = readJson(PDF_LIBRARY_KEY, []);
  return Array.isArray(items) ? items : [];
}

function pdfMetadata(items) {
  return items.map(({ pages = [], ...item }) => ({
    ...item,
    pageCount: Number(item.pageCount || pages.length || 0),
    pages: [],
    pageTextStored: pages.length > 0,
  }));
}

function openPdfDatabase() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PDF_DATABASE_NAME, PDF_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(PDF_STORE_NAME)) request.result.createObjectStore(PDF_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("PDF 저장소를 열지 못했습니다."));
  });
}

async function readPdfLibraryFromDatabase() {
  const database = await openPdfDatabase();
  if (!database) return null;
  return new Promise((resolve, reject) => {
    const request = database.transaction(PDF_STORE_NAME, "readonly").objectStore(PDF_STORE_NAME).get(PDF_STORE_KEY);
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
    request.onerror = () => reject(request.error || new Error("PDF 저장 내용을 읽지 못했습니다."));
  }).finally(() => database.close());
}

async function writePdfLibraryToDatabase(items) {
  const database = await openPdfDatabase();
  if (!database) return;
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(PDF_STORE_NAME, "readwrite");
    transaction.objectStore(PDF_STORE_NAME).put(items, PDF_STORE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("PDF 저장에 실패했습니다."));
  }).finally(() => database.close());
}

export function readPdfLibrary() {
  if (pdfMemoryCache) return pdfMemoryCache;
  pdfMemoryCache = localPdfLibrary();
  return pdfMemoryCache;
}

export async function hydratePdfLibrary() {
  const local = localPdfLibrary();
  const startingRevision = pdfMemoryRevision;
  try {
    const databaseItems = await readPdfLibraryFromDatabase();
    if (pdfMemoryRevision !== startingRevision) return pdfMemoryCache || [];
    if (databaseItems?.length) pdfMemoryCache = databaseItems;
    else {
      pdfMemoryCache = local;
      if (local.some((item) => item.pages?.length)) await writePdfLibraryToDatabase(local);
    }
  } catch (error) {
    console.warn("PDF IndexedDB 불러오기 실패, 기기 메타데이터를 사용합니다.", error);
    pdfMemoryCache = local;
  }
  return pdfMemoryCache;
}

export function savePdfLibrary(items) {
  const next = (Array.isArray(items) ? items : []).slice(0, 50);
  pdfMemoryRevision += 1;
  pdfMemoryCache = next;
  // localStorage에는 가벼운 메타데이터만 남기고, 페이지 본문은 용량이 큰
  // PDF에서도 안전하도록 IndexedDB에 저장합니다.
  try { writeJson(PDF_LIBRARY_KEY, pdfMetadata(next)); }
  catch (error) { console.warn("PDF 메타데이터 저장 실패", error); }
  writePdfLibraryToDatabase(next).catch((error) => console.warn("PDF 본문 저장 실패", error));
  if (typeof window !== "undefined") window.dispatchEvent(new Event("studylock:pdf-library"));
}
export function upsertPdfDocument(doc) {
  const items = readPdfLibrary();
  const next = [{...doc, updatedAt: Date.now()}, ...items.filter(x => x.id !== doc.id)].slice(0,50);
  savePdfLibrary(next); return next;
}
export function deletePdfDocument(id) { savePdfLibrary(readPdfLibrary().filter(x => x.id !== id)); }
export function readStudyAssets() { return readJson(STUDY_ASSETS_KEY, {notes:[],cards:[]}); }
export function saveStudyAssets(value) { writeJson(STUDY_ASSETS_KEY, value); window.dispatchEvent(new Event("studylock:study-assets")); }
export function normalizeText(value="") { return String(value).toLowerCase().replace(/\s+/g," ").trim(); }
export function assetId(prefix="asset") { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }
