import { postJson } from "./api";
import { assetId } from "./studyPlatform";

function cleanText(value = "") {
  return String(value).replace(/\u0000/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function splitLongPageText(text, maxChars) {
  const parts = [];
  let rest = cleanText(text);
  while (rest.length > maxChars) {
    const window = rest.slice(0, maxChars);
    const breakAt = Math.max(
      window.lastIndexOf("\n"),
      window.lastIndexOf(". "),
      window.lastIndexOf("다. "),
      window.lastIndexOf(" "),
    );
    const end = breakAt > maxChars * 0.55 ? breakAt + 1 : maxChars;
    parts.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

export function buildPageChunks(pages = [], maxChars = 14000) {
  const chunks = [];
  let current = [];
  let chars = 0;

  const flush = () => {
    if (current.length) chunks.push(current);
    current = [];
    chars = 0;
  };

  for (const raw of pages) {
    const pageNumber = Number(raw?.page) || 0;
    const pageText = cleanText(raw?.text);
    if (!pageNumber || !pageText) continue;

    const segments = splitLongPageText(pageText, Math.max(1200, maxChars - 80));
    for (const segment of segments) {
      const page = { page: pageNumber, text: segment };
      const pageChars = segment.length + 24;
      if (current.length && chars + pageChars > maxChars) flush();
      current.push(page);
      chars += pageChars;
      if (chars >= maxChars) flush();
    }
  }
  flush();
  return chunks;
}

function normalizeKey(value = "") {
  return cleanText(value).toLowerCase().replace(/[^가-힣a-z0-9]/g, "");
}

function dedupe(items, keyOf) {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizeKey(keyOf(item));
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function generateStudyAssetsFromPages({
  pages = [],
  sourceName = "PDF 학습 자료",
  pdfId = "",
  onProgress,
}) {
  const chunks = buildPageChunks(pages);
  if (!chunks.length) throw new Error("분석할 PDF 텍스트가 없습니다.");

  const notes = [];
  const cards = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const pageStart = chunk[0]?.page;
    const pageEnd = chunk.at(-1)?.page;
    onProgress?.({ index: index + 1, total: chunks.length, pageStart, pageEnd });

    const data = await postJson(
      "/api/generate-study-assets",
      {
        pages: chunk,
        sourceName,
        chunkIndex: index + 1,
        chunkCount: chunks.length,
      },
      `${pageStart}~${pageEnd}쪽 분석 실패`,
    );

    const createdAt = Date.now() + index;
    for (const note of data.notes || []) {
      notes.push({
        ...note,
        id: assetId("note"),
        sourceName,
        sourceType: "PDF",
        folderId: pdfId ? `pdf:${pdfId}` : `pdf:${normalizeKey(sourceName)}`,
        pdfId,
        pageStart: Number(note.pageStart) || pageStart,
        pageEnd: Number(note.pageEnd) || pageEnd,
        createdAt,
      });
    }
    for (const card of data.cards || []) {
      cards.push({
        ...card,
        id: assetId("card"),
        sourceName,
        sourceType: "PDF",
        folderId: pdfId ? `pdf:${pdfId}` : `pdf:${normalizeKey(sourceName)}`,
        pdfId,
        pageStart: Number(card.pageStart) || pageStart,
        pageEnd: Number(card.pageEnd) || pageEnd,
        createdAt,
      });
    }
  }

  return {
    notes: dedupe(notes, (item) => `${item.title}|${item.summary}`),
    cards: dedupe(cards, (item) => `${item.front}|${item.back}`),
    chunkCount: chunks.length,
  };
}
