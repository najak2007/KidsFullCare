const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const neisKey = defineSecret("NEIS_KEY");
const NEIS_BASE_URL = "https://open.neis.go.kr/hub/acaInsTiInfo";

exports.searchAcademy = onCall(
    { secrets: [neisKey], region: "us-central1" }, // firebase.js의 getFunctions(app, "us-central1")과 반드시 일치해야 함
    async (request) => {
        const eduOfficeCode = (request.data?.eduOfficeCode || "").trim();
        const academyName = (request.data?.academyName || "").trim();

        if(!academyName) {
            throw new HttpsError("invalid-argument", "AcademyName 파라미터가 필요합니다.");
        }

        const KEY = neisKey.value();

        const url = new URL(NEIS_BASE_URL);
        url.searchParams.set("KEY", KEY);
        url.searchParams.set("Type", "json");
        url.searchParams.set("pIndex", "1");
        url.searchParams.set("pSize", "30");
        url.searchParams.set("ATPT_OFCDC_SC_CODE", eduOfficeCode);
        url.searchParams.set("ACA_NM", academyName);

        let json;
        try {
            const res = await fetch(url.toString());
            json = await res.json();
        } catch (err) {
            console.error("NEIS 호출 실패:", err);
            throw new HttpsError("unavailable", "학원 정보 조회 서버에 연결할 수 없습니다.");
        }

        // 정상 응답: { acaInsTiInfo}
        if(!json?.acaInsTiInfo) {
            const resultCode = json?.RESULT?.CODE || "INFO-200";
            return { results: [], errorCode: resultCode }
        }

        const rows = json.acaInsTiInfo[1]?.row || [];

        const results = rows.map((row) => ({
            id: `${row.ATPT_OFCDC_SC_CODE}-${row.ACA_ASNUM}`,           // 시도교육청코드-학원지정번호
            ATPT_OFCDC_SC_CODE: row.ATPT_OFCDC_SC_CODE == null ? "" : row.ATPT_OFCDC_SC_CODE,       // 시도교육청코드
            ATPT_OFCDC_SC_NM: row.ATPT_OFCDC_SC_NM == null? "" : row.ATPT_OFCDC_SC_NM,              // 시도교육청명
            ADMST_ZONE_NM: row.ADMST_ZONE_NM == null ? "" : row.ADMST_ZONE_NM,                      //  행정구역명
            ACA_INSTI_SC_NM: row.ACA_INSTI_SC_NM == null ? "" : row.ACA_INSTI_SC_NM,                // 학원교습소명
            ACA_ASNUM: row.ACA_ASNUM == null ? "" : row.ACA_ASNUM,                                  // 학원지정번호
            ACA_NM: row.ACA_NM == null ? "" : row.ACA_NM,                                           // 학원명
            ESTBL_YMD: row.ESTBL_YMD == null ? "" : row.ESTBL_YMD,                                  // 개설일자
            REG_YMD: row.REG_YMD == null ? "" : row.REG_YMD,                                        // 등록일자
            REG_STTUS_NM: row.REG_STTUS_NM == null ? "" : row.REG_STTUS_NM,                         // 등록상태명
            CAA_BEGIN_YMD: row.CAA_BEGIN_YMD == null ? "" : row.CAA_BEGIN_YMD,                      // 휴원시작일자
            CAA_END_YMD: row.CAA_END_YMD == null ? "" : row.CAA_END_YMD,                            // 휴원종료일자
            TOFOR_SMTOT: row.TOFOR_SMTOT == null ? "" : row.TOFOR_SMTOT,                            // 정원합계
            DTM_RCPTN_ABLTY_NMPR_SMTOT: row.DTM_RCPTN_ABLTY_NMPR_SMTOT == null ? "" : row.DTM_RCPTN_ABLTY_NMPR_SMTOT,       // 일시수용능력인원합계
            REALM_SC_NM: row.REALM_SC_NM == null ? "" : row.REALM_SC_NM,                            // 분야명
            LE_ORD_NM: row.LE_ORD_NM == null ? "" : row.LE_ORD_NM,                                  // 교습계열명
            LE_CRSE_LIST_NM: row.LE_CRSE_LIST_NM == null ? "" : row.LE_CRSE_LIST_NM,                // 교습과정목록명
            LE_CRSE_NM: row.LE_CRSE_NM == null ? "" : row.LE_CRSE_NM,                               // 교습과정명
            PSNBY_THCC_CNTNT: row.PSNBY_THCC_CNTNT == null ? "" : row.PSNBY_THCC_CNTNT,             // 인당수강료
            THCC_OTHBC_YN: row.THCC_OTHBC_YN == null ? "" : row.THCC_OTHBC_YN,                      // 수강료공개여부
            BRHS_ACA_YN: row.BRHS_ACA_YN == null ? "" : row.BRHS_ACA_YN,                            // 기숙사학원여부
            FA_RDNMA: row.FA_RDNMA == null ? "" : row.FA_RDNMA,                                     // 도로명주소
            FA_RDNDA: row.FA_RDNDA == null ? "" : row.FA_RDNDA,                                     // 도로명 주소
            FA_RDNZC: row.FA_RDNZC == null ? "" : row.FA_RDNZC,                                     // 도로명우편번호
            FA_TELNO: row.FA_TELNO == null ? "" : row.FA_TELNO,                                     // 전화번호
            LOAD_DTM: row.LOAD_DTM == null ? "" : row.LOAD_DTM,                                     // 수정일자
        }));

        return { results };
    }
);