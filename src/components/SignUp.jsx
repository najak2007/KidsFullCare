import { useState, useRef, useEffect } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import "../css/SignUp.css";

const STEPS = ["name", "role", "account"];

function SignUp() {
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState("");
  const [role, setRole] = useState(null); // "parent" | "student"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (stepIndex === 0) nameInputRef.current?.focus();
  }, [stepIndex]);

  const goNext = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (name.trim().length === 0) return;
    goNext();
  };

  const handleRoleSelect = (selected) => {
    setRole(selected);
    setTimeout(goNext, 350); // 선택 애니메이션 보여준 뒤 자연스럽게 다음 단계로
  };

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
{/*      <div className="signup-blob blob-1" />
      <div className="signup-blob blob-2" />
      <div className="signup-blob blob-3" /> */}

      <div className="signup-card">
        <header className="signup-header">
          <h1>회원가입</h1>
          <p className="signup-subtitle">
            {stepIndex === 0 && "먼저, 이름을 알려주세요"}
            {stepIndex === 1 && `${name}님, 어떤 역할이신가요?`}
            {stepIndex === 2 && "마지막으로 계정 정보를 입력해주세요"}
          </p>
        </header>

        <div className="signup-step-area">
          {/* Step 1: 이름 */}
          <form
            className={`signup-step ${stepIndex === 0 ? "active" : "exited"}`}
            onSubmit={handleNameSubmit}
          >
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

          {/* Step 2: 역할 선택 */}
          <div className={`signup-step ${stepIndex === 1 ? "active" : stepIndex > 1 ? "exited" : "hidden"}`}>
            <div className="role-options">
              <button
                type="button"
                className={`role-card role-parent ${role === "parent" ? "selected" : ""}`}
                onClick={() => handleRoleSelect("parent")}
              >
                <span className="role-emoji">👩‍👧</span>
                <span className="role-label">학부모</span>
              </button>
              <button
                type="button"
                className={`role-card role-student ${role === "student" ? "selected" : ""}`}
                onClick={() => handleRoleSelect("student")}
              >
                <span className="role-emoji">🎒</span>
                <span className="role-label">학생</span>
              </button>
            </div>
          </div>

          {/* Step 3: 계정 정보 */}
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

function convertFirebaseError(code) {
  switch (code) {
    case "auth/email-already-in-use":
      return "이미 사용 중인 이메일입니다.";
    case "auth/invalid-email":
      return "올바른 이메일 형식이 아닙니다.";
    case "auth/weak-password":
      return "비밀번호는 6자 이상이어야 합니다.";
    default:
      return "회원가입 중 오류가 발생했습니다.";
  }
}

export default SignUp;