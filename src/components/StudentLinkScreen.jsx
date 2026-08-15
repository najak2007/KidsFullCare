// StudentLinkScreen.jsx
import { useState } from "react";
import { generateLinkCode } from "./generateLinkCode";
import "../css/StudentLinkScreen.css";
import "../css/CodeModal.css";


function StudentLinkScreen() {
  const [code, setCode] = useState(null);
  const [otploading, setOtploading] = useState(false);
  const [qrloading, setQrloading] = useState(false)
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(120);

  useEffect(() => {
    if (code) {
      setShowCodeModal(true);
      setRemainingSeconds(120);
    }
  }, [code]);

  useEffect(() => {
    if (!showCodeModal) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) { 
          clearInterval(timer);
          setShowCodeModal(false);
          setCode(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [showCodeModal]);

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 69);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`; 
  }

  const handleQRCodeGenerate = async () => {
    setQrloading(true);
    try {
      const newCode = await generateLinkCode();
      setCode(newCode);
    } catch (err) {
      console.error(err);
      alert("코드 생성에 실패했습니다.");
    } finally {
      setQrloading(false);
    }
  };

  const handleOneTimeCodeGenerate = async () => {
    setOtploading(true);
    try {
      const newCode = await generateLinkCode();
      setCode(newCode);
    } catch (err) {
      console.error(err);
      alert("코드 생성에 실패했습니다.");
    } finally {
      setOtploading(false);
    }
  };

  return (
    <div className="codeview-layout">
        <div className="create-btn-layout">
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
              {otploading ? "생성 중..." : "숫자 Code 생성"}
          </button>
        </div>
        {showCodeModal && code && (
          <div
            className="code-modal-overlay"
            onClick={() => setShowCodeModal(false)}
          >
            <div className="code-modal" onClick={(e) => e.stopPropagation()}>
              <p className="code-modal-label">이 코드를 학부모님께 알려주세요</p>
              <p className="code-modal-value">{code}</p>
              <p className="code-modal-timer">
                {formatTime(remainingSeconds)} 후 자동으로 닫힙니다</p>
              <button
                type="button"
                className="code-modal-dismiss-btn"
                onClick={() => setShowCodeModal(false)}
              >나중에
              </button>
            </div>
          </div>
        )};
    </div>
  );
}

export default StudentLinkScreen;