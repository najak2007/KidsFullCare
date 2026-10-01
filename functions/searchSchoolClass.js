const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const neisKey = defineSecret("NEIS_KEY");

const NEIS_BASE_URL = "https://open.neis.go.kr/hub/classInfo";

exports.searchSchoolClass = onCall(
    { secrets: [neisKey], region: "us-central1" }, // firebase.js의 getFunctions(app, "us-central1")과 반드시 일치해야 함
    async (request) => {
        const eduOfficeCode = (request.data?.eduOfficeCode || "").trim();
        const sdSchulCode = (request.data?.sdSchulCode || "").trim();
        const year = new Date().getFullYear();
        const grade = (request.data?.grade || "").trim();

        console.warn("year " + year + "  grade = " + grade);

        const KEY = neisKey.value();

        const url = new URL(NEIS_BASE_URL);
        url.searchParams.set("KEY", KEY);
        url.searchParams.set("Type", "json");
        url.searchParams.set("pIndex", "1");
        url.searchParams.set("pSize", "30");
        url.searchParams.set("ATPT_OFCDC_SC_CODE", eduOfficeCode);
        url.searchParams.set("SD_SCHUL_CODE", sdSchulCode);
        url.searchParams.set("AY", year);
        url.searchParams.set("GRADE", grade);

        let json;
        try {
            const res = await fetch(url.toString());
            json = await res.json();
        } catch (err) {
            console.error("NEIS 호출 실패: ", err);
            throw new HttpsError("unavailable", "학급 정보 조회 서버에 연결할 수 없습니다.");
        }

        // 정상 응답: { classInfo}
        if(!json?.classInfo) {
            const resultCode = json?.RESULT?.CODE || "INFO-200";
            return { results: [], errorCode: resultCode }
        }

        const rows = json.classInfo[1]?.row || [];

        const results = rows.map((row) => ({
            id: `${row.ATPT_OFCDC_SC_CODE}-${row.SD_SCHUL_CODE}`,                                           // 시도교육청코드-행정표준코드
            ATPT_OFCDC_SC_CODE: row.ATPT_OFCDC_SC_CODE == null ? "" : row.ATPT_OFCDC_SC_CODE,               // 시도교육청코드
            ATPT_OFCDC_SC_NM: row.ATPT_OFCDC_SC_NM == null ? "" : row.ATPT_OFCDC_SC_NM,                     // 시도교육청명
            SD_SCHUL_CODE: row.SD_SCHUL_CODE == null ? "" : row.SD_SCHUL_CODE,                              // 행정표준코드
            SCHUL_NM: row.SCHUL_NM == null ? "" : row.SCHUL_NM,                                             // 학교명
            AY: row.AY == null ? "" : row.AY,                                                               // 학년도
            GRADE: row.GRADE == null ? "" : row.GRADE,                                                      // 학년
            DGHT_CRSE_SC_NM: row.DGHT_CRSE_SC_NM == null ? "" : row.DGHT_CRSE_SC_NM,                        // 주야과정명
            SCHUL_CRSE_SC_NM: row.SCHUL_CRSE_SC_NM == null ? "" : row.SCHUL_CRSE_SC_NM,                     // 학교과정명 
            ORD_SC_NM: row.ORD_SC_NM == null ? "" : row.ORD_SC_NM,                                          // 계열명 
            DDDEP_NM: row.DDDEP_NM == null ? "" : row.DDDEP_NM,                                             // 학과명 
            CLASS_NM: row.CLASS_NM == null ? "" : row.CLASS_NM,                                             // 학급명 
            LOAD_DTM: row.LOAD_DTM == null ? "" : row.LOAD_DTM,                                             // 수정일자
        }));

        return ( results )
    }
);