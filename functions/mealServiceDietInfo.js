const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const neisKey = defineSecret("NEIS_KEY");

const NEIS_BASE_URL = "https://open.neis.go.kr/hub/mealServiceDietInfo";

exports.mealServiceDietInfo = onCall(
  { secrets: [neisKey], region: "us-central1" }, // firebase.js의 getFunctions(app, "us-central1")과 반드시 일치해야 함
  async (request) => {
    const schoolName = (request.data?.schoolName || "").trim();

    if (!schoolName) {
      throw new HttpsError("invalid-argument", "schoolName 파라미터가 필요합니다.");
    }

    const KEY = neisKey.value();

    const url = new URL(NEIS_BASE_URL);
    url.searchParams.set("KEY", KEY);
    url.searchParams.set("Type", "json");
    url.searchParams.set("pIndex", "1");
    url.searchParams.set("pSize", "30");
    url.searchParams.set("SCHUL_NM", schoolName);

    let json;
    try {
      const res = await fetch(url.toString());
      json = await res.json(); // 내장 JSON 파싱 - 별도 라이브러리 불필요
    } catch (err) {
      console.error("NEIS 호출 실패:", err);
      throw new HttpsError("unavailable", "학교 정보 조회 서버에 연결할 수 없습니다.");
    }

    // 정상 응답: { schoolInfo: [ { head: [...] }, { row: [...] } ] }
    // 결과 없음/에러: { RESULT: { CODE: "INFO-200", MESSAGE: "..." } }
    if (!json?.mealServiceDietInfo) {
      const resultCode = json?.RESULT?.CODE || "INFO-200";
      return { results: [], errorCode: resultCode };
    }

    const rows = json.mealServiceDietInfo[1]?.row || [];

   const results = rows.map((row) => ({
      id: `${row.ATPT_OFCDC_SC_CODE}-${row.SD_SCHUL_CODE}`,
      SCHUL_NM: row.SCHUL_NM,                       // 학교명
      ORG_RDNMA: row.ORG_RDNMA,                     // 도로주소
      ORG_RDNDA: row.ORG_RDNDA,                     // 도로 상세주소
      ATPT_OFCDC_SC_CODE: row.ATPT_OFCDC_SC_CODE,   // 시도교육청코드
      SD_SCHUL_CODE: row.SD_SCHUL_CODE,             // 행정표준코드
      SCHUL_KND_SC_NM: row.SCHUL_KND_SC_NM,         // 초등학교/중학교/고등학교 등
      schoollevel: row.SCHUL_KND_SC_NM === "초등학교" ? "1" : "2",
      SCHUL_KND_SC_NM: row.SCHUL_KND_SC_NM,         // 학교종류명
      LCTN_SC_NM: row.LCTN_SC_NM,                   // 시도명
      FOND_SC_NM: row.FOND_SC_NM,                   // 설립명
      ORG_TELNO: row.ORG_TELNO,                           // 전화번호
    }));

    return { results };
  }
);