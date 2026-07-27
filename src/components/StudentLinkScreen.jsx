// StudentLinkScreen.jsx
import { useState } from "react";
import { generateLinkCode } from "./generateLinkCode";

function StudentLinkScreen() {
  const [code, setCode] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const newCode = await generateLinkCode();
      setCode(newCode);
    } catch (err) {
      console.error(err);
      alert("코드 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>학부모 연결 코드</h2>
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? "생성 중..." : "연결 코드 생성"}
      </button>
      {code && (
        <p>
          이 코드를 학부모님께 알려주세요: <strong>{code}</strong>
        </p>
      )}
    </div>
  );
}

export default StudentLinkScreen;