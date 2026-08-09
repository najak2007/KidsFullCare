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

import { useState, useEffect, useCallback } from "react";
import "../css/SignUp.css";
import "../css/SignUp-apple-addon.css";

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

function requestNativeSaveRole(role) {
  if (window.webkit?.messageHandlers?.roleSelect) {
    window.webkit.messageHandlers.roleSelect.postMessage(role);
  } else if (window.AndroidBridge?.saveRole) {
    window.AndroidBridge.saveRole(role);
  } else {
    console.warn("Native role 저장 브릿지를 찾을 수 없습니다.");
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

function SignUp() {
  const platform = usePlatform();

  // 네이티브가 알려주는 상태를 그대로 반영
  const [authState, setAuthState] = useState("checking");
  const [name, setName] = useState("");
  const [role, setRole] = useState(null);
  const [error, setError] = useState("");
  const [nativeLoading, setNativeLoading] = useState(null); // "apple" | "google" | "role" | null

  useEffect(() => {
    window.onNativeAuthState = (payload) => {
      setNativeLoading(null);
      setError("");
      setAuthState(payload.status);
      if (payload.name) setName(payload.name);
      if (payload.role) setRole(payload.role);
    };

    window.onNativeSignInError = (payload) => {
      setNativeLoading(null);
      setError(payload?.message || "오류가 발생했습니다.");
    };

    return () => {
      delete window.onNativeAuthState;
      delete window.onNativeSignInError;
    };
  }, []);

  const handleAppleAuth = useCallback(() => {
    setError("");
    setNativeLoading("apple");
    requestNativeAppleSignIn();
    // 결과는 window.onNativeAuthState 콜백으로 옵니다.
  }, []);

  const handleGoogleAuth = useCallback(() => {
    setError("");
    setNativeLoading("google");
    requestNativeGoogleSignIn();
  }, []);

  const handleRoleSelect = useCallback((selected) => {
    setRole(selected);
    setError("");
    setNativeLoading("role");
    requestNativeSaveRole(selected);
    // 저장 성공 시 window.onNativeAuthState({status:"loggedIn", role}) 콜백이 옵니다.
  }, []);

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
    // 실제 프로젝트에서는 여기서 라우터로 메인 화면으로 이동시키면 됩니다.
    return (
      <div className="signup-page">
        <div className="signup-card">
          <p>메인 화면 (role: {role})</p>
        </div>
      </div>
    );
  }

  return (
    <div className="signup-page">
      <div className="signup-card">
        <header className="signup-header">
          <h1>{authState === "loggedOut" ? "회원가입" : "역할 선택"}</h1>
          <p className="signup-subtitle">
            {authState === "loggedOut" && "로그인 방법을 선택해주세요"}
            {authState === "needsRole" && `${name ? `${name}님, ` : ""}어떤 역할이신가요?`}
          </p>
        </header>

        {authState === "loggedOut" && (
          <div className="auth-options">
            {platform !== "android" && (
              <button
                type="button"
                className="apple-signin-btn"
                onClick={handleAppleAuth}
                disabled={nativeLoading !== null}
              >
                <AppleLogo />
                <span>{nativeLoading === "apple" ? "처리 중..." : "Apple로 계속하기"}</span>
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
                <span>{nativeLoading === "google" ? "처리 중..." : "Google로 계속하기"}</span>
              </button>
            )}
          </div>
        )}

        {authState === "needsRole" && (
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

        {error && <p className="signup-error">{error}</p>}
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
