import { useState, useRef, useEffect, useCallback } from "react";
import {
  createUserWithEmailAndPassword,
  OAuthProvider,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import "../css/SignUp.css";
import "../css/SignUp-apple-addon.css";

// 단계 순서
// 0. auth  : Apple / Google / 직접 입력 중 선택 → 이름·이메일 확보
// 1. role  : 학부모 / 학생 선택
// 2. account: "직접 입력"을 고른 경우에만 등장 (이메일/비밀번호로 계정 생성)
const STEPS = ["auth", "role", "account"];

/* ================================================================
 * 네이티브 <-> JS 브릿지 규약
 * ----------------------------------------------------------------
 * [JS -> Native] 로그인 요청
 *   iOS:     window.webkit.messageHandlers.appleSignIn.postMessage(null)
 *            window.webkit.messageHandlers.googleSignIn.postMessage(null)
 *   Android: window.AndroidBridge.requestAppleSignIn()
 *            window.AndroidBridge.requestGoogleSignIn()
 *
 * [Native -> JS] 로그인 결과 콜백 (네이티브가 아래 전역 함수를 직접 호출)
 *   성공 시:
 *     window.onNativeAppleSignIn({ idToken, rawNonce, email, name })
 *     window.onNativeGoogleSignIn({ idToken, email, name })
 *   실패 시:
 *     window.onNativeSignInError({ provider: "apple" | "google", message })
 *
 *   - Apple은 Firebase OAuthProvider('apple.com').credential 생성 시
 *     rawNonce가 필요합니다. 네이티브에서 ASAuthorizationController로
 *     로그인할 때 사용한 원본 nonce(해시 전)를 그대로 넘겨주세요.
 *   - email/name은 Apple/Google이 최초 로그인 시에만 내려주는 경우가
 *     많으므로, 네이티브 쪽에서 최초 1회 값을 저장해뒀다가 매번
 *     함께 전달해주는 것을 권장합니다.
 * ================================================================ */

function requestNativeAppleSignIn() {
  if (window.webkit?.messageHandlers?.appleSignIn) {
    window.webkit.messageHandlers.appleSignIn.postMessage(null);
  } else if (window.AndroidBridge?.requestAppleSignIn) {
    window.AndroidBridge.requestAppleSignIn();
  } else {
    console.warn("Native Apple 로그인 브릿지를 찾을 수 없습니다.");
  }
}

function requestNativeGoogleSignIn() {
  if (window.AndroidBridge?.requestGoogleSignIn) {
    window.AndroidBridge.requestGoogleSignIn();
  } else if (window.webkit?.messageHandlers?.googleSignIn) {
    window.webkit.messageHandlers.googleSignIn.postMessage(null);
  } else {
    console.warn("Native Google 로그인 브릿지를 찾을 수 없습니다.");
  }
}

function usePlatform() {
  const [platform] = useState(() => {
    if (typeof navigator === "undefined") return "web";
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
    if (/Android/i.test(ua)) return "android";
    return "web"; // 데스크톱 브라우저 등 - 테스트 편의상 둘 다 노출
  });
  return platform;
}

function SignUp() {
  const platform = usePlatform();

  const [stepIndex, setStepIndex] = useState(0);

  // "auth" 단계 관련 상태
  const [authMethod, setAuthMethod] = useState(null); // "apple" | "google" | "manual"
  const [showManualNameInput, setShowManualNameInput] = useState(false);
  const [socialUser, setSocialUser] = useState(null); // { uid, name, email }
  const [nativeAuthLoading, setNativeAuthLoading] = useState(null); // "apple" | "google" | null

  const [name, setName] = useState("");
  const [role, setRole] = useState(null); // "parent" | "student"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const nameInputRef = useRef(null);

  useEffect(() => {
    if (showManualNameInput) nameInputRef.current?.focus();
  }, [showManualNameInput]);

  const goNext = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const goToRoleStep = () => setStepIndex(1);

  /* ------------------------------------------------------------
   * 네이티브 로그인 결과 수신
   * 네이티브가 window.onNativeAppleSignIn / window.onNativeGoogleSignIn /
   * window.onNativeSignInError 를 직접 호출합니다.
   * ------------------------------------------------------------ */
  useEffect(() => {
    window.onNativeAppleSignIn = async (payload) => {
      // payload: { idToken, rawNonce, email, name }
      setError("");
      setNativeAuthLoading("apple");
      try {
        const provider = new OAuthProvider("apple.com");
        const credential = provider.credential({
          idToken: payload.idToken,
          rawNonce: payload.rawNonce,
        });
        const result = await signInWithCredential(auth, credential);
        const user = result.user;

        const resolvedName = (payload.name || user.displayName || name || "").trim();
        const resolvedEmail = payload.email || user.email || "";

        setSocialUser({ uid: user.uid, name: resolvedName, email: resolvedEmail });
        setAuthMethod("apple");
        setName(resolvedName);
        setEmail(resolvedEmail);
        goToRoleStep();
      } catch (err) {
        setError(convertFirebaseError(err.code));
      } finally {
        setNativeAuthLoading(null);
      }
    };

    window.onNativeGoogleSignIn = async (payload) => {
      // payload: { idToken, email, name }
      setError("");
      setNativeAuthLoading("google");
      try {
        const credential = GoogleAuthProvider.credential(payload.idToken);
        const result = await signInWithCredential(auth, credential);
        const user = result.user;

        const resolvedName = (payload.name || user.displayName || name || "").trim();
        const resolvedEmail = payload.email || user.email || "";

        setSocialUser({ uid: user.uid, name: resolvedName, email: resolvedEmail });
        setAuthMethod("google");
        setName(resolvedName);
        setEmail(resolvedEmail);
        goToRoleStep();
      } catch (err) {
        setError(convertFirebaseError(err.code));
      } finally {
        setNativeAuthLoading(null);
      }
    };

    window.onNativeSignInError = (payload) => {
      // payload: { provider, message }
      setNativeAuthLoading(null);
      setError(payload?.message || "로그인 중 오류가 발생했습니다.");
    };

    window.onNativeSignInCancel = () => {
      // payload: { provider }
      setNativeAuthLoading(null);
    }

    return () => {
      delete window.onNativeAppleSignIn;
      delete window.onNativeGoogleSignIn;
      delete window.onNativeSignInError;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  /* ------------------------------------------------------------
   * Step 0: 인증 방법 선택
   * ------------------------------------------------------------ */

  const handleAppleAuth = useCallback(() => {
    setError("");
    setNativeAuthLoading("apple");
    requestNativeAppleSignIn();
    // 결과는 window.onNativeAppleSignIn 콜백에서 처리됩니다.
  }, []);

  const handleGoogleAuth = useCallback(() => {
    setError("");
    setNativeAuthLoading("google");
    requestNativeGoogleSignIn();
    // 결과는 window.onNativeGoogleSignIn 콜백에서 처리됩니다.
  }, []);

  const handleManualNameSubmit = (e) => {
    e.preventDefault();
    if (name.trim().length === 0) return;
    setAuthMethod("manual");
    goToRoleStep();
  };

  /* ------------------------------------------------------------
   * Step 1: 역할 선택
   * ------------------------------------------------------------ */

  const handleRoleSelect = (selected) => {
    setRole(selected);
    setTimeout(() => {
      if (authMethod === "apple" || authMethod === "google") {
        finalizeSocialSignup(selected);
      } else {
        goNext(); // manual → account 단계(이메일/비밀번호)로 진행
      }
    }, 350);
  };

  const finalizeSocialSignup = async (selectedRole) => {
    if (!socialUser) return;
    setLoading(true);
    setError("");
    try {
      // name/email이 빈 값이면 필드 자체를 뺍니다.
      // merge:true는 "payload에 있는 필드만 덮어쓴다"는 뜻이라, 빈 문자열을
      // 그대로 넣으면 기존에 저장된 값을 지워버릴 수 있습니다.
      const payload = {
        uid: socialUser.uid,
        role: selectedRole,
        provider: authMethod === "apple" ? "apple.com" : "google.com",
        createdAt: serverTimestamp(),
      };
      if (socialUser.name) payload.name = socialUser.name;
      if (socialUser.email) payload.email = socialUser.email;

      await setDoc(doc(db, "users", socialUser.uid), payload, { merge: true });
      alert(
        `${authMethod === "apple" ? "Apple" : "Google"} 계정으로 회원가입이 완료되었습니다!`
      );
    } catch (err) {
      setError("가입 정보를 저장하는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------
   * Step 2: 계정 정보 (직접 입력 경로만)
   * ------------------------------------------------------------ */

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: name.trim(),
        email: user.email,
        role,
        provider: "password",
        createdAt: serverTimestamp(),
      });

      alert("회원가입이 완료되었습니다!");
    } catch (err) {
      setError(convertFirebaseError(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-card">
        <header className="signup-header">
          <h1>회원가입</h1>
          <p className="signup-subtitle">
            {stepIndex === 0 && "먼저, 로그인 방법을 선택해주세요"}
            {stepIndex === 1 && `${name ? `${name}님, ` : ""}어떤 역할이신가요?`}
            {stepIndex === 2 && "마지막으로 계정 정보를 입력해주세요"}
          </p>
        </header>

        <div className="signup-step-area">
          {/* Step 0: 인증 방법 선택 */}
          <div className={`signup-step ${stepIndex === 0 ? "active" : "exited"}`}>
            <div className="auth-options">
              {platform !== "android" && (
                <button
                  type="button"
                  className="apple-signin-btn"
                  onClick={handleAppleAuth}
                  disabled={nativeAuthLoading !== null}
                >
                  <AppleLogo />
                  <span>{nativeAuthLoading === "apple" ? "처리 중..." : "Apple로 계속하기"}</span>
                </button>
              )}

              {platform !== "ios" && (
                <button
                  type="button"
                  className="google-signin-btn"
                  onClick={handleGoogleAuth}
                  disabled={nativeAuthLoading !== null}
                >
                  <GoogleLogo />
                  <span>{nativeAuthLoading === "google" ? "처리 중..." : "Google로 계속하기"}</span>
                </button>
              )}

              {!showManualNameInput && (
                <button
                  type="button"
                  className="manual-entry-btn"
                  onClick={() => setShowManualNameInput(true)}
                  disabled={nativeAuthLoading !== null}
                >
                  직접 입력하기
                </button>
              )}
            </div>

            {showManualNameInput && (
              <form className="manual-name-form" onSubmit={handleManualNameSubmit}>
                <input
                  ref={nameInputRef}
                  type="text"
                  className="signup-input"
                  placeholder="이름을 입력하세요"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <button
                  type="submit"
                  className={`signup-next-btn ${name.trim() ? "visible" : ""}`}
                >
                  다음 →
                </button>
              </form>
            )}

            {error && <p className="signup-error">{error}</p>}
          </div>

          {/* Step 1: 역할 선택 */}
          <div className={`signup-step ${stepIndex === 1 ? "active" : stepIndex > 1 ? "exited" : "hidden"}`}>
            <div className="role-options">
              <button
                type="button"
                className={`role-card role-parent ${role === "parent" ? "selected" : ""}`}
                onClick={() => handleRoleSelect("parent")}
                disabled={loading}
              >
                <span className="role-emoji">👩‍👧</span>
                <span className="role-label">학부모</span>
              </button>
              <button
                type="button"
                className={`role-card role-student ${role === "student" ? "selected" : ""}`}
                onClick={() => handleRoleSelect("student")}
                disabled={loading}
              >
                <span className="role-emoji">🎒</span>
                <span className="role-label">학생</span>
              </button>
            </div>
            {loading && (authMethod === "apple" || authMethod === "google") && (
              <p className="signup-progress-text">가입 처리 중...</p>
            )}
            {error && <p className="signup-error">{error}</p>}
          </div>

          {/* Step 2: 계정 정보 (직접 입력 경로만) */}
          <form
            className={`signup-step ${stepIndex === 2 ? "active" : "hidden"}`}
            onSubmit={handleSignUp}
          >
            <input
              type="email"
              className="signup-input"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              className="signup-input"
              placeholder="비밀번호 (6자 이상)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
            {error && <p className="signup-error">{error}</p>}
            <button type="submit" className="signup-submit-btn" disabled={loading}>
              {loading ? "가입 중..." : "회원가입"}
            </button>
          </form>
        </div>

        <div className="signup-progress">
          {STEPS.map((_, i) => (
            <span key={i} className={`progress-dot ${i === stepIndex ? "active" : ""}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AppleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.462 2.15-1.221 2.905-.826.826-2.107 1.463-3.2 1.383-.14-1.09.435-2.24 1.226-3.02C13.97.807 15.4.14 16.365 1.43ZM20.6 17.15c-.5 1.15-.74 1.66-1.38 2.68-.9 1.42-2.16 3.19-3.72 3.2-1.39.02-1.75-.9-3.63-.89-1.88.01-2.28.9-3.67.88-1.56-.02-2.75-1.61-3.65-3.03C1.9 17.17.9 13.2 2.28 10.54c.68-1.31 1.9-2.14 3.23-2.16 1.34-.02 2.13.9 3.62.9 1.48 0 2.2-.9 3.62-.88 1.15.02 2.4.63 3.28 1.72-2.88 1.58-2.41 5.71.57 6.99Z" />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.88-3c-1.08.73-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.64H1.27a12 12 0 0 0 0 10.72l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.6 4.59 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.64l4 3.09C6.22 6.87 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

function convertFirebaseError(code) {
  switch (code) {
    case "auth/email-already-in-use":
      return "이미 사용 중인 이메일입니다.";
    case "auth/invalid-email":
      return "올바른 이메일 형식이 아닙니다.";
    case "auth/weak-password":
      return "비밀번호는 6자 이상이어야 합니다.";
    case "auth/account-exists-with-different-credential":
      return "이미 다른 방식으로 가입된 이메일입니다.";
    case "auth/invalid-credential":
      return "인증 정보가 올바르지 않습니다. 다시 시도해주세요.";
    case "auth/user-disabled":
      return "비활성화된 계정입니다.";
    default:
      return "회원가입 중 오류가 발생했습니다.";
  }
}

export default SignUp;
