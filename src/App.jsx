// src/App.jsx
import { useAuthUser } from "./hooks/useAuthUser";
import SignUp from "./components/SignUp"; // 실제 경로에 맞게 조정하세요
import "./App.css";
// import MainApp from "./pages/MainApp";


function App() {
  const { authUser, profile, loading } = useAuthUser();

  // 최초 로그인 상태 확인 중 (거의 즉시 끝나지만, 깜빡임 방지용)
/*
  if (loading) {
    return (
      <div className="splash-screen">
        <p className="splash-progress-text">불러오는 중...</p>
      </div>
    );
  }

  // 로그인 + Firestore 프로필(가입)까지 완료된 상태 → 바로 메인 화면으로

  if (authUser && profile) {
    // return <MainApp role={profile.role} user={authUser} />;
    return;
  }
*/
  // 아래 두 가지 케이스는 모두 SignUp으로 보냅니다.
  // 1) authUser가 null → 아예 로그인 안 한 상태 → 기존 Step 0(로그인 방법 선택)부터 시작
  // 2) authUser는 있는데 profile이 null → Apple/Google 로그인은 성공했지만
  //    앱이 중간에 종료되어 역할 선택(Step 1)을 못 마친 상태 → 로그인은 건너뛰고
  //    role 선택부터 이어서 하도록 SignUp에 authUser를 넘겨줍니다.
  return <SignUp initialAuthUser={authUser} />;
}

export default App;