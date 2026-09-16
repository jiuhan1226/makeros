export function passProjectionDisplay(projection = {}) {
  const sampleSize = Math.max(0, Number(projection.sampleSize || 0));
  if (!sampleSize) return { value: "분석 전", detail: "실전 기록 필요", reliable: false };
  if (sampleSize < 3) return { value: "기록 더 필요", detail: `최근 ${sampleSize}회만 반영`, reliable: false };
  return {
    value: projection.label || "학습 상태 확인",
    detail: `최근 ${sampleSize}회 · 예상 ${Number(projection.expectedScore || 0)}점`,
    reliable: true,
  };
}

export function evidenceLabel(count = 0) {
  const value = Math.max(0, Number(count || 0));
  if (!value) return "근거 없음";
  return `연결 기록 ${value}개`;
}
