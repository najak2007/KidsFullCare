// src/pages/SignUp.jsx
//
// 이 컴포넌트는 Firebase를 전혀 직접 다루지 않습니다.
// 네이티브(AuthGateViewModel)가 로그인 상태를 판단해서
// window.onNativeAuthState(payload)로 알려주면, 그 값에 따라
// 화면만 바꿔서 보여줍니다.
//
// payload 형태
//   { status: "checking" }
//   { status: "loggedOut" }
//   { status: "needsRole", name, email }
//   { status: "loggedIn", role }

import { useState, useEffect, useCallback, useRef } from "react";
import "../css/SignUp.css";
import "../css/SignUp-apple-addon.css";
import StudentLinkScreen from "./StudentLinkScreen"; // 실제 경로에 맞게 조정하세요

/* ------------------------------------------------------------
 * 네이티브 브릿지
 * ------------------------------------------------------------ */

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

function requestNativeSaveRole(role, extra = {}) {
  const payload = { role, ...extra };
  if (window.webkit?.messageHandlers?.roleSelect) {
    window.webkit.messageHandlers.roleSelect.postMessage(payload);
  } else if (window.AndroidBridge?.saveRole) {
    window.AndroidBridge.saveRole(JSON.stringify(payload));
  } else {
    console.warn("Native role 저장 브릿지를 찾을 수 없습니다.");
  }
}

function requestNativeEmailSignUp(email, password) {
  if (window.webkit?.messageHandlers?.emailSignUp) {
    window.webkit.messageHandlers.emailSignUp.postMessage({ email, password });
  } else if (window.AndroidBridge?.emailSignUp) {
    window.AndroidBridge.emailSignUp(email, password);
  } else {
    console.warn("Native 이메일 가입 브릿지를 찾을 수 없습니다.");
  }
}

function requestNativeEmailSignIn(email, password) {
  if (window.webkit?.messageHandlers?.emailSignIn) {
    window.webkit.messageHandlers.emailSignIn.postMessage({ email, password });
  } else if (window.AndroidBridge?.emailSignIn) {
    window.AndroidBridge.emailSignIn(email, password);
  } else {
    console.warn("Native 이메일 로그인 브릿지를 찾을 수 없습니다.");
  }
}

function notifyNativeReady() {
  // JS 리스너 등록이 끝났으니, 네이티브가 알고 있는 최신 상태를 다시 보내달라고 요청합니다.
  // (didFinish navigation 시점과 React 마운트 시점의 타이밍이 어긋나 상태를
  //  못 받는 경우를 막기 위한 핸드셰이크입니다.)
  if (window.webkit?.messageHandlers?.jsReady) {
    window.webkit.messageHandlers.jsReady.postMessage(null);
  } else if (window.AndroidBridge?.notifyReady) {
    window.AndroidBridge.notifyReady();
  }
}

function usePlatform() {
  const [platform] = useState(() => {
    if (typeof navigator === "undefined") return "web";
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
    if (/Android/i.test(ua)) return "android";
    return "web";
  });
  return platform;
}

/* ------------------------------------------------------------
 * 네이티브 에러 코드 → 사용자 메시지
 * (Swift 쪽에서 auth/xxx 형태의 code를 함께 보내줍니다)
 * ------------------------------------------------------------ */
function convertAuthErrorCode(code, fallbackMessage) {
  switch (code) {
    case "auth/email-already-in-use":
      return "이미 사용 중인 이메일입니다.";
    case "auth/invalid-email":
      return "올바른 이메일 형식이 아닙니다.";
    case "auth/weak-password":
      return "비밀번호는 6자 이상이어야 합니다.";
    case "auth/wrong-password":
      return "비밀번호가 올바르지 않습니다.";
    case "auth/user-not-found":
      return "가입되지 않은 이메일입니다.";
    case "auth/user-disabled":
      return "비활성화된 계정입니다.";
    case "auth/invalid-credential":
      return "이메일 또는 비밀번호가 올바르지 않습니다.";
    case "auth/account-exists-with-different-credential":
      return "이미 다른 방식으로 가입된 이메일입니다.";
    default:
      return fallbackMessage || "오류가 발생했습니다.";
  }
}

