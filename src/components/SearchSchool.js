// functions/searchSchool.js
//
// React(SchoolRegisterScreen)에서 httpsCallable("searchSchool")로 호출합니다.
// NEIS Open API(schoolInfo)를 Type=xml로 호출한 뒤, fast-xml-parser로 파싱해서
// 프론트에서 바로 쓰기 좋은 형태로 가공해 돌려줍니다.
//
// 사전 준비
//   1) npm install fast-xml-parser  (functions 디렉토리 안에서)
//   2) NEIS 인증키 설정:
//      firebase functions:config:set neis.key="발급받은인증키"
//      (2nd gen을 쓰신다면 .env 파일에 NEIS_KEY=발급받은인증키 로 설정하고
//       아래 KEY 상수를 process.env.NEIS_KEY로 바꿔주세요)

const functions = require("firebase-functions");
const { XMLParser } = require("fast-xml-parser");

const NEIS_BASE_URL = "https://open.neis.go.kr/hub/schoolInfo";

exports.searchSchool = functions.https.onCall(async (data, context) => {
  const schoolName = (data?.schoolName || "").trim();

  if (!schoolName) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "schoolName 파라미터가 필요합니다."
    );
  }

  const KEY = functions.config().neis?.key;
  if (!KEY) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "NEIS 인증키가 설정되어 있지 않습니다."
    );
  }

  const url = new URL(NEIS_BASE_URL);
  url.searchParams.set("KEY", KEY);
  url.searchParams.set("Type", "xml");
  url.searchParams.set("pIndex", "1");
  url.searchParams.set("pSize", "30");
  url.searchParams.set("SCHUL_NM", schoolName);

  let xmlText;
  try {
    const res = await fetch(url.toString());
    xmlText = await res.text();
  } catch (err) {
    console.error("NEIS 호출 실패:", err);
    throw new functions.https.HttpsError(
      "unavailable",
      "학교 정보 조회 서버에 연결할 수 없습니다."
    );
  }

  const parser = new XMLParser();
  const json = parser.parse(xmlText);

  // 정상 응답: <schoolInfo><head>...</head><row>...</row>...</schoolInfo>
  // schoolInfo가 배열로 오는 경우(head/row가 나뉘어 있는 경우)도 함께 처리합니다.
  const schoolInfoNode = json?.schoolInfo;
  const headNode = Array.isArray(schoolInfoNode)
    ? schoolInfoNode[0]?.head
    : schoolInfoNode?.head;
  const resultCode =
    (Array.isArray(headNode) ? headNode.find((h) => h.RESULT)?.RESULT?.CODE : headNode?.RESULT?.CODE) ??
    json?.RESULT?.CODE;

  const rowsNode = Array.isArray(schoolInfoNode)
    ? schoolInfoNode[1]?.row
    : schoolInfoNode?.row;

  // 결과 없음(INFO-200) 등 정상적인 "데이터 없음" 케이스
  if (!rowsNode) {
    return { results: [], errorCode: resultCode || "INFO-200" };
  }

  const rows = Array.isArray(rowsNode) ? rowsNode : [rowsNode];

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
});