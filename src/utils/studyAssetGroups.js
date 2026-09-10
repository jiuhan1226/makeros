export function studyAssetGroup(item = {}) {
  const type = String(item.sourceType || "").toLowerCase();
  if (type.includes("pdf")) {
    const label = item.sourceName || "PDF 자료";
    return {
      root: "PDF",
      key: item.folderId || (item.pdfId ? `pdf:${item.pdfId}` : `pdf-name:${label}`),
      label,
    };
  }
  const label = item.certificateName || item.sourceName || "CBT 학습";
  return {
    root: "CBT",
    key: item.folderId || (item.certificateId ? `cbt:${item.certificateId}` : `cbt-name:${label}`),
    label,
  };
}

export function buildStudyAssetGroups(items = []) {
  return [...items.reduce((groups, item) => {
    const group = studyAssetGroup(item);
    if (!groups.has(group.key)) groups.set(group.key, group);
    return groups;
  }, new Map()).values()];
}
