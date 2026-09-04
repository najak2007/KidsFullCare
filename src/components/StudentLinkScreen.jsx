// StudentLinkScreen.jsx
import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { generateLinkCode } from "../services/generateLinkCode";
import "../css/StudentLinkScreen.css";
import "../css/CodeModal.css";


function requestNativeQRCodeAuthTimeLimit(code) {
  if (window.webkit?.messageHandlers?.qrCodeAuthTimeLimit) {
    window.webkit.messageHandlers.qrCodeAuthTimeLimit.postMessage(code);
  } else if (window.AndroidBridge?.qrCodeAuthTimeLimit) {
    window.AndroidBridge.qrCodeAuthTimeLimit(code);
  } else {
    console.warn("Native QR 코드 인증 시간 제한 브릿지를 찾을 수 없습니다.");
  }
}

function StudentLinkScreen({ onComplete, onBack, loading, directShow }) {
  const [linkInfo, setLinkInfo] = useState(null);
  const [modalMode, setModalMode] = useState("numeric"); // "qr" | "numeric"

  const [qrloading, setQrloading] = useState(false);

  const [showCodeModal, setShowCodeModal] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(120); // 2분
  const [authCompleteName, setAuthCompleteName] = useState(null); // 연결된 학부모 이름
  const [linkCodeResult, setLinkCodeResult] = useState(null); // { code, uid, name } or null

  const handleQRCodeGenerate = useCallback(async () => {
    setQrloading(true);
    try {
      const info = await generateLinkCode();
      setModalMode("qr");
      setLinkInfo(info);
      requestNativeQRCodeAuthTimeLimit(info.code);
    } catch (err) {
      console.error(err);
      alert("코드 생성에 실패했습니다.");
    } finally {
      setQrloading(false);
    }
  }, []);

  useEffect(() => {
    if (directShow) {
      handleQRCodeGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 마운트 시 1회만 실행

  // code가 새로 생기면 모달을 열고 타이머를 리셋합니다.
  useEffect(() => {
    if (linkInfo) {
      setShowCodeModal(true);
      setRemainingSeconds(120);
    }
  }, [linkInfo]);

  // 1초마다 카운트다운, 0이 되면 자동으로 닫습니다.
  useEffect(() => {
    if (!showCodeModal) {
      return;
    }
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (directShow) {
            onBack();
          }
          setShowCodeModal(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showCodeModal]);

  useEffect(() => {
    window.onNativeQRCodeAuthComplete = (payload) => {
      setShowCodeModal(false);
      setLinkCodeResult(payload?.result || "");
      setAuthCompleteName(payload?.name || "");
    };

    return () => {
      delete window.onNativeQRCodeAuthComplete;
    };
  }, []);

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleLinkCodeResult = useCallback((linkResult) => {
    setAuthCompleteName(null);
    if (linkResult === "추가" || linkResult === "중복") {
      onComplete({ nextStep: true });
    }
  }, [onComplete]);

  const handleCancel = useCallback(() => {
    if(directShow) {
      onBack();
    }
    setShowCodeModal(false);

  }, [onBack]);

  // QR에 넣을 값: 유니버설 링크 URL 형태로 인코딩합니다.
  const qrValue = linkInfo
    ? `https://kidsfullcare.web.app/share?code=${encodeURIComponent(linkInfo.code)}&uid=${encodeURIComponent(linkInfo.uid)}&name=${encodeURIComponent(linkInfo.name)}`
    : "";

  // 보여줄 게 없으면 렌더링 자체를 하지 않음 (Portal이어도 불필요한 빈 노드 방지)
  if (!showCodeModal && authCompleteName === null) {
    return null;
  }

  const content = (
    <div className="codeview-layout">
      <div className="create-btn-layout">
        {!directShow && (
          <button
            type="button"
            className="qrcode-create-btn"
            onClick={handleQRCodeGenerate}
            disabled={qrloading}
          >
            {qrloading ? "생성 중..." : "QR Code 생성"}
          </button>
        )}
      </div>

      {showCodeModal && linkInfo && (
        <div
          className="code-modal-overlay"
          onClick={() => handleCancel()}
        >
          <div className="code-modal" onClick={(e) => e.stopPropagation()}>
            <p className="code-modal-label">이 코드를 부모님께 보여주세요</p>

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
              onClick={() => handleCancel()}
            >
              나중에
            </button>
          </div>
        </div>
      )}

      {authCompleteName !== null && (
        <div
          className="code-modal-overlay"
          onClick={() => handleLinkCodeResult(linkCodeResult)}
        >
          <div className="code-modal" onClick={(e) => e.stopPropagation()}>
            <div className="code-modal-success-icon">✓</div>
            <p className="code-modal-label">
              {linkCodeResult
                ? linkCodeResult === "중복"
                  ? "인증 상태입니다."
                  : "인증이 완료되었습니다."
                : ""}
            </p>
            <p className="code-modal-value code-modal-success-name">
              {authCompleteName ? `${authCompleteName}님` : "학부모님"}
            </p>
            <p className="code-modal-qr-fallback">
              {linkCodeResult === "중복" ? "과 이미 인증 상태입니다." : "과 연결되었습니다"}
            </p>

            <button
              type="button"
              className="code-modal-dismiss-btn code-modal-success-btn"
              onClick={() => handleLinkCodeResult(linkCodeResult)}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
}

export default StudentLinkScreen;