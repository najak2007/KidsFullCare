// StudentLinkScreen.jsx
import { useState } from "react";
import { generateLinkCode } from "./generateLinkCode";
import "../css/StudentLinkScreen.css";

function StudentLinkScreen() {
  const [code, setCode] = useState(null);
  const [otploading, setOtploading] = useState(false);
  const [qrloading, setQrloading] = useState(false)

  const handleQRCodeGenerate = async () => {
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

  const handleOneTimeCodeGenerate = async () => {
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
      <button
        type="button"
        className="qrcode-create-btn" 
        onClick={handleQRCodeGenerate} disabled={qrloading}>
        {qrloading ? "생성 중..." : "QR Code 생성"}
      </button>

      <button 
        type="button"
        className="onetimecode-create-btn"
        onClick={handleOneTimeCodeGenerate} disabled={otploading}>
          {otploading ? "생성 중..." : "연결 코드 생성"}
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