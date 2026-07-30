import { useState } from "react";
import {
  auth,
  createUserWithEmailAndPassword,
  signInGoogle,
  signInWithEmailAndPassword,
  signOut,
} from "../firebase";

function getAuthErrorMessage(error) {
  switch (error?.code) {
    case "auth/popup-closed-by-user":
      return "Google 로그인 창이 완료되기 전에 닫혔습니다. 다시 시도해 주세요.";

    case "auth/cancelled-popup-request":
      return "로그인 요청이 중복되었습니다. 잠시 후 다시 시도해 주세요.";

    case "auth/popup-blocked":
      return "브라우저에서 MakerOS의 로그인 팝업을 허용해 주세요.";

    case "auth/unauthorized-domain":
      return "현재 주소가 Firebase 승인 도메인에 등록되지 않았습니다.";

    case "auth/operation-not-allowed":
      return "Firebase에서 해당 로그인 방식이 활성화되지 않았습니다.";

    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "이메일 또는 비밀번호가 올바르지 않습니다.";

    case "auth/email-already-in-use":
      return "이미 사용 중인 이메일입니다.";

    case "auth/weak-password":
      return "비밀번호는 6자 이상으로 입력해 주세요.";

    case "auth/invalid-email":
      return "올바른 이메일 주소를 입력해 주세요.";

    case "auth/too-many-requests":
      return "로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.";

    case "auth/network-request-failed":
      return "네트워크 연결을 확인해 주세요.";

    default:
      return "로그인 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
}

export default function AuthModal({ user, onClose }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState(null);

  const busy = busyAction !== null;

  async function run(actionName, action) {
    if (busy) return;

    setBusyAction(actionName);
    setMessage("");

    try {
      await action();
      onClose();
    } catch (error) {
      console.error(`[MakerOS] 인증 오류 (${actionName})`, {
        code: error?.code,
        message: error?.message,
      });

      setMessage(getAuthErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function submit(event) {
    event.preventDefault();

    await run("email-login", () =>
      signInWithEmailAndPassword(auth, email, password),
    );
  }

  async function handleGoogleLogin(event) {
    event.preventDefault();
    event.stopPropagation();

    await run("google-login", () => signInGoogle());
  }

  async function handleCreateAccount() {
    if (!email.trim()) {
      setMessage("이메일을 입력해 주세요.");
      return;
    }

    if (password.length < 6) {
      setMessage("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    await run("create-account", () =>
      createUserWithEmailAndPassword(auth, email.trim(), password),
    );
  }

  async function handleSignOut() {
    await run("sign-out", () => signOut(auth));
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <div className="modal auth-modal">
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          disabled={busy}
          aria-label="닫기"
        >
          ×
        </button>

        {user ? (
          <>
            <span className="eyebrow">ACCOUNT</span>
            <h2>계정</h2>
            <p>{user.displayName || user.email}</p>

            <button
              type="button"
              className="primary wide"
              disabled={busy}
              onClick={handleSignOut}
            >
              {busyAction === "sign-out" ? "로그아웃 중…" : "로그아웃"}
            </button>

            {message && (
              <p className="error-box" role="alert">
                {message}
              </p>
            )}
          </>
        ) : (
          <>
            <span className="eyebrow">WELCOME TO MAKEROS</span>
            <h2>로그인</h2>

            <p className="muted">
              학습 기록과 AI 해설을 안전하게 동기화합니다.
            </p>

            <form onSubmit={submit}>
              <label>
                이메일
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>

              <label>
                비밀번호
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  required
                />
              </label>

              <button
                type="submit"
                className="primary wide"
                disabled={busy}
              >
                {busyAction === "email-login" ? "로그인 중…" : "로그인"}
              </button>
            </form>

            <button
              type="button"
              className="secondary wide"
              disabled={busy}
              onClick={handleGoogleLogin}
            >
              {busyAction === "google-login"
                ? "Google 로그인 중…"
                : "Google로 계속"}
            </button>

            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={handleCreateAccount}
            >
              {busyAction === "create-account"
                ? "회원가입 중…"
                : "입력한 정보로 회원가입"}
            </button>

            {message && (
              <p className="error-box" role="alert">
                {message}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}