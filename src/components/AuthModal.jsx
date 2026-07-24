import { useState } from "react";
import {
  auth,
  createUserWithEmailAndPassword,
  signInGoogle,
  signInWithEmailAndPassword,
  signOut,
} from "../firebase";

export default function AuthModal({ user, onClose }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();

    if (emailLoading) return;

    setEmailLoading(true);
    setMessage("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      onClose();
    } catch (error) {
      console.error("이메일 로그인 오류:", error);
      setMessage(getAuthErrorMessage(error));
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleGoogleLogin(event) {
    event.preventDefault();
    event.stopPropagation();

    if (googleLoading) return;

    setGoogleLoading(true);
    setMessage("");

    try {
      await signInGoogle();
      onClose();
    } catch (error) {
      console.error("Google 로그인 오류:", {
        code: error?.code,
        message: error?.message,
        customData: error?.customData,
      });

      setMessage(getAuthErrorMessage(error));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleCreateAccount() {
    if (!email || !password) {
      setMessage("이메일과 비밀번호를 입력해 주세요.");
      return;
    }

    if (password.length < 6) {
      setMessage("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    setMessage("");

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      onClose();
    } catch (error) {
      console.error("회원가입 오류:", error);
      setMessage(getAuthErrorMessage(error));
    }
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
      onClose();
    } catch (error) {
      console.error("로그아웃 오류:", error);
      setMessage("로그아웃 중 문제가 발생했습니다.");
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !googleLoading) {
          onClose();
        }
      }}
    >
      <div className="modal">
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          disabled={googleLoading}
          aria-label="닫기"
        >
          ×
        </button>

        {user ? (
          <>
            <h2>계정</h2>
            <p>{user.displayName || user.email}</p>

            <button
              type="button"
              className="primary wide"
              onClick={handleSignOut}
            >
              로그아웃
            </button>

            {message && (
              <p className="error-box" role="alert">
                {message}
              </p>
            )}
          </>
        ) : (
          <>
            <h2>로그인</h2>

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
                disabled={emailLoading || googleLoading}
              >
                {emailLoading ? "로그인 중..." : "로그인"}
              </button>
            </form>

            <button
              type="button"
              className="secondary wide"
              onClick={handleGoogleLogin}
              disabled={googleLoading || emailLoading}
            >
              {googleLoading ? "Google 로그인 중..." : "Google로 계속"}
            </button>

            <button
              type="button"
              className="text-button"
              onClick={handleCreateAccount}
              disabled={googleLoading || emailLoading}
            >
              입력한 정보로 회원가입
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
      return "이메일 또는 비밀번호가 올바르지 않습니다.";

    case "auth/email-already-in-use":
      return "이미 사용 중인 이메일입니다.";

    case "auth/weak-password":
      return "비밀번호는 6자 이상으로 입력해 주세요.";

    case "auth/invalid-email":
      return "올바른 이메일 주소를 입력해 주세요.";

    case "auth/network-request-failed":
      return "네트워크 연결을 확인해 주세요.";

    default:
      return `로그인 중 문제가 발생했습니다. ${
        error?.code || "알 수 없는 오류"
      }`;
  }
}
