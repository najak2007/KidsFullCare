const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

exports.notifyParentsStudentInfo = onCall({ region: "us-central1" }, async (request) => {
  const debug = { version: "v3-debug", steps: [] };   // 새 코드가 배포됐는지 구분하는 표식
  console.log("함수 시작 uid =", request.auth?.uid);
  
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const studentUid = request.auth.uid;   // 클라이언트가 넘긴 uid는 믿지 않고 인증 정보만 사용
  const db = getFirestore();

  const studentSnap = await db.doc(`users/${studentUid}`).get();
  const student = studentSnap.data();
  if (!student || student.role !== "student") {
    throw new HttpsError("permission-denied", "학생 계정만 호출할 수 있습니다.");
  }

  // 전송 내용은 클라이언트 값이 아니라 Firestore에 저장된 값으로 구성 (위조 방지)
  const schools = student.studentInfo?.school ?? [];
  const school = schools.find((s) => s.KEY === "school") ?? schools[0];
  if (!school) return { sent: 0, reason: "no-school" };

  const schoolName = school.SCHUL_NM ?? "학교";
  const grade = school.CLASS?.GRADE ?? "";
  const className = school.CLASS?.CLASS_NM ?? "";
  const studentName = student.displayName ?? "자녀";

  // 부모 uid: family[].uid + familyUids 합집합
  const parentUids = [
    ...new Set([
      ...(student.family ?? []).map((f) => f?.uid),
      ...(student.familyUids ?? []),
    ].filter(Boolean)),
  ];

  console.log("parentUids = ", parentUids);
  let sent = 0;
  debug.studentRole = student?.role;

  for (const parentUid of parentUids) {
    const parentRef = db.doc(`users/${parentUid}`);
    const parent = (await parentRef.get()).data();

    if( !parent) {
      console.log("부모 문서 없음: ", parentUid);
      debug.steps.push({ parentUid, skip: "no-doc" });
      continue;
    }

    if (parent.role !== "parent") {
      console.log("role 불일치: ", parentUid, parent.role);
      debug.steps.push({ parentUid, skip: "role", role: parent.role ?? null });
      continue;
    }

    const tokens = [...new Set([parent.fcmToken, ...(parent.fcmTokens ?? [])].filter(Boolean))];
    if (tokens.length === 0) {
      console.log("토큰 없음: ", parentUid);
      debug.steps.push({ parentUid, skip: "no-token" });
      continue;
    }

    const body = `${schoolName}${grade ? ` ${grade}학년` : ""}${className ? ` ${className}반` : ""}`;

    const res = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title: `${studentName} 학생이 학교를 등록했어요`, body },
      data: { type: "studentInfoRegistered", studentUid },
      apns: { payload: { aps: { sound: "default" } } },
      android: { priority: "high" },
    });
    sent += res.successCount;

    // 만료된 토큰 정리
    const invalid = tokens.filter((_, i) => {
      const code = res.responses[i].error?.code;
      return code === "messaging/registration-token-not-registered" ||
             code === "messaging/invalid-registration-token";
    });
    if (invalid.length) {
      const updates = { fcmTokens: FieldValue.arrayRemove(...invalid) };
      if (invalid.includes(parent.fcmToken)) updates.fcmToken = FieldValue.delete();
      await parentRef.update(updates);
    }

    debug.steps.push({ parentUid, success: res.successCount, failure: res.failureCount,
      error: res.responses.find((r) => !r.success)?.error?.code ?? null });
  }

  return { sent, debug };
});