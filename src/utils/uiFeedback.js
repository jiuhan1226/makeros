export function notifyUser(message, type = "info") {
  const text = String(message || "").trim();
  if (!text) return;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("makeros:notify", { detail: { message: text, type } }));
}
