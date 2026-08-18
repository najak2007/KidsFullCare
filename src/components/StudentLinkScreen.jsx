// StudentLinkScreen.jsx
import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { generateLinkCode } from "../services/generateLinkCode";
import "../css/StudentLinkScreen.css";
import "../css/CodeModal.css";


function StudentLinkScreen() {
  const [linkInfo, setLinkInfo] = useState(null);
  const [modalMode, setModalMode] = useState("numeric"); // "qr" | "numeric"

  const [otploading, setOtploading] = useState(false);
  const [qrloading, setQrloading] = useState(false)

  const [showCodeModal, setShowCodeModal] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(120); // 2분

  // code가 새로 생기면 모달을 열고 타이머를 리셋합니다.
  useEffect(() => {
    if (linkInfo) {
      setShowCodeModal(true);
      setRemainingSeconds(120);
    }
  }, [linkInfo]);

  // 1초마다 카운트다운, 0이 되면 자동으로 닫습니다.
  useEffect(() => {
    if (!showCodeModal) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowCodeModal(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showCodeModal]);

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleQRCodeGenerate = async () => {
    setQrloading(true);
    try {
      const info = await generateLinkCode();
      setModalMode("qr")
      setLinkInfo(info);
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
      const info = await generateLinkCode(); // { code, uid }
      setModalMode("numeric");
      setLinkInfo(info);
    } catch (e) {
      console.error(e);
      alert("코드 생성에 실패했습니다.");
    } finally {
      setOtploading(false);
    }
  };

  // QR에 넣을 값: 유니버설 링크 URL 형태로 인코딩합니다.
  // 카메라 앱으로 스캔하면 iOS/Android 둘 다 이 URL을 인식해서
  // (Associated Domains / App Links 설정이 되어 있다면) 앱을 직접 엽니다.
  // JSON 문자열로 인코딩하면 카메라 앱이 그냥 텍스트로만 보여주고 앱을 못 엽니다.
  const qrValue = linkInfo
    ? `https://kidsfullcare.app/link?code=${encodeURIComponent(linkInfo.code)}&uid=${encodeURIComponent(linkInfo.uid)}`
    : "";

  return (
    <div className="codeview-layout">
        <div className="create-btn-layout">
          <button
            type="button"
            className="qrcode-create-btn" 
            onClick={handleQRCodeGenerate} disabled={qrloading}>
              {qrloading ? "생성 중..." : "QR Code 생성"}
          </button>
        </div>
        {showCodeModal && linkInfo && (
          <div
            className="code-modal-overlay"
            onClick={() => setShowCodeModal(false)}
          >
            <div className="code-modal" onClick={(e) => e.stopPropagation()}>
              <p className="code-modal-label">이 코드를 학부모님께 보여주세요</p>
 
              {modalMode === "qr" ? (
                <div className="code-modal-qr">
                  <QRCodeSVG value={qrValue} size={200} includeMargin />
                    <p className="code-modal-qr-fallback">
                      코드: <strong>{linkInfo.code}</strong>
                    </p>
                </div>
              ) : (
                <p className="code-modal-value">{linkInfo.code}</p>
              )}

              <p className="code-modal-timer">
                {formatTime(remainingSeconds)} 후 자동으로 닫힙니다
              </p>

              <button
                type="button"
                className="code-modal-dismiss-btn"
                onClick={() => setShowCodeModal(false)}
              >나중에
              </button>
            </div>
          </div>
        )}
    </div>
  );
}

export default StudentLinkScreen;