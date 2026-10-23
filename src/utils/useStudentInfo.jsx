import { useEffect, useRef, useState } from "react";

function postToNative(action, payload = {}) {
  const msg = { action, ...payload };
  if (window.webkit?.messageHandlers?.nativeBridge) {
    window.webkit.messageHandlers.nativeBridge.postMessage(msg);   // iOS
  } else if (window.Android?.postMessage) {
    window.Android.postMessage(JSON.stringify(msg));               // Android
  }
}

export function useStudentInfo(studentUid, onRegistered) {
    const [studentInfo, setStudentInfo] = useState(null);
    const prevRef = useRef(undefined);
    const onRegisteredRef = useRef(onRegistered);
    onRegisteredRef.current = onRegistered;

    useEffect(() => {
        if(!studentUid) {
            return;
        }
        prevRef.current = undefined;

        const handler = (e) => {
            const { studentUid: uid, studentInfo: info } = e.detail || {};
            if (uid !== studentUid) {
                return;
            }

            const prev = prevRef.current;
            if (prev !== undefined && !prev && info) {
                onRegisteredRef.current?.(info);
            }
            prevRef.current = info ?? null;
        };

        window.addEventListener("native:studentInfo", handler);
        postToNative("subscribeStudentInfo", { studentUid });

        return () => {
            window.removeEventListener("native:studentInfo", handler);
            postToNative("unsubscribeStudentInfo", { studentUid });
        };
    }, [studentUid]);

    return studentInfo;
}