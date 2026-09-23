import { useState, useCallback, useEffect} from "react";

import "../css/StudentMenuGrid.css";

// 기본 메뉴 목록 - 필요에 따라 항목 추가/제거만 하면 그리드는 자동으로 줄바꿈됩니다.
const DEFAULT_STUDENT_MENUS = [
  {
    key: "school",
    label: "학교 등록",
    icon: "🏫",
    color: "#4C8DFF",
    register: false,
  },
  {
    key: "academy",
    label: "학원 등록",
    icon: "📚",
    color: "#FF9F40",
    register: false,
  },
  {
    key: "class",
    label: "수업 등록",
    icon: "📝",
    color: "#34C77B",
    register: false,
  },
  {
    key: "timetable",
    label: "시간표",
    icon: "🗓️",
    color: "#A566FF",
    register: false,
  },
  {
    key: "notice",
    label: "알림장",
    icon: "📢",
    color: "#FF5A6E",
    register: false,
  },
  {
    key: "parentLink",
    label: "부모님 연결",
    icon: "🔗",
    color: "#20C4C8",
    register: false,
  },
];

function requestNativeMenuItem(menu) {
  if (window.webkit?.messageHandlers?.menuItemReq) {
    window.webkit.messageHandlers.menuItemReq.postMessage(menu);
  } else if (window.AndroidBridge?.menuItemReq) {
    window.AndroidBridge.menuItemReq(menu);
  } else {
    console.warn("Native 메뉴 읽어들이는 브릿지를 찾을 수 없습니다.");
  }
}

const menuItemListeners = new Set();

if (typeof window !== "undefined" && !window.__menuItemDispatcherInstalled) {
  window.__menuItemDispatcherInstalled = true;

  window.onNativeMenuItem = (payload) => {

    console.warn("window.onNativeMenuItem payload.label = " + payload?.label + "  payload.register = " + payload?.register);

    menuItemListeners.forEach((listener) => listener(payload));
  };
}

function useMenuListener(key, onMenuReceived) {
  useEffect(() => {
    const listener = (payload) => {

      console.warn("window.useMenuListener payload.label = " + payload?.label + "  key = " + key);

      if (payload?.key !== key) return;
      if (payload) {
        onMenuReceived(payload);
      }
    };
    menuItemListeners.add(listener);
    return () => {
      menuItemListeners.delete(listener);
    };
  }, [key, onMenuReceived])
}

function MenuGridDisplay({menu, onSelect}) {
  const [menuData, setMenuData] = useState(menu || null);
  const [key, setKey] = useState(menu.key || null);

  console.info("MenuGridDisplay key = " + key);

  useEffect(() => {
    setMenuData(menu || null);
  }, [menu])

  const handleMenuReceived = useCallback((menuItem) => {
    setMenuData(menuItem);
  }, []);

  useMenuListener(key, handleMenuReceived);

  useEffect(() => {
    if (menuData.register || !key) return;
    requestNativeMenuItem(menuData);
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
function StudentMenuGrid({ onSelect }) {
  const [menus, setMenus] = useState(DEFAULT_STUDENT_MENUS)

  return (
    <div className="student-menu-grid">
      {menus.map((menu) => (
        MenuGridDisplay({ menu,  onSelect})
      ))}
    </div>
  );
}

export default StudentMenuGrid;
export { DEFAULT_STUDENT_MENUS };