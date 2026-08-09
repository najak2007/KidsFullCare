// src/hooks/useAuthUser.js
import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

/**
 * Firebase Auth 로그인 상태를 구독하고, 로그인되어 있으면
 * Firestore users/{uid} 문서(가입 시 저장한 role 등)까지 함께 가져옵니다.
 *
 * Firebase Auth는 기본적으로 로그인 상태를 로컬(IndexedDB)에 영속화하므로,
 * 앱을 완전히 종료했다가 다시 켜도 onAuthStateChanged가 저장된 세션을
 * 자동으로 복원해서 콜백을 호출해줍니다. 별도의 토큰 저장/복원 로직은
 * 필요 없습니다.
 *
 * 반환값
 * - authUser: Firebase Auth User 객체 | null (로그인 안 됨)
 * - profile:  Firestore users/{uid} 문서 데이터 | null (가입 미완료 or 로그아웃)
 * - loading:  최초 상태 확인이 끝났는지 여부
 */
export function useAuthUser() {
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);

      if (user) {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          setProfile(snap.exists() ? snap.data() : null);
        } catch (err) {
          console.error("사용자 프로필을 불러오지 못했습니다:", err);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { authUser, profile, loading };
}
