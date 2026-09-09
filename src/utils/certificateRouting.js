export function certificateLookupKey(value = "") {
  const normalized = String(value)
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
  return normalized.replace(/(?:필기|실기|시험|준비)+$/g, "");
}

export function findCertificateForGoal(goal, certificates = []) {
  if (!goal) return null;
  const linkedId = String(goal.certificateId || "").trim();
  if (linkedId) {
    const linked = certificates.find((candidate) => String(candidate?.id || "") === linkedId);
    if (linked) return linked;
  }
  const goalKey = certificateLookupKey(goal.name || goal.title);
  if (!goalKey) return null;
  return certificates.find((candidate) => certificateLookupKey(candidate?.name) === goalKey) || null;
}

export function certificateUnavailableReason(goal, certificates = [], options = {}) {
  const name = String(goal?.name || goal?.title || "목표 자격증").trim();
  if (!options.databaseConfigured) return "CBT 문제 DB 연결이 설정되지 않아 자격증 문제를 불러올 수 없습니다.";
  if (!options.catalogLoaded) return "CBT 자격증 목록을 불러오는 중입니다. 잠시 후 다시 눌러 주세요.";
  if (!findCertificateForGoal(goal, certificates)) {
    return `${name} CBT는 아직 MakerOS 문제 DB에 등록되지 않았습니다. 일정과 계획은 사용할 수 있지만 문제 풀이는 DB에 기출문제가 등록된 뒤 이용할 수 있습니다.`;
  }
  return "";
}

export function buildCertificateShortcuts(goals = [], certificates = []) {
  return goals.filter((goal) => goal?.name).map((goal) => {
    const matched = findCertificateForGoal(goal, certificates);
    return {
      goalId: goal.id || "",
      name: goal.name,
      certificateId: matched?.id || "",
      supported: Boolean(matched),
    };
  });
}
