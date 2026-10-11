const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const neisKey = defineSecret("NEIS_KEY");

const NEIS_BASE_URL = "https://open.neis.go.kr/hub/mealServiceDietInfo";

exports.schoolLunch = onCall(
    { secrets: [neisKey], region: "us-central1" }, // firebase.js의 getFunctions(app, "us-central1")과 반드시 일치해야 함
    async (request) => {
        const eduOfficeCode = (request.data?.eduOfficeCode || "").trim();
        const sdSchulCode = (request.data?.sdSchulCode || "").trim();

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
        url.searchParams.set("MLSV_FROM_YMD", startDate);
        url.searchParams.set("MLSV_TO_YMD", endDate);

        let json;
        try {
            const res = await fetch(url.toString());
            json = await res.json();
        } catch (err) {
            console.error("NEIS 호출 실패: ", err);
            throw new HttpsError("unavailable", "급식 정보 조회 서버에 연결할 수 없습니다.");
        }

        // 정상 응답: { mealServiceDietInfo }
        if(!json?.mealServiceDietInfo) {
            const resultCode = json?.RESULT?.CODE || "INFO-200";
            return { results: [], errorCode: resultCode }
        }

        const rows = json.mealServiceDietInfo[1]?.row || [];

        const results = rows.map((row) => ({
            id: `${row.ATPT_OFCDC_SC_CODE}-${row.SD_SCHUL_CODE}-${row.MLSV_YMD}`,               // 시도교육청코드-행정표준코드
            ATPT_OFCDC_SC_CODE: row.ATPT_OFCDC_SC_CODE ?? "",                                   // 시도교육청코드
            ATPT_OFCDC_SC_NM: row.ATPT_OFCDC_SC_NM ?? "",                                       // 시도교육청명
            SD_SCHUL_CODE: row.SD_SCHUL_CODE ?? "",                                             // 행정표준코드
            SCHUL_NM: row.SCHUL_NM ?? "",                                                       // 학교명
            MMEAL_SC_CODE: row.MMEAL_SC_CODE ?? "",                                             // 식사코드
            MMEAL_SC_NM: row.MMEAL_SC_NM ?? "",                                                 // 식사명
            MLSV_YMD: row.MLSV_YMD ?? "",                                                       // 급식일자
            MLSV_FGR: row.MLSV_FGR ?? "",                                                       // 급식인원수
            DDISH_NM: row.DDISH_NM ?? "",                                                       // 급식메뉴
            ORPLC_INFO: row.ORPLC_INFO ?? "",                                                   // 조리실 정보
            CAL_INFO: row.CAL_INFO ?? "",                                                       // 칼로리 정보
            NTR_INFO: row.NTR_INFO ?? "",                                                       // 영양정보
            MLSV_FROM_YMD: row.MLSV_FROM_YMD ?? "",                                             // 급식시작일자
            MLSV_TO_YMD: row.MLSV_TO_YMD ?? "",                                                 // 급식종료일자
            LOAD_DTM: row.LOAD_DTM ?? "",                                                       // 수정일자
        }));

        return { results };
    }
);  
