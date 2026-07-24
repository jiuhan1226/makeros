export const PDF_LIBRARY_KEY = "studylock-pdf-library-v1";
export const STUDY_ASSETS_KEY = "studylock-study-assets-v1";

export function readJson(key, fallback = []) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}
export function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
export function readPdfLibrary() { return readJson(PDF_LIBRARY_KEY, []); }
export function savePdfLibrary(items) { writeJson(PDF_LIBRARY_KEY, items.slice(0, 50)); window.dispatchEvent(new Event("studylock:pdf-library")); }
export function upsertPdfDocument(doc) {
  const items = readPdfLibrary();
  const next = [{...doc, updatedAt: Date.now()}, ...items.filter(x => x.id !== doc.id && x.name !== doc.name)].slice(0,50);
  savePdfLibrary(next); return next;
}
export function deletePdfDocument(id) { savePdfLibrary(readPdfLibrary().filter(x => x.id !== id)); }
export function readStudyAssets() { return readJson(STUDY_ASSETS_KEY, {notes:[],cards:[]}); }
export function saveStudyAssets(value) { writeJson(STUDY_ASSETS_KEY, value); window.dispatchEvent(new Event("studylock:study-assets")); }
export function normalizeText(value="") { return String(value).toLowerCase().replace(/\s+/g," ").trim(); }
export function assetId(prefix="asset") { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }
