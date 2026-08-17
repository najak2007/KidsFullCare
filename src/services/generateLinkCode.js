function requestNativeGenerateLinkCode() {
  if (window.webkit?.messageHandlers?.generateLinkCode) {
    window.webkit.messageHandlers.generateLinkCode.postMessage(null);
    return true;
  }
  if (window.AndroidBridge?.generateLinkCode) {
    window.AndroidBridge.generateLinkCode();
    return true;
  }
  return false;
}
 
export function generateLinkCode() {
  return new Promise((resolve, reject) => {
    const sent = requestNativeGenerateLinkCode();
    if (!sent) {
      reject(new Error("Native 코드 생성 브릿지를 찾을 수 없습니다."));
      return;
    }
 
    // 이전에 등록된 핸들러가 있다면 보존해뒀다가, 처리 후 복원합니다.
    // (다른 화면에서 동시에 이 콜백을 쓰고 있을 가능성을 대비)
    const previousHandler = window.onNativeLinkCodeResult;
 
    const cleanup = () => {
      window.onNativeLinkCodeResult = previousHandler;
    };
 
    window.onNativeLinkCodeResult = (payload) => {
      cleanup();
      if (payload?.code && payload?.uid) {
        resolve({ code: payload.code, uid: payload.uid || "" });
      } else {
        reject(new Error(payload?.message || "코드 생성에 실패했습니다."));
      }
    };
  });
}