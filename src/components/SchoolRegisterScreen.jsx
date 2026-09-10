// src/pages/SchoolRegisterScreen.jsx
//
// MainScreen에서 onNavigate("schoolRegister")로 진입하는 화면입니다.
//
// 진행 순서
//   1) 학교 이름 입력 → Firebase Cloud Function(searchSchool)이 NEIS Open API를
//      호출해서 학교/주소 후보 리스트를 반환
//   2) 후보 중 하나 선택 → 상세 주소 확정
//   3) 학년 선택 → 저장 요청 (기존 네이티브 저장 브릿지 유지)
//
import { useState, useCallback, useRef, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase"; // firebase.js에서 만든 인스턴스 그대로 사용 (리전 일치 보장)
import "../css/SchoolRegisterScreen.css";

const searchSchoolFn = httpsCallable(functions, "searchSchool");

/* ------------------------------------------------------------
 * 네이티브 브릿지 (저장은 기존 방식 유지)
 * ------------------------------------------------------------ */

function requestNativeSaveSchoolRegister(schoolInfo) {
  // schoolInfo: { name, address, grade }
  if (window.webkit?.messageHandlers?.schoolRegisterSave) {
    window.webkit.messageHandlers.schoolRegisterSave.postMessage(schoolInfo);
  } else if (window.AndroidBridge?.schoolRegisterSave) {
    window.AndroidBridge.schoolRegisterSave(JSON.stringify(schoolInfo));
  } else {
    console.warn("Native 학교 등록 저장 브릿지를 찾을 수 없습니다.");
  }
}

// 학년 목록은 필요에 맞게 조정하세요 (초/중/고 구분이 필요하면 school.level 등으로 분기)
const GRADE_OPTIONS = ["1학년", "2학년", "3학년", "4학년", "5학년", "6학년"];

function SchoolRegisterScreen({ onBack, onComplete }) {
  // "search" → 학교 이름 검색 / "gradeSelect" → 주소 확정 후 학년 선택
  const [step, setStep] = useState("search");

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searched, setSearched] = useState(false); // 검색을 한 번이라도 시도했는지 (결과 없음 안내용)
  const [error, setError] = useState("");

  const [selectedSchool, setSelectedSchool] = useState(null); // { name, address, id }
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [saving, setSaving] = useState(false);

  const inputRef = useRef(null);

  useEffect(() => {
    // 저장 완료/실패는 여전히 네이티브 콜백으로 받습니다.
    window.onNativeSchoolRegisterComplete = () => {
      setSaving(false);
      onComplete?.({ school: selectedSchool, grade: selectedGrade });
    };

    window.onNativeSchoolRegisterError = (payload) => {
      setSaving(false);
      setError(payload?.message || "학교 등록 중 오류가 발생했습니다.");
    };

    return () => {
      delete window.onNativeSchoolRegisterComplete;
      delete window.onNativeSchoolRegisterError;
    };
    // selectedSchool/selectedGrade는 콜백 안에서 최신값을 참조해야 하므로 의존성에 포함
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchool, selectedGrade]);

  const handleSearch = useCallback(async (e) => {
    e?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }
    setError("");
    setSearching(true);
    setSearched(false);
    setSearchResults([]);

    console.warn("schoolName" + trimmed);

    try {
      const { data } = await searchSchoolFn({ schoolName: trimmed });

      if (data?.errorCode) {
        // NEIS 응답 코드가 정상(INFO-000)이 아닌 경우 - 결과 없음 등
        setSearchResults([]);
      } else {
        setSearchResults(data?.results || []);
      }
    } catch (err) {
      console.error("학교 검색 실패:", err);
      setError("학교 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }, [query]);

  const handleSelectSchool = useCallback((school) => {
    setSelectedSchool(school);
    setSelectedGrade(null);
    setError("");
    setStep("gradeSelect");
  }, []);

  const handleChangeSchool = useCallback(() => {
    setStep("search");
    setSelectedGrade(null);
  }, []);

  const handleSelectGrade = useCallback((grade) => {
    setSelectedGrade(grade);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!selectedSchool || !selectedGrade) return;
    setError("");
    setSaving(true);
    requestNativeSaveSchoolRegister({
      name: selectedSchool.name,
      address: selectedSchool.address,
      officeCode: selectedSchool.officeCode,
      schoolCode: selectedSchool.schoolCode,
      grade: selectedGrade,
    });
  }, [selectedSchool, selectedGrade]);

  // 화면 안에 단계가 있는 경우, 뒤로가기는 우선 이전 단계로 되돌립니다.
  // 검색 단계에서는 실제로 MainScreen으로 나가는 onBack을 호출합니다.
  const handleBackPress = useCallback(() => {
    if (step === "gradeSelect") {
      handleChangeSchool();
      return;
    }
    onBack?.();
  }, [step, handleChangeSchool, onBack]);

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
        <h1 className="school-register-title">학교 등록</h1>
        <span className="school-register-topbar-spacer" />
      </div>

      <div className="school-register-content">
        {step === "search" && (
          <>
            <p className="school-register-guide">
              다니고 있는 학교 이름을 입력해서 검색해주세요.
            </p>

            <form className="school-search-form" onSubmit={handleSearch}>
              <input
                ref={inputRef}
                type="text"
                className="school-search-input"
                placeholder="예) 한빛초등학교"
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
            </form>

            {error && <p className="school-register-error">{error}</p>}

            {searching && (
              <div className="school-search-status">
                <span className="school-search-spinner" />
                <span>학교를 찾고 있어요...</span>
              </div>
            )}

            {!searching && searched && searchResults.length === 0 && !error && (
              <p className="school-search-empty">
                검색 결과가 없어요. 학교 이름을 다시 확인해주세요.
              </p>
            )}

            {!searching && searchResults.length > 0 && (
              <ul className="school-result-list">
                {searchResults.map((school) => (
                  <li key={school.id ?? `${school.name}-${school.address}`}>
                    <button
                      type="button"
                      className="school-result-item"
                      onClick={() => handleSelectSchool(school)}
                    >
                      <span className="school-result-name">{school.name}</span>
                      <span className="school-result-address">{school.address}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {step === "gradeSelect" && selectedSchool && (
          <>
            <div className="school-selected-card">
              <div className="school-selected-info">
                <span className="school-selected-name">{selectedSchool.name}</span>
                <span className="school-selected-address">{selectedSchool.address}</span>
              </div>
              <button
                type="button"
                className="school-selected-change-btn"
                onClick={handleChangeSchool}
              >
                다시 검색
              </button>
            </div>

            <p className="school-register-guide">학년을 선택해주세요.</p>

            <div className="grade-grid">
              {GRADE_OPTIONS.map((grade) => (
                <button
                  key={grade}
                  type="button"
                  className={`grade-item ${selectedGrade === grade ? "selected" : ""}`}
                  onClick={() => handleSelectGrade(grade)}
                >
                  {grade}
                </button>
              ))}
            </div>

            {error && <p className="school-register-error">{error}</p>}

            <button
              type="button"
              className="school-register-submit-btn"
              onClick={handleSubmit}
              disabled={!selectedGrade || saving}
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

export default SchoolRegisterScreen;
