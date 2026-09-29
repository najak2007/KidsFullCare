// src/pages/AcademyRegisterScreen.jsx
//
// MainScreen에서 onNavigate("academyRegister")로 진입하는 화면입니다.
//
// 진행 순서
//   1) 시도교육청 선택(풀다운) + 학원 이름 입력 → Firebase Cloud Function(searchAcademy)이
//      NEIS Open API(학원교습소정보)를 호출해서 학원/주소 후보 리스트를 반환
//   2) 후보 중 하나 선택 → 상세 주소 확정 + 지도(AcademyAppMap) 확인
//   3) 등록 완료 → 저장 요청 (기존 네이티브 저장 브릿지 방식 유지)
//
// ※ NEIS 학원교습소정보 API는 시도교육청 코드(ATPT_OFCDC_SC_CODE)가 필수 파라미터라서
//   시도교육청 선택을 검색 단계에 넣었습니다.
import { useState, useCallback, useRef, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase"; // firebase.js에서 만든 인스턴스 그대로 사용 (리전 일치 보장)
import "../css/SchoolRegisterScreen.css";
import "../css/AcademyRegisterScreen.css";
import AcademyAppMap from "./AcademyAppMap";

const searchAcademyFn = httpsCallable(functions, "searchAcademy");

/* ------------------------------------------------------------
 * 시도교육청 목록 (NEIS ATPT_OFCDC_SC_CODE)
 * ------------------------------------------------------------ */
export const EDU_OFFICES = [
  { code: "B10", name: "서울특별시교육청" },
  { code: "C10", name: "부산광역시교육청" },
  { code: "D10", name: "대구광역시교육청" },
  { code: "E10", name: "인천광역시교육청" },
  { code: "F10", name: "광주광역시교육청" },
  { code: "G10", name: "대전광역시교육청" },
  { code: "H10", name: "울산광역시교육청" },
  { code: "I10", name: "세종특별자치시교육청" },
  { code: "J10", name: "경기도교육청" },
  { code: "K10", name: "강원특별자치도교육청" },
  { code: "M10", name: "충청북도교육청" },
  { code: "N10", name: "충청남도교육청" },
  { code: "P10", name: "전북특별자치도교육청" },
  { code: "Q10", name: "전라남도교육청" },
  { code: "R10", name: "경상북도교육청" },
  { code: "S10", name: "경상남도교육청" },
  { code: "T10", name: "제주특별자치도교육청" },
];

/* ------------------------------------------------------------
 * 네이티브 브릿지 (저장은 기존 방식 유지)
 * ------------------------------------------------------------ */

function requestNativeSaveAcademyRegister(academyInfo) {
  if (window.webkit?.messageHandlers?.studentMenuRegisterSave) {
    window.webkit.messageHandlers.studentMenuRegisterSave.postMessage(academyInfo);
  } else if (window.AndroidBridge?.studentMenuRegisterSave) {
    window.AndroidBridge.studentMenuRegisterSave(JSON.stringify(academyInfo));
  } else {
    console.warn("Native 학원 등록 저장 브릿지를 찾을 수 없습니다.");
  }
}

function AcademyRegisterScreen({ onBack, userUid, role, onComplete, screenKey }) {
  // "search" → 교육청 선택 + 학원 이름 검색 / "confirm" → 주소/지도 확인 후 등록
  const [step, setStep] = useState("search");

  const [eduOfficeCode, setEduOfficeCode] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  const [selectedAcademy, setSelectedAcademy] = useState(null);
  const [mapStatus, setMapStatus] = useState("loading"); // loading | ready | notfound | error
  const [saving, setSaving] = useState(false);

  const inputRef = useRef(null);

  useEffect(() => {
    // 저장 완료/실패는 네이티브 콜백으로 받습니다.
    window.onNativeacademyRegisterComplete = () => {
      setSaving(false);
      onComplete?.({ screenKey: screenKey });
    };

    window.onNativeacademyRegisterError = (payload) => {
      setSaving(false);
      setError(payload?.message || "학원 등록 중 오류가 발생했습니다.");
    };

    return () => {
      delete window.onNativeacademyRegisterComplete;
      delete window.onNativeacademyRegisterError;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAcademy]);

  const handleSearch = useCallback(
    async (e) => {
      e?.preventDefault();
      if (!eduOfficeCode) {
        setError("시도교육청을 먼저 선택해주세요.");
        return;
      }
      const trimmed = query.trim();
      if (!trimmed) {
        inputRef.current?.focus();
        return;
      }
      setError("");
      setSearching(true);
      setSearched(false);
      setSearchResults([]);

      try {
        const { data } = await searchAcademyFn({
          academyName: trimmed,
          eduOfficeCode,
        });

        if (data?.errorCode) {
          // NEIS 응답 코드가 정상(INFO-000)이 아닌 경우 - 결과 없음 등
          setSearchResults([]);
        } else {
          setSearchResults(data?.results || []);
        }
      } catch (err) {
        console.error("학원 검색 실패:", err);
        setError("학원 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      } finally {
        setSearching(false);
        setSearched(true);
      }
    },
    [query, eduOfficeCode]
  );

  const handleSelectAcademy = useCallback((academy) => {
    setSelectedAcademy(academy);
    setMapStatus("loading");
    setError("");
    setStep("confirm");
  }, []);

  const handleChangeAcademy = useCallback(() => {
    setStep("search");
  }, []);

  const handleSubmit = useCallback(() => {
    if (!selectedAcademy) return;
    setError("");
    setSaving(true);
    requestNativeSaveAcademyRegister({
      KEY: screenKey ?? "academy",
      ACA_NM: selectedAcademy.ACA_NM ?? "",
      ACA_ASNUM: selectedAcademy.ACA_ASNUM ?? "",
      ACA_INSTI_SC_NM: selectedAcademy.ACA_INSTI_SC_NM ?? "",
      REALM_SC_NM: selectedAcademy.REALM_SC_NM ?? "",
      LE_ORD_NM: selectedAcademy.LE_ORD_NM ?? "",
      FA_RDNMA: selectedAcademy.FA_RDNMA ?? "",
      FA_RDNDA: selectedAcademy.FA_RDNDA ?? "",
      FA_RDNZC: selectedAcademy.FA_RDNZC ?? "",
      ADMST_ZONE_NM: selectedAcademy.ADMST_ZONE_NM ?? "",
      ATPT_OFCDC_SC_CODE: selectedAcademy.ATPT_OFCDC_SC_CODE ?? "",
      ATPT_OFCDC_SC_NM: selectedAcademy.ATPT_OFCDC_SC_NM ?? "",
      REG_STTUS_NM: selectedAcademy.REG_STTUS_NM ?? "",
      ROLE: role ?? "",
      USER_UID: userUid ?? "",
      label: selectedAcademy.ACA_NM ?? "",
      register: true,
    });
  }, [selectedAcademy, screenKey, role, userUid]);

  // 화면 안에 단계가 있는 경우, 뒤로가기는 우선 이전 단계로 되돌립니다.
  const handleBackPress = useCallback(() => {
    if (step === "confirm") {
      handleChangeAcademy();
      return;
    }
    onBack?.();
  }, [step, handleChangeAcademy, onBack]);

  const handleMapStatusChange = useCallback((newStatus) => {
    setMapStatus(newStatus);
  }, []);

  return (
    <div className="school-register-screen">
      <div className="school-register-topbar">
        <button
          type="button"
          className="school-register-back-btn"
          onClick={handleBackPress}
          aria-label="뒤로"
        >
          <BackArrowIcon />
        </button>
        <h1 className="school-register-title">학원 등록</h1>
        <span className="school-register-topbar-spacer" />
      </div>

      <div className="school-register-content">
        {step === "search" && (
          <>
            <p className="school-register-guide">
              시도교육청을 고르고, 다니고 있는 학원 이름을 검색해주세요.
            </p>

            <form className="school-search-form academy-search-form" onSubmit={handleSearch}>
              <select
                className="academy-edu-select"
                value={eduOfficeCode}
                onChange={(e) => {
                  setEduOfficeCode(e.target.value);
                  setError("");
                }}
                aria-label="시도교육청 선택"
              >
                <option value="">시도교육청 선택</option>
                {EDU_OFFICES.map((office) => (
                  <option key={office.code} value={office.code}>
                    {office.name}
                  </option>
                ))}
              </select>

              <div className="academy-search-row">
                <input
                  ref={inputRef}
                  type="text"
                  className="school-search-input"
                  placeholder="예) 한빛수학학원"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  enterKeyHint="search"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="school-search-btn"
                  disabled={searching}
                >
                  {searching ? "검색 중..." : "검색"}
                </button>
              </div>
            </form>

            {error && <p className="school-register-error">{error}</p>}

            {searching && (
              <div className="school-search-status">
                <span className="school-search-spinner" />
                <span>학원을 찾고 있어요...</span>
              </div>
            )}

            {!searching && searched && searchResults.length === 0 && !error && (
              <p className="school-search-empty">
                검색 결과가 없어요. 교육청과 학원 이름을 다시 확인해주세요.
              </p>
            )}

            {!searching && searchResults.length > 0 && (
              <ul className="school-result-list">
                {searchResults.map((academy) => (
                  <li
                    key={
                      academy.id ??
                      `${academy.ATPT_OFCDC_SC_CODE}-${academy.ACA_ASNUM}`
                    }
                  >
                    <button
                      type="button"
                      className="school-result-item"
                      onClick={() => handleSelectAcademy(academy)}
                    >
                      <span className="school-result-name">{academy.ACA_NM}</span>
                      <span className="school-result-address">
                        {academy.FA_RDNMA}
                        {academy.FA_RDNDA ? ` ${academy.FA_RDNDA}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {step === "confirm" && selectedAcademy && (
          <>
            <div className="school-selected-card">
              <div className="school-selected-info">
                <span className="school-selected-name">{selectedAcademy.ACA_NM}</span>
                <span className="school-selected-address">
                  {selectedAcademy.FA_RDNMA}
                  {selectedAcademy.FA_RDNDA ? ` ${selectedAcademy.FA_RDNDA}` : ""}
                </span>
                <span className="academy-selected-meta">
                  {[selectedAcademy.ATPT_OFCDC_SC_NM, selectedAcademy.REALM_SC_NM]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <button
                type="button"
                className="school-selected-change-btn"
                onClick={handleChangeAcademy}
              >
                다시 검색
              </button>
            </div>

            <AcademyAppMap
              address={selectedAcademy.FA_RDNMA}
              academyName={selectedAcademy.ACA_NM}
              handleMapStatus={handleMapStatusChange}
            />

            {error && <p className="school-register-error">{error}</p>}

            <button
              type="button"
              className="school-register-submit-btn"
              onClick={handleSubmit}
              disabled={saving || mapStatus !== "ready"}
            >
              {saving ? "등록 중..." : "등록 완료"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function BackArrowIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 5L8 12L15 19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default AcademyRegisterScreen;
