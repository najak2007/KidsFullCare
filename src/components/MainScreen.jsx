// src/pages/MainScreen.jsx
import { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import "../css/MainScreen.css";


function requestNativeProfileImagePicker() {
    if (window.webkit?.messageHandlers?.pickProfileImage) {
        window.webkit.messageHandlers.pickProfileImage.postMessage(null);
    } else if (window.AndroidBridge?.pickProfileImage) {
        window.AndroidBridge.pickProfileImage();
    } else {
        console.warn("Native 이미지 선택 브릿지를 찾을 수 없습니다.");
    }
}

/* ================================================================
 * 상단 아바타 줄: 본인 → family(연결된 학부모/학생들) → 추가 버튼
 * ================================================================ */
function AvatarRow({ selfProfile, familyMembers, onAddFamily }) {
  return (
    <div className="avatar-row">
      <AvatarCircle name={selfProfile?.name} image={selfProfile?.image} isSelf />
      {familyMembers.map((member) => (
        <AvatarCircle key={member.uid} name={member.name} image={member.image} />
      ))}
      <button type="button" className="avatar-add-btn" onClick={onAddFamily} aria-label="가족 추가">
        <PlusIcon />
      </button>
    </div>
  );
}

function AvatarCircle({ name, image, isSelf }) {
    const [internalImage, setInternalImage] = useState(image || null);
    const [internalName, setInternalName] = useState(name || null);
    const profileImage = image !== undefined ? image : internalImage;
    const userName = name !== undefined ? name : internalName;

    useEffect(() => {
        window.onNativeProfileImagePicked = (payload) => {
            if (!payload?.imageBase64) {
                setInternalImage(null);
                return;
            }
            const dataUrl = `data:image/jpeg;base64,${payload.imageBase64}`;
            setInternalImage(dataUrl);

            if ( !payload?.userName) {
                setInternalName(null);
                return;
            }
            setInternalName(payload.userName);
        };

        return () => {
            delete window.onNativeProfileImagePicked;
        };

    }, []);

    const handleProfileSelectClick = useCallback(() => {
        requestNativeProfileImagePicker();
    }, []);

    return (
    /*
    <div className="avatar-item">
      <div
        className={`avatar-circle ${isSelf ? "avatar-circle-self" : ""}`}
        style={image ? { backgroundImage: `url(${image})` } : undefined}
      >
        {!image && <span className="avatar-initial">{name?.[0] || "?"}</span>}
      </div>
      {isSelf && name && <span className="avatar-name">{name}</span>}
    </div>
    */
        <div className="avatar-item">
            <button 
                type="button"
                className={`avatar-circle ${isSelf ? "avatar-circle-self" : ""}`}
                onClick={handleProfileSelectClick}
                style={profileImage ? { backgroundImage: `url(${profileImage})` } : undefined}
            >
            {!profileImage && <span className="avatar-initial">{userName?.[0] || "?"}</span>}
            </button>
        {isSelf && userName && <span className="avatar-name">{userName}</span>}
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
 * "OO님에게 송금하기" 카드
 * ================================================================ */
function SendMoneyCard({ targetName, onClick }) {
  if (!targetName) return null;
  return (
    <button type="button" className="send-money-card" onClick={onClick}>
      <span>{targetName} 님에게 송금하기</span>
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
  selfProfile,          // { name, image }
  familyMembers = [],   // [{ uid, name, image }]
  todos = [],           // [{ id, title, emoji }]
  hasUnreadNotification = false,
  onAddFamily,
  onNotificationClick,
  onSendMoneyClick,
  onTodoClick,
}) {
  const [activeTab, setActiveTab] = useState("home");
  const primaryFamilyName = familyMembers[0]?.name;

  return (
    <div className="main-screen">
      <div className="main-screen-scroll">
        <MainHeader
          selfProfile={selfProfile}
          familyMembers={familyMembers}
          onAddFamily={onAddFamily}
          onNotificationClick={onNotificationClick}
          hasUnreadNotification={hasUnreadNotification}
        />

        <SendMoneyCard targetName={primaryFamilyName} onClick={onSendMoneyClick} />

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
