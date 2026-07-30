import { useState } from "react";
import {
  auth,
  createUserWithEmailAndPassword,
  signInGoogle,
  signInWithEmailAndPassword,
  signOut,
} from "../firebase";

function friendlyAuthMessage(error) {
  const code = String(error?.code || "");
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "이메일 또는 비밀번호를 확인해 주세요.";
  if (code.includes("email-already-in-use")) return "이미 가입된 이메일입니다.";
  if (code.includes("weak-password")) return "비밀번호는 6자 이상 입력해 주세요.";
  if (code.includes("too-many-requests")) return "로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.";
  return error?.message || "요청을 처리하지 못했습니다.";
}

export default function AuthModal({ user, onClose }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      onClose();
    } catch (error) {
      setMessage(friendlyAuthMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    await run(() => signInWithEmailAndPassword(auth, email, password));
  }


  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="modal auth-modal">
      <button className="modal-close" onClick={onClose} aria-label="닫기">×</button>
      {user ? <>
        <span className="eyebrow">ACCOUNT</span>
        <h2>계정</h2>
        <p>{user.displayName || user.email}</p>
        <button className="primary wide" disabled={busy} onClick={() => run(() => signOut(auth))}>로그아웃</button>
      </> : <>
        <span className="eyebrow">WELCOME TO MAKEROS</span>
        <h2>로그인</h2>
        <p className="muted">학습 기록과 AI 해설을 안전하게 동기화합니다.</p>
        <form onSubmit={submit}>
          <label>이메일<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>비밀번호<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength="6" required /></label>
          <button className="primary wide" disabled={busy}>{busy ? "확인 중…" : "로그인"}</button>
        </form>
        <button className="secondary wide" disabled={busy} onClick={() => run(() => signInGoogle())}>Google로 계속</button>
        <button className="text-button" disabled={busy} onClick={() => run(() => createUserWithEmailAndPassword(auth, email, password))}>입력한 정보로 회원가입</button>
        {message && <p className="error-box" role="alert">{message}</p>}
      </>}
    </div>
  </div>;
}
