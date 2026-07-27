// ParentLinkScreen.jsx
import { useState } from "react";
import { linkToStudent } from "./linkToStudent";

function ParentLinkScreen() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLink = async (e) => {
    e.preventDefault();
    setStatus("");
    setLoading(true);
    try {
      await linkToStudent(code.trim());
      setStatus("연결에 성공했습니다!");
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLink}>
      <h2>자녀와 연결하기</h2>
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="6자리 코드 입력"
        maxLength={6}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? "연결 중..." : "연결하기"}
      </button>
      {status && <p>{status}</p>}
    </form>
  );
}

export default ParentLinkScreen;