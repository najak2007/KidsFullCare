const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const neisKey = defineSecret("NEIS_KEY");

const NEIS_ROOT_URL = "https://open.neis.go.kr/hub/";
const ELEMENTARY_SCHOOL = "elsTimetable";               //  초등학교
const MIDDLE_SCHOOL = "misTimetable";
const HIGH_SCHOOL = "hisTimetable";

exports.schoolTimeTable = onCall(
    { secrets: [neisKey], region: "us-central1" }, // firebase.js의 getFunctions(app, "us-central1")과 반드시 일치해야 함
    async (request) => {
        const eduOfficeCode = (request.data?.eduOfficeCode || "").trim();
        const sdSchulCode = (request.data?.sdSchulCode || "").trim();
        const grade = (request.data?.grade || "").trim();
        const class_nm = (request.data?.classNm || "").trim();
        const year = new Date().getFullYear();
        const searchDate = (request.data?.searchDate || new Date().getFullYear());
        const startDate = (request.data?.startDate || new Date().getFullYear());
        const endDate = (request.data?.endDate || new Date().getFullYear());

        let url;

        const schoolKindNm = (request.data?.schoolKinkNm || "초등학교").trim();

        switch (schoolKindNm) {
            case "초등학교":
                url = new URL(NEIS_ROOT_URL + ELEMENTARY_SCHOOL);
                break;
            case "중학교":
                url = new URL(NEIS_ROOT_URL + MIDDLE_SCHOOL);
                break;
            case "고등학교":
                url = new URL(NEIS_ROOT_URL + HIGH_SCHOOL);
                break;
        }

        const KEY = neisKey.value();
        url.searchParams.set("KEY", KEY);
        url.searchParams.set("Type", "json");
        url.searchParams.set("pIndex", "1");
        url.searchParams.set("pSize", "30");
        url.searchParams.set("ATPT_OFCDC_SC_CODE", eduOfficeCode);
        url.searchParams.set("SD_SCHUL_CODE", sdSchulCode);
        url.searchParams.set("SEM", "2");
        url.searchParams.set("ALL_TI_YMD", searchDate);
        url.searchParams.set("AY", year);
        url.searchParams.set("GRADE", grade);
        url.searchParams.set("CLASS_NM", class_nm);
        url.searchParams.set("TI_FROM_YMD", startDate);
        url.searchParams.set("TI_TO_YMD", endDate);

        let json;
        let rows;
        try {
            const res = await fetch(url.toString());
            json = await res.json();
        } catch (err) {
            console.error("NEIS 호출 실패: ", err);
            throw new HttpsError("unavailable", schoolKindNm + " 시간표 정보 조회 서베에 연결할 수 없습니다.");
        }

        switch (schoolKindNm) {
            case "초등학교": {
                    if(!json?.elsTimetable) {
                        const resultCode = json?.RESULT?.CODE || "INFO-200";
                        return { results: [], errorCode: resultCode }
                    }
                    rows = json.elsTimetable[1]?.row || [];
                }
                 break;
            case "중학교": {
                    if(!json.misTimetable) {
                        const resultCode = json?.RESULT?.code || "INFO-200";
                        return { results: [], errorCode: resultCode }
                    }
                    rows = json.misTimetable[1]?.row || [];
                }
                break;
            case "고등학교": {
                    if(!json.hisTimetable) {
                        const resultCode = json?.RESULT?.code || "INFO-200";
                        return { results: [], errorCode: resultCode }
                    }
                    rows = json.hisTimetable[1]?.row || [];
            }
                break;
        }
        const results = rows.map((row) => ({
            id: `${row.ATPT_OFCDC_SC_CODE}-${row.SD_SCHUL_CODE}-${row.AY}-${row.GRADE}-${row.CLASS_NM}-${row.PERO}`,                                           // 시도교육청코드-행정표준코드
            ATPT_OFCDC_SC_CODE: row.ATPT_OFCDC_SC_CODE ?? "",               // 시도교육청코드
            ATPT_OFCDC_SC_NM: row.ATPT_OFCDC_SC_NM ?? "",                   // 시도교육청명
            SD_SCHUL_CODE: row.SD_SCHUL_CODE ?? "",                         // 행정표준코드
            SCHUL_NM: row.SCHUL_NM ?? "",                                   // 학교명
            AY: row.AY ?? "",                                               // 학년도
            SEM: row.SEM ?? "",                                             // 학기
            ALL_TI_YMD: row.ALL_TI_YMD ?? "",                               // 시간표일자
            DGHT_CRSE_SC_NM: row.DGHT_CRSE_SC_NM ?? "",                     // 주야과정명
            ORD_SC_NM: row.ORD_SC_NM ?? "",                                 // 계열명
            DDDEP_NM: row.DDDEP_NM ?? "",                                   // 학과명
            GRADE: row.GRADE ?? "",                                         // 학년
            CLRM_NM: row.CLRM_NM ?? "",                                     // 강의실명
            CLASS_NM: row.CLASS_NM ?? "",                                   // 학급명
            PERIO: row.PERIO ?? "",                                         // 교시 
            ITRT_CNTNT: row.ITRT_CNTNT ?? "",                               // 수입내용
            LOAD_DTM: row.LOAD_DTM ?? ""                                    // 수정일자

        }));

        return { results }
    }
);