// functions/syncFamilyUids.js
//
// users/{uid} 문서의 family(array of {name, uid}) 필드가 바뀔 때마다
// 보안 규칙 검사 전용 필드인 familyUids(array of string)를 자동으로 재계산합니다.
// family는 UI 표시용(이름 포함), familyUids는 규칙에서 멤버십만 빠르게 확인하기 위한 필드입니다.

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

exports.syncFamilyUids = onDocumentWritten("users/{uid}", async (event) => {
  const after = event.data?.after;
  if (!after?.exists) {
    return; // 문서 삭제된 경우 별도 처리 불필요
  }

  const afterData = after.data();
  const family = Array.isArray(afterData.family) ? afterData.family : [];
  const nextFamilyUids = family
    .map((member) => member?.uid)
    .filter((uid) => typeof uid === "string" && uid.length > 0);

  const beforeData = event.data?.before?.exists ? event.data.before.data() : null;
  const prevFamilyUids = beforeData?.familyUids || [];

  // 값이 실제로 달라졌을 때만 써서 불필요한 재귀 트리거를 방지합니다.
  const isSame =
    nextFamilyUids.length === prevFamilyUids.length &&
    nextFamilyUids.every((uid) => prevFamilyUids.includes(uid));

  if (isSame) {
    return;
  }

  const db = getFirestore();
  await after.ref.set(
    {
      familyUids: nextFamilyUids.length > 0 ? nextFamilyUids : FieldValue.delete(),
    },
    { merge: true }
  );
});