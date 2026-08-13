import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";

// 6자리 랜덤 숫자 코드 생성
function createRandomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function generateLinkCode() {
  const user = auth.currentUser;
  if (!user) throw new Error("로그인이 필요합니다.");

  const code = createRandomCode();

  // linkCodes/{code} 문서 생성
  await setDoc(doc(db, "linkCodes", code), {
    studentUid: user.uid,
    createdAt: serverTimestamp(),
    used: false,
  });

  // 학생 본인 users 문서에도 현재 코드 표시용으로 저장 (선택사항)
  await updateDoc(doc(db, "users", user.uid), {
    currentLinkCode: code,
  });

  return code; // 화면에 표시해서 학부모에게 공유
}