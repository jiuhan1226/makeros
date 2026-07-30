import { useEffect, useState } from "react";
import { listAiExplanationReviews, updateAiExplanationReview } from "../firebase";
import { circled } from "../utils/exam";

const STATUS_LABELS = {
  pending: "검토 대기",
  resolved: "검토 완료",
  rejected: "해설 폐기",
};

export default function AdminPage() {
  const [status, setStatus] = useState("pending");
  const [reviews, setReviews] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadReviews(nextStatus = status) {
    setBusy(true);
    setMessage("");
    try {
      setReviews(await listAiExplanationReviews(nextStatus));
    } catch (error) {
      setMessage(error?.message || "AI 해설 검토 목록을 불러오지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { loadReviews(status); }, [status]);

  async function changeStatus(reviewId, nextStatus) {
    try {
      await updateAiExplanationReview(reviewId, { status: nextStatus });
      setReviews((items) => items.filter((item) => item.id !== reviewId));
      setMessage(`상태를 ${STATUS_LABELS[nextStatus] || nextStatus}(으)로 변경했습니다.`);
    } catch (error) {
      setMessage(error?.message || "검토 상태를 변경하지 못했습니다.");
    }
  }

  return (
    <main className="page-shell admin-native-shell">
      <div className="page-heading">
        <span className="eyebrow">ADMIN</span>
        <h1>관리자 센터</h1>
        <p>시험 데이터와 AI 해설 검토 요청을 한곳에서 관리하세요.</p>
      </div>

      <section className="panel ai-review-admin">
        <div className="section-heading">
          <div><span className="eyebrow">AI EXPLANATION REVIEW</span><h2>AI 해설 검토함</h2></div>
          <button type="button" className="secondary" onClick={() => loadReviews(status)} disabled={busy}>{busy ? "불러오는 중" : "새로고침"}</button>
        </div>
        <div className="tab-switch">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <button key={key} type="button" className={status === key ? "active" : ""} onClick={() => setStatus(key)}>{label}</button>
          ))}
        </div>
        {message && <p className="admin-review-message">{message}</p>}
        <div className="ai-review-list">
          {reviews.map((item) => (
            <article key={item.id}>
              <header>
                <div><span>{item.subject || "공통"} · {item.topic || "주제 미지정"}</span><strong>{item.reason || "검증 실패"}</strong></div>
                <b>정답 {circled[Number(item.officialAnswerIndex)] || Number(item.officialAnswerIndex) + 1}</b>
              </header>
              <h3>{item.question || "문제 내용 없음"}</h3>
              {item.issues?.length > 0 && <ul>{item.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
              {item.explanation && <details><summary>신고된 AI 해설</summary><p>{item.explanation}</p></details>}
              {item.comment && <p className="muted">사용자 의견: {item.comment}</p>}
              {status === "pending" && (
                <footer>
                  <button type="button" className="primary" onClick={() => changeStatus(item.id, "resolved")}>검토 완료</button>
                  <button type="button" className="maker-danger-ghost" onClick={() => changeStatus(item.id, "rejected")}>해설 폐기</button>
                </footer>
              )}
            </article>
          ))}
          {!busy && !reviews.length && <p className="muted">해당 상태의 검토 항목이 없습니다.</p>}
        </div>
      </section>

      <section className="panel admin-embed-panel">
        <iframe title="MakerOS 관리자 가져오기" src="/legacy.html?embed=1#admin" />
      </section>
    </main>
  );
}
