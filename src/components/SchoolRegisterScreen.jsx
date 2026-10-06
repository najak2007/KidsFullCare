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
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase"; // firebase.js에서 만든 인스턴스 그대로 사용 (리전 일치 보장)
import "../css/SchoolRegisterScreen.css";
import SchoolAppleMap from "./SchoolAppleMap";

const searchSchoolFn = httpsCallable(functions, "searchSchool");
const searchSchoolClassFn = httpsCallable(functions, "searchSchoolClass");
const schoolTimeTableFn = httpsCallable(functions, "schoolTimeTable");

/* ------------------------------------------------------------
 * 네이티브 브릿지 (저장은 기존 방식 유지)
 * ------------------------------------------------------------ */

function requestNativeSaveSchoolRegister(schoolInfo) {
  // schoolInfo: { name, address, grade }
  if (window.webkit?.messageHandlers?.studentMenuRegisterSave) {
    window.webkit.messageHandlers.studentMenuRegisterSave.postMessage(schoolInfo);
  } else if (window.AndroidBridge?.studentMenuRegisterSave) {
    window.AndroidBridge.studentMenuRegisterSave(JSON.stringify(schoolInfo));
  } else {
    console.warn("Native 학교 등록 저장 브릿지를 찾을 수 없습니다.");
  }
}

// 학년 목록은 필요에 맞게 조정하세요 (초/중/고 구분이 필요하면 school.level 등으로 분기)
const GRADE_OPTIONS = ["1학년", "2학년", "3학년", "4학년", "5학년", "6학년"];
const FALLBACK_CLASS_OPTIONS = Array.from({ length: 15 }, (_, i) => String(i + 1));
const SCHOOL_MENUS = ["시간표", "급식식단", "학사일정"];

