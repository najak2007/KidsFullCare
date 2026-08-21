// src/components/ProfileImageButton.jsx
import { useState, useEffect, useCallback } from "react";
import "../css/ProfileImageButton.css";

function requestNativeProfileImagePicker() {
  if (window.webkit?.messageHandlers?.pickProfileImage) {
    window.webkit.messageHandlers.pickProfileImage.postMessage(null);
  } else if (window.AndroidBridge?.pickProfileImage) {
    window.AndroidBridge.pickProfileImage();
  } else {
    console.warn("Native 이미지 선택 브릿지를 찾을 수 없습니다.");
  }
}

/**
 * 텍스트 대신 프로필 사진을 보여주는 버튼입니다.
 * 클릭하면 네이티브가 "카메라로 촬영 / 앨범에서 선택" 액션시트를 띄우고,
 * 고른 이미지를 base64로 인코딩해서 돌려줍니다.
 *
 * props
 * - value: 현재 이미지(base64 data URL). 부모가 상태를 들고 있고 싶으면 사용.
 * - onChange: 새 이미지(base64 data URL)를 선택했을 때 호출.
 */
function ProfileImageButton({ value, onChange }) {
  const [internalImage, setInternalImage] = useState(value || null);
  const image = value !== undefined ? value : internalImage;

  useEffect(() => {
    window.onNativeProfileImagePicked = (payload) => {
      if (!payload?.imageBase64) { 
        setInternalImage(null);
        onChange?.(null);
        return;
      }
      const dataUrl = `data:image/jpeg;base64,${payload.imageBase64}`;
      setInternalImage(dataUrl);
      onChange?.(dataUrl);
    };

    return () => {
      delete window.onNativeProfileImagePicked;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange]);

  const handleClick = useCallback(() => {
    requestNativeProfileImagePicker();
  }, []);

  return (
    <button
      type="button"
      className="profile-btn"
      onClick={handleClick}
      style={image ? { backgroundImage: `url(${image})` } : undefined}
      aria-label="프로필 사진 변경"
    >
      {!image && <span className="profile-btn-placeholder">👤</span>}
    </button>
  );
}

export default ProfileImageButton;
