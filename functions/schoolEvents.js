const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const neisKey = defineSecret("NEIS_KEY");

const NEIS_BASE_URL = "https://open.neis.go.kr/hub/SchoolSchedule";

exports.schoolEvents = onCall(
    { secrets: [neisKey], region: "us-central1" }, // firebase.js의 getFunctions(app, "us-central1")과 반드시 일치해야 함
    async (request) => {
        const eduOfficeCode = (request.data?.eduOfficeCode || "").trim();
        const sdSchulCode = (request.data?.sdSchulCode || "").trim();
        const dghtCrseScNm = (request.data?.dghtCrseScNm || "").trim();
        const schulCrseScNm = (request.data?.schulCrseScNm || "").trim();

        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, "0");
        const day = String(new Date().getDate()).padStart(2, "0");
        const currentDateString = `${year}${month}${day}`;

        const startDate = (request.data?.startDate || currentDateString);
        const endDate = (request.data?.endDate || currentDateString);


        if (!eduOfficeCode || !sdSchulCode || !startDate || !endDate) {
            throw new HttpsError("invalid-argument", "필수 파라미터가 누락되었습니다.");
        }

        let url = new URL(NEIS_BASE_URL);
        const KEY = neisKey.value();
        url.searchParams.set("KEY", KEY);
        url.searchParams.set("Type", "json");
        url.searchParams.set("pIndex", "1");
        url.searchParams.set("pSize", "30");
        url.searchParams.set("ATPT_OFCDC_SC_CODE", eduOfficeCode);
        url.searchParams.set("SD_SCHUL_CODE", sdSchulCode);
        url.searchParams.set("AA_FROM_YMD", startDate);
        url.searchParams.set("AA_TO_YMD", endDate);

        if (dghtCrseScNm.length > 0) {
            url.searchParams.set("DIGHT_CRSE_SC_NM", dghtCrseScNm);
        }
        if (schulCrseScNm.length > 0) {
            url.searchParams.set("SCHUL_CRSE_SC_NM", schulCrseScNm);
        }

        let json;
        try {
            const res = await fetch(url.toString());
            json = await res.json();
        } catch (err) {
            console.error("NEIS 호출 실패: ", err);
            throw new HttpsError("unavailable", "급식 정보 조회 서버에 연결할 수 없습니다.");
        }

        // 정상 응답: { mealServiceDietInfo }
        if(!json?.SchoolSchedule) {
            const resultCode = json?.RESULT?.CODE || "INFO-200";
            return { results: [], errorCode: resultCode }
        }

        const rows = json.SchoolSchedule[1]?.row || [];

        const results = rows.map((row) => ({
            id: `${row.ATPT_OFCDC_SC_CODE}-${row.SD_SCHUL_CODE}-${row.MLSV_YMD}`,               // 시도교육청코드-행정표준코드
            ATPT_OFCDC_SC_CODE: row.ATPT_OFCDC_SC_CODE ?? "",                                   // 시도교육청코드
            ATPT_OFCDC_SC_NM: row.ATPT_OFCDC_SC_NM ?? "",                                       // 시도교육청명
            SD_SCHUL_CODE: row.SD_SCHUL_CODE ?? "",                                             // 행정표준코드
            SCHUL_NM: row.SCHUL_NM ?? "",                                                       // 학교명
            AY: row.AY ?? "",                                                                   // 학년도
            DGHT_CRSE_SC_NM: row.DGHT_CRSE_SC_NM ?? "",                                         // 주야과정명
            SCHUL_CRSE_SC_NM: row.SCHUL_CRSE_SC_NM ?? "",                                       // 학교과정명
            SBTR_DD_SC_NM: row.SBTR_DD_SC_NM ?? "",                                             // 수업공제일명
            AA_YMD: row.AA_YMD ?? "",                                                           // 학사일자
            EVENT_NM: row.EVENT_NM ?? "",                                                       // 행사명
            EVENT_CNTNT: row.EVENT_CNTNT ?? "",                                                 // 행사내용
            ONE_GRADE_EVENT_YN: row.ONE_GRADE_EVENT_YN ?? "",                                   // 1학년행사여부                    
            TW_GRADE_EVENT_YN: row.TW_GRADE_EVENT_YN ?? "",                                     // 2학년행사여부
            THREE_GRADE_EVENT_YN: row.THREE_GRADE_EVENT_YN ?? "",                               // 3학년행사여부
            FR_GRADE_EVENT_YN: row.FR_GRADE_EVENT_YN ?? "",                                     // 4학년행사여부
            FIV_GRADE_EVENT_YN: row.FIV_GRADE_EVENT_YN ?? "",                                   // 5학년행사여부
            SIX_GRADE_EVENT_YN: row.SIX_GRADE_EVENT_YN ?? "",                                   // 6학년행사여부
            LOAD_DTM: row.LOAD_DTM ?? "",                                                       // 수정일자
        }));

        return { results };
    }
);  
