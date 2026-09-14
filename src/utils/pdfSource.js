export function sourcePageNumbers(item = {}) {
  const exact = [...new Set((Array.isArray(item.sourcePages) ? item.sourcePages : [])
    .map(Number)
    .filter((page) => Number.isInteger(page) && page > 0))].sort((a, b) => a - b);
  if (exact.length) return exact;
  const start = Number(item.evidencePage || item.pageStart || 0);
  const end = Number(item.pageEnd || start);
  if (!Number.isInteger(start) || start <= 0) return [];
  if (!Number.isInteger(end) || end < start || end - start > 50) return [start];
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function sourcePageLabel(item = {}) {
  const pages = sourcePageNumbers(item);
  if (!pages.length) return "";
  if (pages.length === 1) return `${pages[0]}쪽`;
  const consecutive = pages.every((page, index) => index === 0 || page === pages[index - 1] + 1);
  return consecutive ? `${pages[0]}~${pages.at(-1)}쪽` : `${pages.join("·")}쪽`;
}
