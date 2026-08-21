import { useState, useEffect, useCallback } from "react";
import "../css/AddLinkButton.css";

function requestNativeAddLink() {
    if (window.webkit?.messageHandlers?.addLinkQRCode) {
        window.webkit?.messageHandlers.addLinkQRCode.postMessage(null);
    } else if (window.AndroidBridge?.addLinkQRCode) {
        window.AndroidBridge.addLinkQRCode();
    } else {
        console.warn("Native QR Code 읽기/생성하는 브릿지를 찾을 수 없습니다.");
    }
}

function AddLinkButton({ value, onChange }) {
    const [ userId, setUserId] = useState(value || null);
    const responseUid = value !== undefined ? value : userId;

    useEffect(() => {
        window.onNativeAddLinkQRCode = (payload) => {
            if (!payload?.uid) return;
        };

        return () => {
            delete window.onNativeAddLinkQRCode;
        };
    }, [onChange]);

    const handleClick = useCallback(() => {
        requestNativeAddLink();
    }, []);

    return (
        <button 
            type="button"
            className="link-btn"
            onClick={handleClick}
        >
            🔗
        </button>
    );
}

export default AddLinkButton;