function SignUp() {
  const platform = usePlatform();

  // 네이티브가 알려주는 상태를 그대로 반영
  const [authState, setAuthState] = useState("checking");
  const [name, setName] = useState("");
  const [role, setRole] = useState(null);
  // "select": 역할 카드 선택 화면 / "studentLink": 학생 선택 후 추가 정보 입력 화면
  const [roleSubStep, setRoleSubStep] = useState("select");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(""); // 에러가 아닌 안내 메시지 (모드 자동 전환 시)
  const [nativeLoading, setNativeLoading] = useState(null); // "apple" | "google" | "role" | "email" | null

  // 직접 입력(이메일/비밀번호) 관련 상태
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualMode, setManualMode] = useState("login"); // "signup" | "login"
  const [manualEmail, setManualEmail] = useState("");
  const [manualPassword, setManualPassword] = useState("");
  const [manualPasswordConfirm, setManualPasswordConfirm] = useState("");
  const [hintReturningUser, setHintReturningUser] = useState(false);

  // useEffect(등록은 최초 1회) 안에서도 최신 manualMode 값을 읽기 위한 ref
  const manualModeRef = useRef(manualMode);
  useEffect(() => {
    manualModeRef.current = manualMode;
  }, [manualMode]);

  useEffect(() => {
    // 핀치(두 손가락) 줌 제스처 차단.
    // passive:false로 등록해야 preventDefault가 실제로 동작합니다.
    const blockPinch = (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    };

    document.addEventListener("touchmove", blockPinch, { passive: false });

    // iOS Safari/WKWebView의 제스처 이벤트(핀치 시작/변경/종료)도 함께 막습니다.
    const blockGesture = (e) => {
      e.preventDefault();
    };
    document.addEventListener("gesturestart", blockGesture, { passive: false });
    document.addEventListener("gesturechange", blockGesture, { passive: false });
    document.addEventListener("gestureend", blockGesture, { passive: false });

    return () => {
      document.removeEventListener("touchmove", blockPinch);
      document.removeEventListener("gesturestart", blockGesture);
      document.removeEventListener("gesturechange", blockGesture);
      document.removeEventListener("gestureend", blockGesture);
    };
  }, []);

  useEffect(() => {
    window.onNativeAuthState = (payload) => {
      setNativeLoading(null);
      setError("");
      setAuthState(payload.status);
      if (payload.name) setName(payload.name);
      if (payload.role) setRole(payload.role);
      if (payload.status === "loggedOut") {
        setHintReturningUser(!!payload.returningUser);
      }
    };

    window.onNativeSignInError = (payload) => {
      setNativeLoading(null);
      setError("");
      setNotice("");

      // 이메일/비밀번호 흐름에서, 에러 종류에 따라 로그인 ↔ 회원가입을 자동 전환합니다.
      if (payload?.provider === "email") {
        if (payload.code === "auth/user-not-found" && manualModeRef.current === "login") {
          setManualMode("signup");
          setManualPassword("");
          setManualPasswordConfirm("");
          setNotice("가입된 계정이 없어 회원가입으로 전환했어요. 비밀번호를 새로 설정해주세요.");
          return;
        }
        if (payload.code === "auth/email-already-in-use" && manualModeRef.current === "signup") {
          setManualMode("login");
          setManualPassword("");
          setManualPasswordConfirm("");
          setNotice("이미 가입된 이메일이에요. 로그인으로 진행할게요.");
          return;
        }
      }

      setError(convertAuthErrorCode(payload?.code, payload?.message));
    };

    notifyNativeReady();

    return () => {
      delete window.onNativeAuthState;
      delete window.onNativeSignInError;
    };
  }, []);

  const handleAppleAuth = useCallback(() => {
    setError("");
    setNativeLoading("apple");
    requestNativeAppleSignIn();
  }, []);

  const handleGoogleAuth = useCallback(() => {
    setError("");
    setNativeLoading("google");
    requestNativeGoogleSignIn();
  }, []);

  const handleRoleSelect = useCallback((selected) => {
    setRole(selected);
    setError("");

    if (selected === "student") {
      // 학생은 바로 저장하지 않고, 연결 코드 등 추가 정보를 먼저 입력받습니다.
      setRoleSubStep("studentLink");
      return;
    }

    // 학부모는 추가 정보가 필요 없으므로 바로 저장합니다.
    setNativeLoading("role");
    requestNativeSaveRole(selected);
  }, []);

  const handleStudentLinkComplete = useCallback((studentInfo) => {
    // studentInfo 예: { linkCode: "123456", grade: "3학년" } 등
    // StudentLinkScreen이 실제로 넘겨주는 필드에 맞게 사용하시면 됩니다.
    setError("");
    setNativeLoading("role");
    requestNativeSaveRole("student", studentInfo);
  }, []);

  const handleStudentLinkBack = useCallback(() => {
    setRoleSubStep("select");
    setRole(null);
  }, []);

  const resetManualForm = () => {
    setManualEmail("");
    setManualPassword("");
    setManualPasswordConfirm("");
    setError("");
    setNotice("");
  };

  const switchManualMode = (mode) => {
    setManualMode(mode);
    resetManualForm();
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (manualMode === "signup") {
      // 가입 시에는 비밀번호를 2번 입력받아 서로 같은지 확인합니다.
      if (manualPassword.length < 6) {
        setError("비밀번호는 6자 이상이어야 합니다.");
        return;
      }
      if (manualPassword !== manualPasswordConfirm) {
        setError("비밀번호가 서로 일치하지 않습니다.");
        return;
      }
      setNativeLoading("email");
      requestNativeEmailSignUp(manualEmail, manualPassword);
    } else {
      // 로그인 시에는 비밀번호를 1번만 입력받습니다.
      setNativeLoading("email");
      requestNativeEmailSignIn(manualEmail, manualPassword);
    }
  };

  // ---- 렌더링: authState 값 하나로만 분기 ----

  if (authState === "checking") {
    return (
      <div className="signup-page">
        <div className="signup-card">
          <p className="signup-progress-text">확인 중...</p>
        </div>
      </div>
    );
  }

  if (authState === "loggedIn") {
    return (
      <div className="signup-page">
        <div className="signup-card">
          <p>메인 화면 (role: {role})</p>
        </div>
      </div>
    );
  }

  if (authState === "signUp") {
    setAuthState("loggedOut");
    setManualMode("signup");
    setRole(null);
  }

  if (authState === "loginCancel") {
    setAuthState("loggedOut");
  }

  return (
    <div className="signup-page">
      <div className="signup-card">
        <header className="signup-header">
          <h1>
            {authState === "loggedOut"
              ? manualMode === "signup"
                ? "회원가입"
                : "로그인"
              : (authState === "needsRole" && roleSubStep === "studentLink") ? "인증방법 선택" : "역할 선택"}
          </h1>
          <p className="signup-subtitle">
            {authState === "loggedOut" && !showManualForm && (manualMode === "signup" ? "회원가입 방법을 선택해주세요." : "로그인 방법을 선택해주세요.")}
            {authState === "loggedOut" &&
              showManualForm &&
              (manualMode === "signup"
                ? "이메일과 비밀번호를 입력해주세요"
                : "이메일과 비밀번호로 로그인하세요")}
            {authState === "needsRole" &&  ((roleSubStep === "studentLink") ? `${name ? `${name}님, ` : ""} 엄마/아빠에게 보여줄 Code를 만들어 주세요` : `${name ? `${name}님, ` : ""}어떤 역할이신가요?`)}
          </p>
        </header>

        {authState === "loggedOut" && !showManualForm && (
          <div className="auth-options">
            {platform !== "android" && (
              <button
                type="button"
                className="apple-signin-btn"
                onClick={handleAppleAuth}
                disabled={nativeLoading !== null}
              >
                <AppleLogo />
                <span>{nativeLoading === "apple" ? "처리 중..." : manualMode === "signup" ? "Apple로 가입하기 " : "Apple로 계속하기"}</span>
              </button>
            )}
            {platform !== "ios" && (
              <button
                type="button"
                className="google-signin-btn"
                onClick={handleGoogleAuth}
                disabled={nativeLoading !== null}
              >
                <GoogleLogo />
                <span>{nativeLoading === "google" ? "처리 중..." : manualMode === "signup" ? "Google로 가입하기" : "Google로 계속하기"}</span>
              </button>
            )}
            <button
              type="button"
              className="manual-entry-btn"
              onClick={() => {
                // 이 기기가 예전에 가입한 적 있다는 신호(returningUser)가 있으면
                // 로그인 모드로, 없으면(첫 설치 등) 회원가입 모드로 시작합니다.
                setManualMode(hintReturningUser ? "login" : "signup");
                setShowManualForm(true);
              }}
              disabled={nativeLoading !== null}
            >
              직접 입력하기
            </button>
          </div>
        )}

        {authState === "loggedOut" && showManualForm && (
          <form className="manual-name-form" onSubmit={handleManualSubmit}>
            <input
              type="email"
              className="signup-input"
              placeholder="이메일"
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
              required
            />
            <input
              type="password"
              className="signup-input"
              placeholder="비밀번호 (6자 이상)"
              value={manualPassword}
              onChange={(e) => setManualPassword(e.target.value)}
              minLength={6}
              required
            />
            {manualMode === "signup" && (
              <input
                type="password"
                className="signup-input"
                placeholder="비밀번호 확인"
                value={manualPasswordConfirm}
                onChange={(e) => setManualPasswordConfirm(e.target.value)}
                minLength={6}
                required
              />
            )}

            {notice && <p className="signup-notice">{notice}</p>}
            {error && <p className="signup-error">{error}</p>}

            <button type="submit" className="signup-submit-btn" disabled={nativeLoading !== null}>
              {nativeLoading === "email"
                ? "처리 중..."
                : manualMode === "signup"
                ? "회원가입"
                : "로그인"}
            </button>

            <button
              type="button"
              className="manual-entry-btn"
              onClick={() => switchManualMode(manualMode === "signup" ? "login" : "signup")}
              disabled={nativeLoading !== null}
            >
              {manualMode === "signup"
                ? "이미 계정이 있으신가요? 로그인"
                : "계정이 없으신가요? 회원가입"}
            </button>

            <button
              type="button"
              className="manual-entry-btn"
              onClick={() => {
                setShowManualForm(false);
                resetManualForm();
              }}
              disabled={nativeLoading !== null}
            >
              ← 다른 방법으로 로그인
            </button>
          </form>
        )}

        {authState === "needsRole" && roleSubStep === "select" && (
          <div className="role-options">
            <button
              type="button"
              className={`role-card role-parent ${role === "parent" ? "selected" : ""}`}
              onClick={() => handleRoleSelect("parent")}
              disabled={nativeLoading !== null}
            >
              <span className="role-emoji">👩‍👧</span>
              <span className="role-label">학부모</span>
            </button>
            <button
              type="button"
              className={`role-card role-student ${role === "student" ? "selected" : ""}`}
              onClick={() => handleRoleSelect("student")}
              disabled={nativeLoading !== null}
            >
              <span className="role-emoji">🎒</span>
              <span className="role-label">학생</span>
            </button>
          </div>
        )}

        {authState === "needsRole" && roleSubStep === "studentLink" && (
          <StudentLinkScreen
            onComplete={handleStudentLinkComplete}
            onBack={handleStudentLinkBack}
            loading={nativeLoading === "role"}
          />
        )}

        {authState === "needsRole" && error && <p className="signup-error">{error}</p>}
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
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.88-3c-1.08.73-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.64H1.27a12 12 0 0 0 0 10.72l4-3.09Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.59 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.64l4 3.09C6.22 6.87 8.87 4.75 12 4.75Z" />
    </svg>
  );
}

export default SignUp;
