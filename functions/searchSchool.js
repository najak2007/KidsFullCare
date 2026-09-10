// functions/searchSchool.js
//
// React(SchoolRegisterScreen)에서 httpsCallable("searchSchool")로 호출합니다.
// NEIS Open API(schoolInfo)를 Type=json으로 호출합니다.
// Node 내장 JSON.parse만 쓰므로 별도 XML 파서 의존성이 필요 없습니다.
//
// 사전 준비 (2nd gen)
//   1) 터미널에서 시크릿 등록 (코드에는 절대 키를 쓰지 않음)
//        firebase functions:secrets:set NEIS_KEY
//      → 프롬프트가 뜨면 발급받은 인증키 값을 붙여넣기
//   2) 배포
//        firebase deploy --only functions:searchSchool

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const neisKey = defineSecret("NEIS_KEY");

const NEIS_BASE_URL = "https://open.neis.go.kr/hub/schoolInfo";

exports.searchSchool = onCall(
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
    if (!json?.schoolInfo) {
      const resultCode = json?.RESULT?.CODE || "INFO-200";
      return { results: [], errorCode: resultCode };
    }

    const rows = json.schoolInfo[1]?.row || [];

    const results = rows.map((row) => ({
      id: `${row.ATPT_OFCDC_SC_CODE}-${row.SD_SCHUL_CODE}`,
      name: row.SCHUL_NM,
      address: row.ORG_RDNMA,
      officeCode: row.ATPT_OFCDC_SC_CODE,
      schoolCode: row.SD_SCHUL_CODE,
      schoolKind: row.SCHUL_KND_SC_NM, // 초등학교/중학교/고등학교 등
      tel: row.ORG_TELNO,
    }));

    return { results };
  }
);