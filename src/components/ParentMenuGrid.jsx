// src/components/ParentMenuGrid.jsx
//
// 부모(role === "parent") 메인 화면용 메뉴 그리드입니다.
// 네이티브가 onNativeAuthState payload.studentInfos 로 내려준, 연결된 학생별 studentInfo 를
// 학생 단위로 묶어서 StudentMenuGrid 와 같은 모양의 아이콘 그리드로 보여줍니다.
//
//   linkedStudents: [
//     { name, uid, register, studentInfo: { school: [ {...} ], academy: [ {...} ], ... } }
//   ]
//
//   - school  : 배열 중 "가장 마지막" 항목 하나만 메뉴로 표시
//   - academy : 배열에 등록된 모든 항목을 메뉴로 표시 (그 외 key 도 동일)
//
import { useState, useMemo, useCallback } from "react";
import "../css/StudentMenuGrid.css";
import "../css/ParentMenuGrid.css";

const MENU_STYLES = {
  school: { icon: "🏫", color: "#4C8DFF", typeLabel: "학교" },
  academy: { icon: "📚", color: "#FF9F40", typeLabel: "학원" },
};
const DEFAULT_MENU_STYLE = { icon: "📌", color: "#8E8E93", typeLabel: "등록 정보" };

// 여러 번 등록했어도 마지막 항목 하나만 보여줄 key
const LATEST_ONLY_KEYS = new Set(["school"]);
// 표시 순서 (여기에 없는 key 는 뒤에 이름순으로 붙습니다)
const KEY_ORDER = ["school", "academy"];

function keyRank(key) {
  const index = KEY_ORDER.indexOf(key);
  return index < 0 ? KEY_ORDER.length : index;
}

function getSubLabel(key, entry) {
  if (key === "school") {
    const className = entry.CLASS?.CLASS_NM ? `${entry.CLASS.CLASS_NM}반` : "";
    return [entry.GRADE, className].filter(Boolean).join(" ");
  }
  if (key === "academy") {
    return entry.REALM_SC_NM || "";
  }
  return "";
}

// studentInfo(map) → 그리드에 뿌릴 메뉴 배열
function buildMenus(studentInfo) {
  const info = studentInfo && typeof studentInfo === "object" ? studentInfo : {};
  const keys = Object.keys(info).sort(
    (a, b) => keyRank(a) - keyRank(b) || a.localeCompare(b)
  );

  const menus = [];
  keys.forEach((key) => {
    const entries = Array.isArray(info[key])
      ? info[key].filter((entry) => entry && typeof entry === "object")
      : [];
    if (entries.length === 0) return;

    const style = MENU_STYLES[key] || DEFAULT_MENU_STYLE;
    const visible = LATEST_ONLY_KEYS.has(key) ? [entries[entries.length - 1]] : entries;

    visible.forEach((entry, index) => {
      menus.push({
        id: `${key}-${index}`,
        key,
        entry,
        icon: style.icon,
        color: style.color,
        typeLabel: style.typeLabel,
        label: entry.label || entry.SCHUL_NM || entry.ACA_NM || entry.name || style.typeLabel,
        subLabel: getSubLabel(key, entry),
      });
    });
  });
  return menus;
}

// 학교 상세(시간표/급식식단/학사일정) 화면을 열 수 있을 만큼 정보가 있는지
function canOpenSchoolDetail(menu) {
  return menu.key === "school" && !!menu.entry.GRADE && !!menu.entry.CLASS;
}

function getDetailRows(menu) {
  const { key, entry } = menu;
  const join = (...parts) => parts.filter(Boolean).join(" ");

  const rows =
    key === "academy"
      ? [
          { label: "학원명", value: entry.ACA_NM || entry.label },
          { label: "분야", value: join(entry.REALM_SC_NM, entry.LE_ORD_NM) },
          { label: "주소", value: join(entry.FA_RDNMA || entry.address, entry.FA_RDNDA) },
          { label: "교육청", value: entry.ATPT_OFCDC_SC_NM },
          { label: "등록상태", value: entry.REG_STTUS_NM },
        ]
      : key === "school"
      ? [
          { label: "학교명", value: entry.SCHUL_NM || entry.label },
          { label: "학년/반", value: getSubLabel(key, entry) },
          { label: "주소", value: join(entry.ORG_RDNMA || entry.address, entry.ORG_RDNDA) },
          { label: "전화번호", value: entry.ORG_TELNO },
        ]
      : [
          { label: "이름", value: entry.label || entry.name },
          { label: "주소", value: entry.address },
        ];

  return rows.filter((row) => row.value);
}

function ParentMenuItem({ menu, onClick }) {
  return (
    <button type="button" className="student-menu-item" onClick={onClick}>
      <span className="student-menu-icon" style={{ backgroundColor: menu.color }}>
        {menu.icon}
      </span>
      <span className="student-menu-label">{menu.label}</span>
      {menu.subLabel && <span className="parent-menu-sublabel">{menu.subLabel}</span>}
    </button>
  );
}

function ParentMenuDetailSheet({ detail, onClose }) {
  if (!detail) return null;
  const { menu, student } = detail;
  const rows = getDetailRows(menu);

  return (
    <div className="parent-menu-sheet-overlay" onClick={onClose}>
      <div className="parent-menu-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="parent-menu-sheet-header">
          <span className="parent-menu-sheet-icon" style={{ backgroundColor: menu.color }}>
            {menu.icon}
          </span>
          <div className="parent-menu-sheet-titles">
            <span className="parent-menu-sheet-title">{menu.label}</span>
            <span className="parent-menu-sheet-subtitle">
              {[student?.name, menu.typeLabel].filter(Boolean).join(" · ")}
            </span>
          </div>
        </div>

        {rows.length > 0 && (
          <dl className="parent-menu-sheet-rows">
            {rows.map((row) => (
              <div key={row.label} className="parent-menu-sheet-row">
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <button type="button" className="parent-menu-sheet-close" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}

/**
 * @param {Object}   props
 * @param {Array}    props.linkedStudents  - [{ name, uid, register, studentInfo }]
 * @param {Function} props.onSelectSchool  - 학교 메뉴 선택 시 호출: (schoolEntry, student)
 */
function ParentMenuGrid({ linkedStudents = [], onSelectSchool }) {
  const [detail, setDetail] = useState(null); // { menu, student } | null

  const sections = useMemo(
    () =>
      (linkedStudents || [])
        .filter((student) => student?.uid)
        .map((student) => ({ student, menus: buildMenus(student.studentInfo) })),
    [linkedStudents]
  );

  const handleSelect = useCallback(
    (menu, student) => {
      if (canOpenSchoolDetail(menu)) {
        onSelectSchool?.(menu.entry, student);
        return;
      }
      setDetail({ menu, student });
    },
    [onSelectSchool]
  );

  if (sections.length === 0) return null;

  return (
    <div className="parent-menu-sections">
      {sections.map(({ student, menus }) => (
        <section key={student.uid} className="parent-menu-section">
          <h2 className="parent-menu-section-title">
            {student.name ? `${student.name}의 학교 · 학원` : "학교 · 학원"}
          </h2>

          {menus.length === 0 ? (
            <p className="parent-menu-empty">아직 등록한 학교나 학원이 없어요.</p>
          ) : (
            <div className="student-menu-grid parent-menu-grid">
              {menus.map((menu) => (
                <ParentMenuItem
                  key={menu.id}
                  menu={menu}
                  onClick={() => handleSelect(menu, student)}
                />
              ))}
            </div>
          )}
        </section>
      ))}

      <ParentMenuDetailSheet detail={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

export default ParentMenuGrid;
