// Wall-clock exam deadlines and engaged study time are deliberately independent.
// Hidden tabs, other pages and inactivity past two minutes earn no study time.
export function createStudyClock(seconds = 0, now = Date.now()) {
  return { seconds: Math.max(0, Number(seconds) || 0), lastTick: now, lastInteraction: now };
}
export function studyDayEndsAt(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return Infinity;
  const end = new Date(`${date}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return Number.isFinite(end.getTime()) ? end.getTime() : Infinity;
}
export function tickStudyClock(clock, { now, active, visible, submitted, stopAt = Infinity }) {
  const stop = Math.min(now, clock.lastInteraction + 120000, stopAt);
  const delta = active && visible && !submitted ? Math.max(0, stop - clock.lastTick) / 1000 : 0;
  return { ...clock, seconds: clock.seconds + delta, lastTick: now };
}