function SchoolRegisterScreen({ onBack, userUid, role, onComplete, screenKey, schoolInfo }) {
  // "search" → 학교 이름 검색 / "gradeSelect" → 주소 확정 후 학년 선택
  const [step, setStep] = useState("search");

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searched, setSearched] = useState(false); // 검색을 한 번이라도 시도했는지 (결과 없음 안내용)
  const [error, setError] = useState("");

  const [selectedSchool, setSelectedSchool] = useState(schoolInfo || null); // { name, address, id }
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [selectedClass, setSelectedClass] = useState("");
  const [mapStatus, setMapStatus] = useState("loading"); // loading | ready | notfound | error
  const [saving, setSaving] = useState(false);

  const [classSearching, setClassSearching] = useState(false);
  const [classSearchResults, setClassSearchResults] = useState([]);
  const [classSearched, setClassSearched] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedMenu, setSelectedMenu] = useState("");
  const [schoolTimeTable, setSchoolTimeTable] = useState([]);

  const inputRef = useRef(null);

  useEffect(() => {
    setSelectedClassId("");
  }, [classSearchResults]);

  useEffect(() => {
    console.info("SchoolRegisterScreen mounted. screenKey = " + screenKey + " schoolInfo = " + JSON.stringify(schoolInfo));

    if (selectedSchool && selectedSchool.register && selectedSchool.GRADE && selectedSchool.CLASS) {
      setSelectedGrade(selectedSchool.GRADE);
      setSelectedClass(selectedSchool.CLASS);
      setStep("schoolRegisterComplete");
    }
  }, [selectedSchool]);


  useEffect(() => {
    // 저장 완료/실패는 여전히 네이티브 콜백으로 받습니다.
    window.onNativeschoolRegisterComplete = () => {
      setSaving(false);

      onComplete?.({ screenKey: screenKey});
    };

    window.onNativeschoolRegisterError = (payload) => {
      setSaving(false);
      setError(payload?.message || "학교 등록 중 오류가 발생했습니다.");
    };

    return () => {
      delete window.onNativeschoolRegisterComplete;
      delete window.onNativeschoolRegisterError;
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

  const handleSearchSchoolClass = useCallback(async (school, grade) => {
    setError("");
    setClassSearching(true);
    setClassSearched(false);
    setClassSearchResults([]);

    try {
      const { data } = await searchSchoolClassFn( {eduOfficeCode: school.ATPT_OFCDC_SC_CODE, sdSchulCode: school.SD_SCHUL_CODE, grade: String(parseInt(grade, 10))} );

      if (data?.errorCode) {
        console.error("errorCode =" + errorCode);
        setClassSearchResults([]);
      } else {
        setClassSearchResults(data?.results || []);
      }
    } catch (err) {
      console.error("학급 정보 조회 실패:", err);
      setError("학급 정보 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setClassSearching(false);
      setClassSearched(true);
    }

  }, []);

  const handleSelectSchool = useCallback((school) => {
    setSelectedSchool(school);
    setSelectedGrade(null);
    setSelectedClass("");
    setError("");
    setStep("gradeSelect");
  }, []);

  const handleChangeSchool = useCallback(() => {
    setStep("search");
    setSelectedGrade(null);
    setSelectedClass("");
    setClassSearchResults([]);
    setClassSearched(false);
  }, []);

  const handleSelectGrade = useCallback((school, grade) => {
    setSelectedGrade(grade);
    setSelectedClass("");

    handleSearchSchoolClass(school, grade);
  }, []);

  const handleSearchSchoolTimeTable = useCallback(async (selectedSchool) => {

    try {
      const { data } = await schoolTimeTableFn({ 
        eduOfficeCode: selectedSchool.ATPT_OFCDC_SC_CODE,
        sdSchulCode: selectedSchool.SD_SCHUL_CODE,
        grade: selectedSchool.CLASS.GRADE,
        classNm: selectedSchool.CLASS.CLASS_NM,
        schoolKinkNm: selectedSchool.SCHUL_KND_SC_NM
       }); 
      if (data?.errorCode) {
        setSchoolTimeTable([]);
      } else {
        setSchoolTimeTable(data?.results || []);
      }
    } catch (err) {
      console.error("학교 시간표 검색 실패: ", err);
      setError("학교 시간표 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {

    }

  }, [])

  const handleSelectMenu = useCallback((selectedSchool, menu) => {
    setSelectedMenu(menu);

    switch(menu) {
      case "시간표":
        handleSearchSchoolTimeTable(selectedSchool);
        break;
      case "급식식단":
        break;
      case "학사일정":
        break;
    }
  }, []);

  const handleResetMenu = useCallback(() => {
    setSelectedMenu("");
  }, []);

/*
  const classOptions = useMemo(() => {
    const names = classSearchResults.map((r) => r.CLASS_NM).filter(Boolean);
    const unique = [...new Set(names)].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    return unique.length > 0 ? unique : FALLBACK_CLASS_OPTIONS;
  }, [classSearchResults]);
*/
  const classOptions = useMemo(() => {
    if (classSearchResults.length === 0) {
      // 조회 결과가 없을 때의 fallback (원본 항목이 없으므로 isFallback 표시)
      return FALLBACK_CLASS_OPTIONS.map((nm) => ({
        id: `fallback-${nm}`,
        CLASS_NM: nm,
        isFallback: true,
      }));
    }
    return [...classSearchResults]    // 원본 배열을 변경하지 않도록 복사
      .filter((r) => r.CLASS_NM)
      .sort((a, b) => parseInt(a.CLASS_NM, 10) - parseInt(b.CLASS_NM, 10))

  }, [classSearchResults]);

  const selectedClassItem = useMemo(() => classSearchResults.find((r) => r.id === selectedClassId) ?? null, 
    [selectedClassId, classSearchResults]
  ); 

  const handleResetGrade = useCallback(() => {
    setSelectedGrade(null);
    setSelectedClass("");
  }, []);

  const handleSubmit = useCallback(() => {
    if (!selectedSchool || !selectedGrade || !selectedClassId) return;
    setError("");
    setSaving(true);
    requestNativeSaveSchoolRegister({
      KEY: screenKey === null ? "school" : screenKey,
      SCHUL_NM: selectedSchool.SCHUL_NM ?? "",
      ORG_RDNMA: selectedSchool.ORG_RDNMA ?? "",
      ORG_RDNDA: selectedSchool.ORG_RDNDA ?? "",
      ATPT_OFCDC_SC_CODE: selectedSchool.ATPT_OFCDC_SC_CODE ?? "",
      ATPT_OFCDC_SC_NM: selectedSchool.ATPT_OFCDC_SC_NM ?? "",
      SD_SCHUL_CODE: selectedSchool.SD_SCHUL_CODE ?? "",
      SCHUL_KND_SC_NM: selectedSchool. SCHUL_KND_SC_NM ?? "",
      LCTN_SC_NM: selectedSchool.LCTN_SC_NM ?? "",
      JU_ORG_NM: selectedSchool.JU_ORG_NM ?? "",
      FOND_YMD: selectedSchool.FOND_YMD ?? "",
      FOND_SC_NM: selectedSchool.FOND_SC_NM ?? "",
      ORG_TELNO: selectedSchool.ORG_TELNO ?? "",
      FOAS_MEMRD: selectedSchool.FOAS_MEMRD ?? "",
      GRADE: selectedGrade,
//      CLASS: selectedClass,
      CLASS: selectedClassItem,
      label: selectedSchool.SCHUL_NM ?? "",
      register: true
    });
  }, [selectedSchool, selectedGrade, selectedClassId, screenKey]);

  // 화면 안에 단계가 있는 경우, 뒤로가기는 우선 이전 단계로 되돌립니다.
  // 검색 단계에서는 실제로 MainScreen으로 나가는 onBack을 호출합니다.
  const handleBackPress = useCallback(() => {
    if (step === "gradeSelect") {
      handleChangeSchool();
      return;
    }
    onBack?.();
  }, [step, handleChangeSchool, onBack]);

  const handleMapStatusChange = useCallback((newStatus) => {
    setMapStatus(newStatus);
  }, []);

  const getGradeNumber = (grade) => parseInt(grade, 10);

  const visibleGrades = GRADE_OPTIONS.filter(
    (grade) => getGradeNumber(grade) <= (selectedSchool?.schoollevel === "2" ? 3 : GRADE_OPTIONS.length)
  );

// 기존 로직 (문자열 → "N반" 등)
  const formatClassName = (name) => `${name}반`;   // 기존 formatClassLabel 내용을 여기에 그대로

//  const formatClassLabel = (cls) => (/^\d+$/.test(cls) ? `${cls}반` : cls);
  const formatClassLabel = (cls) =>
  `${formatClassName(cls.CLASS_NM)}${cls.DDDEP_NM ? ` (${cls.DDDEP_NM})` : ""}`;

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
        <h1 className="school-register-title"> {schoolInfo?.SCHUL_NM || "학교 등록"}</h1>
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
                  <li key={school.id ?? `${school.SCHUL_NM}-${school.ORG_RDNMA}`}>
                    <button
                      type="button"
                      className="school-result-item"
                      onClick={() => handleSelectSchool(school)}
                    >
                      <span className="school-result-name">{school.SCHUL_NM}</span>
                      <span className="school-result-address">{school.ORG_RDNMA}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {
          step === "schoolRegisterComplete" && selectedSchool && (
            <>
            <div className={`school-info-menu-grid ${selectedMenu ? "school-info-menu-grid--selected" : ""}`}>
              { SCHOOL_MENUS.map((menu) => (
                <button
                  key={menu}
                  type="button"
                  className={`school-info-menu-item ${selectedMenu === menu ? "selected" : ""}`}
                  onClick={() => (selectedMenu ? handleResetMenu() : handleSelectMenu(selectedSchool, menu))}
                >
                  {menu}
                </button>
              ))}
            </div>
            
            <SchoolAppleMap
              address={selectedSchool.ORG_RDNMA}
              schoolName={selectedSchool.SCHUL_NM}
              handleMapStatus={handleMapStatusChange} /><p> {selectedSchool.CLASS.ATPT_OFCDC_SC_NM ?? ""} </p></>
        )}  
        

        {step === "gradeSelect" && selectedSchool && (
          <>
            <div className="school-selected-card">
              <div className="school-selected-info">
                <span className="school-selected-name">{selectedSchool.SCHUL_NM}</span>
                <span className="school-selected-address">{selectedSchool.ORG_RDNMA}</span>
              </div>
              <button
                type="button"
                className="school-selected-change-btn"
                onClick={handleChangeSchool}
              >
                다시 검색
              </button>
            </div>

            <p className="school-register-guide">학년과 반을 선택해주세요.</p>

            <div className={`grade-grid ${selectedGrade ? "grade-grid--selected" : ""}`}>
              {(selectedGrade ? [selectedGrade] : visibleGrades).map((grade) => (
                <button
                  key={grade}
                  type="button"
                  className={`grade-item ${selectedGrade === grade ? "selected" : ""}`}
                  onClick={() => (selectedGrade ? handleResetGrade() : handleSelectGrade(selectedSchool, grade))}
                >
                  {grade}
                </button>
              ))}

              { selectedGrade && classSearching && (
                <div className="class-search-status">
                  <span className="class-search-spinner" />
                  <span>학급 정보를 불러오는 중...</span>
                </div>
              )}

              {selectedGrade && classSearched && (
                <select
                  className="class-select"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  aria-label="반 선택"
                >
                  <option value="" disabled>반 선택</option>
                    { classOptions.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {formatClassLabel(cls)}
                      </option>
                    ))}
                </select>
              )}
            </div>

            <SchoolAppleMap 
              address={selectedSchool.ORG_RDNMA}
              schoolName={selectedSchool.SCHUL_NM}
              handleMapStatus={handleMapStatusChange}
            />

            {error && <p className="school-register-error">{error}</p>}

            <button
              type="button"
              className="school-register-submit-btn"
              onClick={handleSubmit}
              disabled={!selectedGrade || !selectedClassId || saving || mapStatus !== "ready"}
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
