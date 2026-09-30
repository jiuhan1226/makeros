import { useEffect, useState } from "react";

export default function FeedbackCenter() {
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    function show(event) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const notice = { id, message: event.detail?.message || "", type: event.detail?.type || "info" };
      setNotices((current) => [...current.slice(-2), notice]);
      window.setTimeout(() => setNotices((current) => current.filter((item) => item.id !== id)), 4200);
    }
    window.addEventListener("makeros:notify", show);
    return () => window.removeEventListener("makeros:notify", show);
  }, []);

  return (
    <div className="feedback-center" aria-live="polite" aria-atomic="false">
      {notices.map((notice) => (
        <div className={`feedback-toast ${notice.type}`} role={notice.type === "error" ? "alert" : "status"} key={notice.id}>
          <span>{notice.type === "error" ? "!" : notice.type === "success" ? "✓" : "i"}</span>
          <p>{notice.message}</p>
          <button type="button" aria-label="알림 닫기" onClick={() => setNotices((current) => current.filter((item) => item.id !== notice.id))}>×</button>
        </div>
      ))}
    </div>
  );
}
