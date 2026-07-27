import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  writeBatch,
} from "firebase/firestore";
import { db, auth } from "./firebase";

export async function linkToStudent(code) {
  const parent = auth.currentUser;
  if (!parent) throw new Error("로그인이 필요합니다.");

  const codeRef = doc(db, "linkCodes", code);
  const codeSnap = await getDoc(codeRef);

  if (!codeSnap.exists()) {
    throw new Error("존재하지 않는 코드입니다.");
  }

  const { studentUid, used } = codeSnap.data();

  if (used) {
    throw new Error("이미 사용된 코드입니다.");
  }

  // 배치 쓰기: 학부모/학생 문서를 한 번에 원자적으로 업데이트
  const batch = writeBatch(db);

  const parentRef = doc(db, "users", parent.uid);
  const studentRef = doc(db, "users", studentUid);

  batch.update(parentRef, {
    childUids: arrayUnion(studentUid),
  });

  batch.update(studentRef, {
    parentUids: arrayUnion(parent.uid),
  });

  batch.update(codeRef, {
    used: true,
  });

  await batch.commit();

  return studentUid;
}