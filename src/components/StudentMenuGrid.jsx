import { useState, useCallback, useEffect} from "react";

import "../css/StudentMenuGrid.css";

// 기본 메뉴 목록 - 필요에 따라 항목 추가/제거만 하면 그리드는 자동으로 줄바꿈됩니다.
const DEFAULT_STUDENT_MENUS = [
  {
    key: "school",
    label: "학교 등록",
    icon: "🏫",
    color: "#4C8DFF",
  },
  {
    key: "academy",
    label: "학원 등록",
    icon: "📚",
    color: "#FF9F40",
  },
  {
    key: "class",
    label: "수업 등록",
    icon: "📝",
    color: "#34C77B",
  },
  {
    key: "timetable",
    label: "시간표",
    icon: "🗓️",
    color: "#A566FF",
  },
  {
    key: "notice",
    label: "알림장",
    icon: "📢",
    color: "#FF5A6E",
  },
  {
    key: "parentLink",
    label: "부모님 연결",
    icon: "🔗",
    color: "#20C4C8",
  },
];

function requestNativeMenuItem(key) {
  if (window.webkit?.messageHandlers?.menuItemReq) {
    window.webkit.messageHandlers.menuItemReq(key);
  } else if (window.AndroidBridge?.menuItemReq) {
    window.AndroidBridge.menuItemReq(key);
  } else {
    console.warn("Native 메뉴 읽어들이는 브릿지를 찾을 수 없습니다.");
  }
}

const menuItemListeners = new Set();

if (typeof window !== "undefined" && !window.__menuItemDispatcherInstalled) {
  window.__menuItemDispatcherInstalled = true;

  window.onNativeMenuItem = (payload) => {
    menuItemListeners.forEach((listener) => listener(payload));
  };
}

function useMenuListener(key, onMenuReceived) {
  useEffect(() => {
    const listener = (payload) => {
      if (payload?.key !== key) return;
      if (payload?.menu) {
        onMenuReceived(payload.menu);
      }
    };
    menuItemListeners.add(listener);
    return () => {
      menuItemListeners.delete(listener);
    };
  }, [key, onMenuReceived])
}

function MenuGridDisplay({key, menu, onSelect}) {
  const [menuData, setMenuData] = useState(menu || null);

  useEffect(() => {
    setMenuData(menu || null);
  }, [menu])

  const handleMenuReceived = useCallback((menuItem) => {
    setMenuData(menuItem);
  }, []);

  useMenuListener(key, handleMenuReceived);

  useEffect(() => {
    if (menuData || !key) return;
    requestNativeMenuItem(key);
  }, [key])


  return (
    <button
      key={menu.key}
      type="button"
      className="student-menu-item"
      onClick={() => onSelect?.(menu)}
      >
      <span
        className="student-menu-icon"
        style={{ backgroundColor: menu.color }}
        >
        {menu.icon}
      </span>
      <span className="student-menu-label">{menu.label}</span>
    </button>

  );
}


/**
 * @param {Object} props
 * @param {Array}  [props.menus]     - 표시할 메뉴 목록 (기본값: DEFAULT_STUDENT_MENUS)
 * @param {Function} props.onSelect  - 메뉴 클릭 시 호출, 클릭된 menu 객체를 인자로 받음
 */
function StudentMenuGrid({ menus = DEFAULT_STUDENT_MENUS, onSelect }) {
  return (
    <div className="student-menu-grid">
      {menus.map((menu) => (
        MenuGridDisplay({ menu.key, menu,  onSelect})
      ))}
    </div>
  );
}

export default StudentMenuGrid;
export { DEFAULT_STUDENT_MENUS };