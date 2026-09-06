// src/pages/MainScreen.jsx
import { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import "../css/MainScreen.css";
import "./StudentLinkScreen";
import StudentLinkScreen from "./StudentLinkScreen";


function requestNativeProfileImagePicker() {
    if (window.webkit?.messageHandlers?.pickProfileImage) {
        window.webkit.messageHandlers.pickProfileImage.postMessage(null);
    } else if (window.AndroidBridge?.pickProfileImage) {
        window.AndroidBridge.pickProfileImage();
    } else {
        console.warn("Native 이미지 선택 브릿지를 찾을 수 없습니다.");
    }
}

function requestNativeFamilyMemberImage(uid) {
    if (window.webkit?.messageHandlers?.fetchProfileImage) {
        window.webkit.messageHandlers.fetchProfileImage.postMessage(uid);
    } else if (window.AndroidBridge?.fetchProfileImage) {
        window.AndroidBridge.fetchProfileImage(uid);
    } else {
        console.warn("Native 가족 구성원 이미지 선택 브릿지를 찾을 수 없습니다.");
    }
}

// 이 파일이 여러 번 로드되어도 (HMR 등) 중복 등록되지 않도록 가드합니다.
const familyImageListeners = new Set();

if (typeof window !== "undefined" && !window.__familyImageDispatcherInstalled) {
  window.__familyImageDispatcherInstalled = true;

  // window에 실제로 등록되는 건 이 "분배자" 하나뿐입니다.
  // 네이티브가 이걸 호출하면, 등록된 리스너 전부에게 payload를 뿌려주고
  // 각 리스너가 자기 uid와 일치하는지 스스로 판단합니다.
  window.onNativeFamilyProfileImage = (payload) => {
    familyImageListeners.forEach((listener) => listener(payload));
  };
}

/*
* 특정 uid의 이미지 응답만 받아서 콜백을 실행하는 Hook
* 여러 AvatarFamilyCircle이 동시에 마운트돼 있어도 서로 안 겹칩니다.
*/
function useFamilyImageListener(uid, onImageReceived) {
  useEffect(() => {
    const listener = (payload) => {
      if (payload?.uid !== uid) return;     // 내 uid가 아니면 무시
      if (payload?.imageBase64) {
        onImageReceived(payload.imageBase64);
      }
    };
    familyImageListeners.add(listener);
    return () => {
      familyImageListeners.delete(listener);
    };
  }, [uid, onImageReceived])
}

/* ================================================================
 * 상단 아바타 줄: 본인 → family(연결된 학부모/학생들) → 추가 버튼
 * ================================================================ */
function AvatarRow({ selfProfile, familyMembers, onAddFamily }) {
  return (
    <div className="avatar-row">
      <AvatarCircle name={selfProfile?.name} image={selfProfile?.image} isSelf />
      {familyMembers.map((member) => (
        <AvatarFamilyCircle key={member.uid} uid={member.uid} name={member.name} image={member?.image} />
      ))}
      <button type="button" className="avatar-add-btn" onClick={() => onAddFamily(selfProfile?.role)} aria-label="가족 추가">
        {selfProfile?.role === "student" ? 
        <QRCodeIcon />
        : 
        <PlusIcon /> }

      </button>
    </div>
  );
}

function AvatarCircle({ name, image, isSelf }) {
    const [internalImage, setInternalImage] = useState(image || null);
    const [internalName, setInternalName] = useState(name || null);

    useEffect(() => {
        window.onNativeProfileImagePicked = (payload) => {
            if (!payload?.imageBase64 || payload.imageBase64 === "") {
                setInternalImage(null);
                return;
            }
            const dataUrl = `data:image/jpeg;base64,${payload.imageBase64}`;
            setInternalImage(dataUrl);
        };

        return () => {
            delete window.onNativeProfileImagePicked;
        };

    }, []);

    const handleProfileSelectClick = useCallback(() => {
        requestNativeProfileImagePicker();
    }, []);

    return (
        <div className="avatar-item">
            <button 
                type="button"
                className={`avatar-circle ${isSelf ? "avatar-circle-self" : ""}`}
                onClick={isSelf ? handleProfileSelectClick : ""}
                style={internalImage ? { backgroundImage: `url(${internalImage})` } : undefined}
            >
            {!internalImage && <span className="avatar-initial">{internalName?.[0] || "?"}</span>}
            </button>
        {isSelf && internalName && <span className="avatar-name">{internalName}</span>}
        </div>
  );
}

function AvatarFamilyCircle({ uid, name, image }) {
    const [internalImage, setInternalImage] = useState(image || null);

    // 부모가 나중에 image prop을 채워주는 경우(예: loggedIn payload에 이미 있었던 경우) 반영
    useEffect(() => {
      setInternalImage(image || null);
    }, [image]);

    const handleImageReceived = useCallback((imageBase64) => {
      setInternalImage(`data:image/jpeg;base64,${imageBase64}`);
    }, []);

    useFamilyImageListener(uid, handleImageReceived);

    // 이미지가 아직 없을때 네이티브에 요청 (이미 있으면 재요청 안 함)
    useEffect(() => {
      if (internalImage || !uid) return;
      requestNativeFamilyMemberImage(uid);
    }, [uid]);

    return (
      <div className="avatar-item">
        <div
          className="avatar-circle"
          style={internalImage ? { backgroundImage: `url(${internalImage})` } : undefined}
        >
          {!internalImage && <span className="avatar-initial">{name?.[0] || "?"}</span>}
        </div>
      </div>
    );
}

/* ================================================================
 * 상단 바: 아바타 줄 + 알림 버튼
 * ================================================================ */
function MainHeader({ selfProfile, familyMembers, onAddFamily, onNotificationClick, hasUnreadNotification }) {
  return (
    <div className="main-header">
      <AvatarRow selfProfile={selfProfile} familyMembers={familyMembers} onAddFamily={onAddFamily} />
      <button type="button" className="notification-btn" onClick={onNotificationClick} aria-label="알림">
        <BellIcon />
        {hasUnreadNotification && <span className="notification-dot" />}
      </button>
    </div>
  );
}

/* ================================================================
 * "OO님에게 메시지 보내기" 카드
 * ================================================================ */
function SendMessageCard({ targetName, onClick }) {
  if (!targetName) return null;
  return (
    <button type="button" className="send-message-card" onClick={onClick}>
      <span>{targetName} 님에게 메시지 보내기</span>
      <ChevronRightIcon />
    </button>
  );
}

/* ================================================================
 * 할 일 카드 더미 ↔ 그리드 확장 위젯
 * ================================================================ */
const GRID_COLUMNS = 3;
const CARD_WIDTH = 100;
const CARD_HEIGHT = 100;
const GRID_GAP = 12;

function TodoStack({ todos, onTodoClick }) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef(null);
  const [containerHeight, setContainerHeight] = useState(CARD_HEIGHT + 24);

  useLayoutEffect(() => {
    if (!expanded) {
      setContainerHeight(CARD_HEIGHT + 24); // 접힌 상태: 카드 한 장 높이 정도
      return;
    }
    const rows = Math.ceil(todos.length / GRID_COLUMNS);
    setContainerHeight(rows * CARD_HEIGHT + (rows - 1) * GRID_GAP + 8);
  }, [expanded, todos.length]);

  const toggle = () => setExpanded((prev) => !prev);

  return (
    <div className="todo-stack-section">
      <button type="button" className="todo-stack-toggle" onClick={toggle}>
        <span>오늘 할 일 {todos.length}개</span>
        <span className={`todo-stack-chevron ${expanded ? "todo-stack-chevron-up" : ""}`}>
          <ChevronDownIcon />
        </span>
      </button>

      {/* 펼쳐졌을 때 배경을 살짝 덮어서, 배경 탭하면 접히도록 */}
      {expanded && <div className="todo-stack-backdrop" onClick={toggle} />}

      <div
        ref={containerRef}
        className={`todo-stack-container ${expanded ? "todo-stack-expanded" : "todo-stack-collapsed"}`}
        style={{ height: containerHeight }}
      >
        {todos.map((todo, index) => {
          const row = Math.floor(index / GRID_COLUMNS);
          const col = index % GRID_COLUMNS;

          // 펼쳐졌을 때: 그리드 좌표
          const expandedX = col * (CARD_WIDTH + GRID_GAP);
          const expandedY = row * (CARD_HEIGHT + GRID_GAP);

          // 접혔을 때: 살짝씩 어긋나게 쌓인 "카드 더미" 좌표
          const collapsedX = Math.min(index * 3, 24);
          const collapsedY = Math.min(index * 3, 24);
          const collapsedRotate = (index % 2 === 0 ? 1 : -1) * Math.min(index * 1.2, 6);

          const x = expanded ? expandedX : collapsedX;
          const y = expanded ? expandedY : collapsedY;
          const rotate = expanded ? 0 : collapsedRotate;

          return (
            <button
              type="button"
              key={todo.id}
              className="todo-card"
              style={{
                transform: `translate(${x}px, ${y}px) rotate(${rotate}deg)`,
                zIndex: expanded ? 1 : todos.length - index,
                transitionDelay: expanded ? `${index * 15}ms` : `${(todos.length - index) * 10}ms`,
              }}
              onClick={() => (expanded ? onTodoClick?.(todo) : toggle())}
            >
              <span className="todo-card-emoji">{todo.emoji || "📌"}</span>
              <span className="todo-card-title">{todo.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================
 * 하단 탭바
 * ================================================================ */
const TABS = [
  { key: "home", label: "홈", icon: HomeIcon },
  { key: "mission", label: "하루 미션", icon: MissionIcon },
  { key: "community", label: "커뮤니티", icon: CommunityIcon },
  { key: "benefit", label: "혜택 받기", icon: BenefitIcon },
  { key: "all", label: "전체", icon: AllIcon },
];

function TabBar({ activeTab, onChange }) {
  return (
    <nav className="tab-bar">
      {TABS.map(({ key, label, icon: Icon }) => (
        <button
          type="button"
          key={key}
          className={`tab-bar-item ${activeTab === key ? "tab-bar-item-active" : ""}`}
          onClick={() => onChange(key)}
        >
          <Icon active={activeTab === key} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

/* ================================================================
 * 메인 화면
 * ================================================================ */
function MainScreen({
  selfProfile,          // { name, image, role }
  familyMembers = [],   // [{ uid, name, image }]
  todos = [],           // [{ id, title, emoji }]
  hasUnreadNotification = false,
  onAddFamily,
  onNotificationClick,
  onSendMessageClick,
  onTodoClick,
}) {
  const [activeTab, setActiveTab] = useState("home");
  const primaryFamilyMember = familyMembers[0] || null;
  const primaryFamilyUid = familyMembers[0]?.uid;
  const primaryFamilyName = familyMembers[0]?.name;
  const [authQRCodeModal, setAuthQRCodeModal] = useState(false);


  const handleAddFamilyForAuth = useCallback((role) => {
    if (role === "parent") {
      onAddFamily(role);
      return;
    }
    setAuthQRCodeModal(true);
  }, []);

  const handleLinkAuthComplete = useCallback(() => {
    setAuthQRCodeModal(false);
  }, []);

  const handleLinkAuthBack = useCallback(() => {
    setAuthQRCodeModal(false);
  }, []);

  const handleSendMessage = useCallback((primaryFamilyMember) => {
    onSendMessageClick(primaryFamilyMember?.uid, primaryFamilyMember?.name);
  }, []);

  return (
    <div className="main-screen">
      <div className="main-screen-scroll">
        <MainHeader
          selfProfile={selfProfile}
          familyMembers={familyMembers}
          onAddFamily={handleAddFamilyForAuth}
          onNotificationClick={onNotificationClick}
          hasUnreadNotification={hasUnreadNotification}
        />

      { authQRCodeModal === true && (
        <StudentLinkScreen
          onComplete={handleLinkAuthComplete}
          onBack={handleLinkAuthBack}
          directShow={authQRCodeModal === true}
        />
      )}

        <SendMessageCard targetName={primaryFamilyName} onClick={ () => handleSendMessage(primaryFamilyMember) } />

        <TodoStack todos={todos} onTodoClick={onTodoClick} />
      </div>

      <TabBar activeTab={activeTab} onChange={setActiveTab} />

    </div>
  );
}

/* ================================================================
 * 아이콘들 (간단한 SVG, 색상은 CSS currentColor로 제어)
 * ================================================================ */
function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function QRCodeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* 좌상단 파인더 패턴 */}
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="5.5" y="5.5" width="2" height="2" fill="currentColor" stroke="none" />

      {/* 우상단 파인더 패턴 */}
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="16.5" y="5.5" width="2" height="2" fill="currentColor" stroke="none" />

      {/* 좌하단 파인더 패턴 */}
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="5.5" y="16.5" width="2" height="2" fill="currentColor" stroke="none" />

      {/* 우하단 데이터 셀들 */}
      <rect x="14" y="14" width="2.5" height="2.5" fill="currentColor" stroke="none" />
      <rect x="18.5" y="14" width="2.5" height="2.5" fill="currentColor" stroke="none" />
      <rect x="14" y="18.5" width="2.5" height="2.5" fill="currentColor" stroke="none" />
      <rect x="18.5" y="18.5" width="2.5" height="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function HomeIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

function MissionIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 12l2.5 2.5L16 9" />
    </svg>
  );
}

function CommunityIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function BenefitIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="13" rx="1" />
      <path d="M3 12h18M12 8v13" />
      <path d="M12 8c-1.5-4-6-4-6-1.5S9 8 12 8zM12 8c1.5-4 6-4 6-1.5S15 8 12 8z" />
    </svg>
  );
}

function AllIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export default MainScreen;
