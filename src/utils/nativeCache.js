// src/utils/nativeCache.js
//
// 네트워크(Cloud Function)로 조회한 결과를 JS Interface 로 단말에 저장하고,
// 같은 조건으로 다시 조회할 때 단말에 저장된 값을 읽어오기 위한 유틸입니다.
//
//   JS → Native : schoolCacheGet  { requestId, key }
//                 schoolCacheSave { key, data, meta }   (meta: 어느 학교/학년/반의 데이터인지)
//   Native → JS : window.onNativeSchoolCache({ requestId, hit, savedAt, data, dateTimeEvents })
//
// 브릿지가 없거나(브라우저 개발 환경 등) 네이티브가 응답하지 않으면 "캐시 없음"으로 처리해서
// 호출한 쪽이 그대로 네트워크 조회를 하도록 합니다.

const pad = (n) => String(n).padStart(2, "0");
const toYmd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

const pendingRequests = new Map(); // requestId → resolve
let requestSeq = 0;

// 이 파일이 여러 번 로드되어도 (HMR 등) 중복 등록되지 않도록 가드합니다.
if (typeof window !== "undefined" && !window.__nativeSchoolCacheInstalled) {
  window.__nativeSchoolCacheInstalled = true;

  window.onNativeSchoolCache = (payload) => {
    const resolve = pendingRequests.get(payload?.requestId);
    if (!resolve) return; // 이미 타임아웃 처리된 요청
    pendingRequests.delete(payload.requestId);
    resolve(payload?.hit ? payload : null);
  };
}

function postToNative(name, body) {
  if (typeof window === "undefined") return false;

  if (window.webkit?.messageHandlers?.[name]) {
    window.webkit.messageHandlers[name].postMessage(body);
    return true;
  }
  if (window.AndroidBridge?.[name]) {
    window.AndroidBridge[name](JSON.stringify(body));
    return true;
  }
  return false;
}

/**
 * 캐시 key 를 만듭니다. 예) buildCacheKey("timetable", ["B10", "7010057", "3", "2", "20261116", "20261116"])
 */
export function buildCacheKey(type, parts) {
  return [type, ...parts.map((part) => String(part ?? ""))].join("|");
}

/**
 * 단말에 저장된 값을 읽어옵니다.
 * @returns {Promise<{ savedAt: number, data: any } | null>} 저장된 값이 없으면 null
 */
export function readNativeCache(key, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const requestId = `cache-${Date.now()}-${++requestSeq}`;

    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      resolve(null);
    }, timeoutMs);

    pendingRequests.set(requestId, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });

    if (!postToNative("schoolCacheGet", { requestId, key })) {
      clearTimeout(timer);
      pendingRequests.delete(requestId);
      resolve(null);
    }
  });
}

/**
 * 조회 결과를 단말에 저장합니다. (응답을 기다리지 않습니다)
 * @param {Object} meta - { eduOfficeCode, sdSchulCode, grade, classNm, startDate, endDate, school }
 *                        네이티브가 어느 학교(SchoolInfoData)에 저장할지 찾는 데 씁니다.
 */
export function saveNativeCache(key, data, meta = {}) {
  postToNative("schoolCacheSave", { key, data, meta });
}

/**
 * 저장된 값을 그대로 써도 되는지 판단합니다.
 *   - 조회 기간이 전부 지난 날짜(endYmd < 오늘) : 더 바뀌지 않으므로 계속 사용
 *   - 오늘/미래 날짜가 포함된 조회             : 변경될 수 있으므로 저장한 당일에만 사용
 */
export function isCacheFresh(savedAt, endYmd, now = new Date()) {
  if (!savedAt) return false;
  const today = toYmd(now);
  if (endYmd && endYmd < today) return true;
  return toYmd(new Date(savedAt)) === today;
}
