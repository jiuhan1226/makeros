export function normalizeSubjectName(value) {
  return String(value || "공통").trim() || "공통";
}

export function buildSubjectCatalog(questionGroups = []) {
  const map = new Map();
  for (const group of questionGroups) {
    for (const question of group || []) {
      const subject = normalizeSubjectName(question?.subject);
      const current = map.get(subject) || { subject, available: 0 };
      current.available += 1;
      map.set(subject, current);
    }
  }
  return [...map.values()].sort((a, b) => b.available - a.available || a.subject.localeCompare(b.subject, "ko"));
}

export function buildSubjectProgress(catalog = [], history = []) {
  const attempts = new Map();
  for (const session of history || []) {
    for (const item of session?.subjects || []) {
      const subject = normalizeSubjectName(item?.subject);
      const current = attempts.get(subject) || { attempted: 0, correct: 0, sessions: 0 };
      current.attempted += Number(item?.total) || 0;
      current.correct += Number(item?.correct) || 0;
      current.sessions += 1;
      attempts.set(subject, current);
    }
  }

  const allSubjects = new Set([...catalog.map((item) => item.subject), ...attempts.keys()]);
  return [...allSubjects].map((subject) => {
    const base = catalog.find((item) => item.subject === subject) || { subject, available: 0 };
    const activity = attempts.get(subject) || { attempted: 0, correct: 0, sessions: 0 };
    const coverage = base.available > 0 ? Math.min(100, Math.round((activity.attempted / base.available) * 100)) : 0;
    const accuracy = activity.attempted > 0 ? Math.round((activity.correct / activity.attempted) * 100) : null;
    return { ...base, ...activity, coverage, accuracy };
  }).sort((a, b) => b.available - a.available || a.subject.localeCompare(b.subject, "ko"));
}
