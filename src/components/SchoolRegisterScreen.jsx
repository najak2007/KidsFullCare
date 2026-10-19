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
import DateRangePickerModal, { toYmd } from "../pages/DateRangePickerModal";
import { formatDateWithChevron } from "../utils/DateExtension";


const searchSchoolFn = httpsCallable(functions, "searchSchool");
const searchSchoolClassFn = httpsCallable(functions, "searchSchoolClass");
const schoolTimeTableFn = httpsCallable(functions, "schoolTimeTable");
const schoolLunchFn = httpsCallable(functions, "schoolLunch");
const schoolEventsFn = httpsCallable(functions, "schoolEvents");

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

function requestNativeCheckHoliday(ymd) {

  console.info("requestNativeCheckHoliday ymd = " + ymd);

  if (window.webkit?.messageHandlers?.getHolidays) { 
    window.webkit.messageHandlers.getHolidays.postMessage( ymd );
  } else if (window.AndroidBridge?.getHolidays) {
    window.AndroidBridge.getHolidays(JSON.stringify( ymd ));
  } else {
    console.warn("Native 휴일 확인 브릿지를 찾을 수 없습니다.");
  }
}

// 학년 목록은 필요에 맞게 조정하세요 (초/중/고 구분이 필요하면 school.level 등으로 분기)
const GRADE_OPTIONS = ["1학년", "2학년", "3학년", "4학년", "5학년", "6학년"];
const FALLBACK_CLASS_OPTIONS = Array.from({ length: 15 }, (_, i) => String(i + 1));
const SCHOOL_MENUS = ["시간표", "급식식단", "학사일정"];
const GRADE_EVENT_FIELDS = {
    1: "ONE_GRADE_EVENT_YN",
    2: "TW_GRADE_EVENT_YN",
    3: "THREE_GRADE_EVENT_YN",
    4: "FR_GRADE_EVENT_YN",
    5: "FIV_GRADE_EVENT_YN",
    6: "SIX_GRADE_EVENT_YN",
};


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
  const [selectedMenu, setSelectedMenu] = useState(SCHOOL_MENUS[0]); // "시간표"
  const [schoolTimeTable, setSchoolTimeTable] = useState([]);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState({startDate: "", endDate: ""});
  const [timeTableLoading, setTimeTableLoading] = useState(false);
  const [lunchLoading, setLunchLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [schoolLunchTable, setSchoolLunchTable] = useState([]);
  const [schoolEventTable, setSchoolEventTable] = useState([]);
  const [isHoliday, setIsHoliday] = useState(true); // 선택한 날짜의 툐/일요일 여부 확인
  const [geoCoord, setGeoCoord] = useState(null);

  const inputRef = useRef(null);

  const todayLabel = useMemo(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}년 ${month}월 ${day}일 ›`; 
  }, []);

  const handleConfirmDateRange = useCallback(( {startDate, endDate}) => {

    console.info("handleConfirmDateRange startDate = " + startDate + "  endDate = " + endDate);
    setIsHoliday(true);

    if (startDate === endDate) {
      requestNativeCheckHoliday(startDate);
    } else {
      setIsHoliday(false);
    }
    setDateRange({startDate, endDate});
    setDateModalOpen(false);
  }, []);

  useEffect(() => {
    setSelectedClassId("");
  }, [classSearchResults]);

  useEffect(() => {
    if (selectedSchool && selectedSchool.register && selectedSchool.GRADE && selectedSchool.CLASS) {
      setSelectedGrade(selectedSchool.GRADE);
      setSelectedClass(selectedSchool.CLASS);
      setStep("schoolRegisterComplete");
      requestNativeCheckHoliday(toYmd(new Date()));
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

    window.onNativeHoliday = (payload) => {
      setIsHoliday(payload.isHoliday);
    };

    return () => {
      delete window.onNativeschoolRegisterComplete;
      delete window.onNativeschoolRegisterError;
      delete window.onNativeHoliday;
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
    setGeoCoord(null);

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
        console.error("errorCode =" + data.errorCode);
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
    setGeoCoord(null);
  }, []);

  const handleSelectGrade = useCallback((school, grade) => {
    setSelectedGrade(grade);
    setSelectedClass("");

    handleSearchSchoolClass(school, grade);
  }, []);

  
  const handleSearchSchoolTimeTable = useCallback(async (school, range, holiday) => {
    const today = toYmd(new Date());
    const fromYmd = range?.startDate || today;
    const toYmdValue = range?.endDate || fromYmd;

    setError("");

    if (holiday) {
      setSchoolTimeTable([]);
      return;
    }

    setTimeTableLoading(true);

    try {
      const { data } = await schoolTimeTableFn({ 
        eduOfficeCode: school.ATPT_OFCDC_SC_CODE,
        sdSchulCode: school.SD_SCHUL_CODE,
        grade: school.CLASS.GRADE,
        classNm: school.CLASS.CLASS_NM,
        schoolKindNm: school.SCHUL_KND_SC_NM,
        startDate: fromYmd,
        endDate: toYmdValue
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
      setTimeTableLoading(false);
    }
  }, [])

  const handleSearchSchoolLunch = useCallback(async (school, range, holiday) => {
    setError("");

    if (holiday) {
      setSchoolLunchTable([]);
      return;
    }

    setLunchLoading(true);

    try {
      const { data } = await schoolLunchFn({
        eduOfficeCode: school.ATPT_OFCDC_SC_CODE,
        sdSchulCode: school.SD_SCHUL_CODE,
        startDate: range?.startDate || toYmd(new Date()),
        endDate: range?.endDate || toYmd(new Date())
      });

      if (data?.errorCode) {
        setSchoolLunchTable([]);
      } else {
        setSchoolLunchTable(data?.results || []);
      }
    } catch (err) {
      console.error("학교 급식식단 검색 실패: ", err);
      setError("학교 급식식단 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLunchLoading(false);
    }
  }, []);

  const handleSearchSchoolEvents = useCallback(async (school, range) => {
    console.warn("학사일정 검색: " + school.SCHUL_NM + "  " + school.ATPT_OFCDC_SC_CODE + "  " + school.SD_SCHUL_CODE + "  " + range?.startDate + "  " + range?.endDate);
    setError("");
    setEventsLoading(true);

    try {
      const { data } = await schoolEventsFn({
        eduOfficeCode: school.ATPT_OFCDC_SC_CODE,
        sdSchulCode: school.SD_SCHUL_CODE,
        startDate: range?.startDate || toYmd(new Date()),
        endDate: range?.endDate || toYmd(new Date())
      });

      if (data?.errorCode) {
        setSchoolEventTable([]);
      } else {
        setSchoolEventTable(data?.results || []);
      }
    } catch (err) {
      console.error("학교 학사일정 검색 실패: ", err);
      setError("학교 학사일정 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const handleSelectMenu = useCallback((menu) => {
    setSelectedMenu(menu);
  }, []);

  const handleSearchSchoolScheduleInfo = useCallback(async (school, range, menu, holiday) => {
    console.info("handleSearchSchoolScheduleInfo menu = " + menu + " range.startDate = " + range.startDate + "  range.endDate = " + range.endDate + "  holiday = " + holiday);

    if (menu === "시간표") {
      await handleSearchSchoolTimeTable(school, range, holiday);
    } else if (menu === "급식식단") {   
      await handleSearchSchoolLunch(school, range, holiday);
    } else if (menu === "학사일정") { 
      await handleSearchSchoolEvents(school, range);
    }
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
    setGeoCoord(null);
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
      CLASS: selectedClassItem,
      label: selectedSchool.SCHUL_NM ?? "",
      address: selectedSchool.ORG_RDNMA ?? "",
      UID: selectedSchool.id,
      latitude: geoCoord.latitude,
      longitude: geoCoord.longitude,
      name: selectedSchool.SCHUL_NM ?? "",
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

  const handleMapSelectedGeocode = useCallback((coord) => {

    console.log("handleMapSelectedGeocode " + coord.latitude + " longitude = " + coord.longitude);

    setGeoCoord(coord);
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

  const timeTableGrid = useMemo(() => {
    // 1. ITRT_CNTNT가 비어있지 않은 유효한 데이터만 필터링
    const validData = schoolTimeTable.filter(
      (r) => r.ITRT_CNTNT && r.ITRT_CNTNT.trim() !== ""
    );

    // 데이터가 아예 없는 경우 빈 상태 반환
    if (validData.length === 0) {
      return { dates: [], periods: [], cells: {} };
    }

    // 2. 유효한 데이터 기준으로 일자 추출 및 정렬
    const dates = [...new Set(validData.map((r) => r.ALL_TI_YMD))]
      .filter(Boolean)
      .sort();

    // 3. 유효한 데이터 기준으로 최대 교시 계산
    const maxPeriod = validData.reduce(
      (max, r) => Math.max(max, parseInt(r.PERIO, 10) || 0),
      0
    );

    const periods = Array.from({ length: maxPeriod }, (_, i) => i + 1);

    // 4. 셀 데이터 맵 생성
    const cells = {};
    validData.forEach((r) => {
      const key = `${r.ALL_TI_YMD}-${parseInt(r.PERIO, 10)}`;
      (cells[key] ||= []).push(r.ITRT_CNTNT);
    });

    return { dates, periods, cells };
  }, [schoolTimeTable]);

  const mealByDate = useMemo(() => {
    const mealMap = {};
    schoolLunchTable.forEach((meal) => {
      (mealMap[meal.MLSV_YMD] ||= []).push(meal);
    });

    return Object.keys(mealMap)
        .sort()
        .map((ymd) => ({
          ymd,
          meals: mealMap[ymd].sort((a, b) => Number(a.MMEAL_SC_CODE) - Number(b.MMEAL_SC_CODE)),  // 아침, 점심, 저녁 순서
        }));
  }, [schoolLunchTable]);

  const eventsByDate = useMemo(() => {
    const gradeNum = parseInt(selectedGrade, 10);
    const gradeField = GRADE_EVENT_FIELDS[gradeNum];

    const map = {};
    schoolEventTable.forEach((e) => {
      // 등록한 학년에 해당하지 않는 행사는 제외 (학년 정보가 없으면 전부 표시)
      if (gradeField && e[gradeField] === "N") return;
      (map[e.AA_YMD] ||= []).push(e);
    });

    return Object.keys(map)
      .sort()
      .map((ymd) => ({ ymd, events: map[ymd] }));
  }, [schoolEventTable, selectedGrade]);

  const formatTimeTableHeader = (ymd) => {
    const d = new Date(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8));
    const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
    return `${ymd.slice(4, 6)}/${ymd.slice(6, 8)} (${weekday})`;
  };

  useEffect(() => {
    console.warn("SchoolRegisterScreen useEffect isHoliday = " + isHoliday);

    if (step === "schoolRegisterComplete" && selectedSchool && selectedMenu) {
      handleSearchSchoolScheduleInfo(selectedSchool, dateRange, selectedMenu, isHoliday);
    }
  }, [step, selectedMenu, selectedSchool, dateRange, isHoliday, handleSearchSchoolScheduleInfo]);

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
            <SchoolAppleMap
              address={selectedSchool.ORG_RDNMA}
              schoolName={selectedSchool.SCHUL_NM}
              handleMapStatus={handleMapStatusChange} />

            <div className="school-date-row">
              <button
                type="button"
                className="school-date-btn"
                onClick={() => setDateModalOpen(true)}>
                  {
                      dateRange.startDate ? (dateRange.startDate === dateRange.endDate ? `${formatDateWithChevron(dateRange.startDate)}` : `${formatDateWithChevron(dateRange.startDate)} ~ ${formatDateWithChevron(dateRange.endDate)}`) : `${todayLabel}`
                  }
              </button>
            </div>

            <DateRangePickerModal 
              open={dateModalOpen}
              initialStart={dateRange.startDate}
              initialEnd={dateRange.endDate}
              onClose={() => setDateModalOpen(false)}
              onConfirm={handleConfirmDateRange}
            />


        
          <div className="school-tabs">
            <div className="school-tab-list" role="tablist">
              {SCHOOL_MENUS.map((menu, index) => {
                const active = selectedMenu === menu;
                return (
                  <button
                    key={menu}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`school-tab ${active ? "active" : ""}`}
                    style={{ zIndex: active ? SCHOOL_MENUS.length + 1 : SCHOOL_MENUS.length - index }}
                    onClick={() => handleSelectMenu(menu)}
                  >
                    {menu}
                  </button>
                );
              })}
            </div>

            <div
              className={`school-tab-panel ${selectedMenu === SCHOOL_MENUS[0] ? "school-tab-panel--first" : ""}`}
              role="tabpanel"
            >
              {selectedMenu === "시간표" && (
                timeTableLoading ? (
                  <div className="school-search-status">
                    <span className="school-search-spinner" />
                    <span>시간표를 불러오는 중...</span>
                  </div>
                ) : timeTableGrid.periods.length === 0 ? (
                  <p className="school-tab-empty">{ isHoliday === true ? "휴일입니다." : "선택한 기간의 시간표가 없어요." }</p>
                ) : (
                  <div className="timetable-scroll">
                    <table className="timetable">
                      {timeTableGrid.dates.length > 1 && (
                        <thead>
                          <tr>
                            <th />
                            {timeTableGrid.dates.map((ymd) => (
                              <th key={ymd}>{formatTimeTableHeader(ymd)}</th>
                            ))}
                          </tr>
                        </thead>
                      )}
                      <tbody>
                        {timeTableGrid.periods.map((period) => (
                          <tr key={period}>
                            <th className="timetable-period" scope="row">{period}교시</th>
                            {timeTableGrid.dates.map((ymd) => {
                              const subject = timeTableGrid.cells[`${ymd}-${period}`]?.join(", ");
                              return (
                                <td key={ymd} className={subject ? "" : "timetable-empty"}>
                                  {subject ?? "-"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {selectedMenu === "급식식단" && (
                lunchLoading ? (
                  <div className="school-search-status">
                    <span className="school-search-spinner" />
                    <span>급식 정보를 불러오는 중...</span>
                  </div>
                ) : mealByDate.length === 0 ? (
                  <p className="school-tab-empty">{ isHoliday === true ? "휴일입니다." : "선택한 기간의 급식 정보가 없어요." }</p>
                ) : (
                  <div className="meal-list">
                    {mealByDate.map(({ ymd, meals }) => (
                      <section key={ymd} className="meal-day">
                        {mealByDate.length > 1 && (
                          <h3 className="meal-day-title">{formatTimeTableHeader(ymd)}</h3>
                        )}
                        {meals.map((meal) => (
                          <MealCard key={meal.id ?? `${ymd}-${meal.MMEAL_SC_CODE}`} meal={meal} />
                        ))}
                      </section>
                    ))}
                  </div>
                )
              )}

              {selectedMenu === "학사일정" && (
                eventsLoading ? (
                  <div className="school-search-status">
                    <span className="school-search-spinner" />
                    <span>학사일정을 불러오는 중...</span>
                  </div>
                ) : eventsByDate.length === 0 ? (
                  <p className="school-tab-empty">선택한 기간의 학사일정이 없어요.</p>
                ) : (
                  <div className="meal-list">
                    {eventsByDate.map(({ ymd, events }) => (
                      <EventDayCard key={ymd} ymd={ymd} events={events} />
                    ))}
                  </div>
                )
              )}            
            </div>
          </div>

          </>
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
              onCoordinate={handleMapSelectedGeocode}
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

/* ------------------------------------------------------------
 * 급식 표시용 helper
 * ------------------------------------------------------------ */

const splitBr = (text) =>
  (text ?? "").split(/<br\s*\/?>/i).map((s) => s.trim()).filter(Boolean);

// "돈까스(ㅋㅋㅋ) (5.6.10)" → { name: "돈까스(ㅋㅋㅋ)", allergies: "5·6·10" }
// 이름 안의 괄호는 그대로 두고, 끝의 숫자 괄호만 알레르기 정보로 분리
function parseDishes(text) {
  return splitBr(text).map((line) => {
    const m = line.match(/^(.*?)\s*\(([\d.]+)\)\s*$/);
    const rawName = m ? m[1] : line;
    return {
      name: rawName.replace(/\*+/g, "").trim(),
      allergies: m ? m[2].split(".").filter(Boolean).join("·") : "",
    };
  });
}

// "탄수화물(g) : 72.4" → { label: "탄수화물(g)", value: "72.4" }
function parseInfoLines(text) {
  return splitBr(text).map((line) => {
    const idx = line.indexOf(" : ");
    return idx < 0
      ? { label: line, value: "" }
      : { label: line.slice(0, idx), value: line.slice(idx + 3) };
  });
}

const MACRO_LABELS = ["탄수화물", "단백질", "지방"];

function splitUnit(label) {
  const m = label.match(/^(.*?)\((.*)\)$/);
  return m ? { name: m[1], unit: m[2] } : { name: label, unit: "" };
}

function MealCard({ meal }) {
  const dishes = parseDishes(meal.DDISH_NM);
  const nutrients = parseInfoLines(meal.NTR_INFO);
  const origins = parseInfoLines(meal.ORPLC_INFO);
  const macros = nutrients.filter((n) => MACRO_LABELS.some((k) => n.label.startsWith(k)));

  return (
    <article className="meal-card">
      <header className="meal-card-header">
        <span className={`meal-badge meal-badge--${meal.MMEAL_SC_CODE}`}>
          {meal.MMEAL_SC_NM}
        </span>
        {meal.CAL_INFO && <span className="meal-kcal">{meal.CAL_INFO}</span>}
      </header>

      <ul className="meal-dish-list">
        {dishes.map((dish, i) => (
          <li key={`${dish.name}-${i}`} className="meal-dish">
            <span className="meal-dish-name">{dish.name}</span>
            {dish.allergies && <span className="meal-dish-allergy">{dish.allergies}</span>}
          </li>
        ))}
      </ul>

      {macros.length > 0 && (
        <div className="meal-macros">
          {macros.map((n) => {
            const { name, unit } = splitUnit(n.label);
            return (
              <div key={n.label} className="meal-macro">
                <span className="meal-macro-label">{name}</span>
                <strong>{n.value}{unit}</strong>
              </div>
            );
          })}
        </div>
      )}

      {nutrients.length > 0 && (
        <details className="meal-details">
          <summary>영양정보 전체</summary>
          <dl className="meal-info-grid">
            {nutrients.map((n) => {
              const { name, unit } = splitUnit(n.label);
              return (
                <div key={n.label} className="meal-info-row">
                  <dt>{name}</dt>
                  <dd>{n.value}{unit && <small> {unit}</small>}</dd>
                </div>
              );
            })}
          </dl>
        </details>
      )}

      {origins.length > 0 && (
        <details className="meal-details">
          <summary>원산지 정보</summary>
          <dl className="meal-info-grid">
            {origins.map((o) => (
              <div key={o.label} className="meal-info-row">
                <dt>{o.label}</dt>
                <dd>{o.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </article>
  );
}

/* ------------------------------------------------------------
 * 학사일정 표시용 helper
 * ------------------------------------------------------------ */

const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

// 적용 학년 라벨: "N"이 하나도 없으면 전학년, 아니면 해당 학년만 나열
function getEventGradeLabel(event) {
  const entries = Object.entries(GRADE_EVENT_FIELDS)
    .filter(([, field]) => event[field] !== undefined);
  if (entries.length === 0) return "";

  const applied = entries.filter(([, field]) => event[field] === "Y").map(([g]) => g);
  if (applied.length === 0) return "";
  if (applied.length === entries.length) return "전학년";
  return `${applied.join("·")}학년`;
}

function EventDayCard({ ymd, events }) {
  const date = new Date(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8));
  const weekday = date.getDay();
  const weekdayClass = weekday === 0 ? "sun" : weekday === 6 ? "sat" : "";

  return (
    <article className="event-day-card">
      <div className="event-date-line">
        <span className="event-date-text">
          {Number(ymd.slice(4, 6))}월 {Number(ymd.slice(6, 8))}일
        </span>
        <span className={`event-date-weekday ${weekdayClass}`}>({WEEKDAYS_KO[weekday]})</span>
      </div>

      <ul className="event-list">
        {events.map((event, i) => {
          const gradeLabel = getEventGradeLabel(event);
          const dayType =
            event.SBTR_DD_SC_NM && event.SBTR_DD_SC_NM !== "해당없음" ? event.SBTR_DD_SC_NM : "";

          return (
            <li key={`${ymd}-${event.EVENT_NM}-${i}`} className="event-item">
              <div className="event-item-top">
                <span className="event-name">{event.EVENT_NM}</span>
              </div>

              {(dayType || gradeLabel) && (
                <div className="event-tags">
                  {dayType && <span className="event-tag event-tag--holiday">{dayType}</span>}
                  {gradeLabel && <span className="event-tag">{gradeLabel}</span>}
                </div>
              )}

              {event.EVENT_CNTNT && <p className="event-desc">{event.EVENT_CNTNT}</p>}
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export default SchoolRegisterScreen;
