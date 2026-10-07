import { useState, useEffect, useMemo } from "react";
import "../css/DateRangePickerModal.css";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const pad = (n) => String(n).padStart(2, "0");
export const toYmd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const ymdToDate = (ymd) => new Date(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8));

function DateRangePickerModal({ open, initialStart = "", initialEnd = "", onClose, onConfirm }) {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [viewDate, setViewDate] = useState(() => new Date());

  // 열릴 때마다 현재 선택값으로 초기화
  useEffect(() => {
    if (!open) return;
    setStart(initialStart);
    setEnd(initialEnd);
    setViewDate(initialStart ? ymdToDate(initialStart) : new Date());
  }, [open, initialStart, initialEnd]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const cells = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const list = Array(firstWeekday).fill(null);
    for (let d = 1; d <= lastDate; d++) list.push(toYmd(new Date(year, month, d)));
    return list;
  }, [year, month]);

  const moveMonth = (diff) => setViewDate(new Date(year, month + diff, 1));

  const handleDayClick = (ymd) => {
    if (!start || (start && end)) {
      // 새로 시작
      setStart(ymd);
      setEnd("");
    } else if (ymd < start) {
      // 시작일보다 이전을 누르면 시작일 교체
      setStart(ymd);
    } else {
      setEnd(ymd);
    }
  };

  const handleConfirm = () => {
    if (!start) return;
    onConfirm?.({ startDate: start, endDate: end || start });
  };

  if (!open) return null;

  const todayYmd = toYmd(new Date());

  return (
    <div className="drp-overlay" onClick={onClose}>
      <div className="drp-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="drp-header">
          <button type="button" className="drp-nav-btn" onClick={() => moveMonth(-1)} aria-label="이전 달">‹</button>
          <span className="drp-month-label">{year}년 {month + 1}월</span>
          <button type="button" className="drp-nav-btn" onClick={() => moveMonth(1)} aria-label="다음 달">›</button>
        </div>

        <div className="drp-grid drp-weekdays">
          {WEEKDAYS.map((w, i) => (
            <span key={w} className={i === 0 ? "sun" : i === 6 ? "sat" : ""}>{w}</span>
          ))}
        </div>

        <div className="drp-grid">
          {cells.map((ymd, idx) => {
            if (!ymd) return <span key={`empty-${idx}`} />;
            const isStart = ymd === start;
            const isEnd = ymd === end;
            const inRange = start && end && ymd > start && ymd < end;
            const cls = [
              "drp-day",
              isStart && "start",
              isEnd && "end",
              inRange && "in-range",
              ymd === todayYmd && "today",
              start && end && start !== end && isStart && "range-left",
              start && end && start !== end && isEnd && "range-right",
            ].filter(Boolean).join(" ");
            return (
              <button key={ymd} type="button" className={cls} onClick={() => handleDayClick(ymd)}>
                {Number(ymd.slice(6, 8))}
              </button>
            );
          })}
        </div>

        <div className="drp-summary">
          <div><span>시작</span><strong>{start || "-"}</strong></div>
          <div><span>종료</span><strong>{end || (start ? start : "-")}</strong></div>
        </div>

        <div className="drp-actions">
          <button type="button" className="drp-btn cancel" onClick={onClose}>취소</button>
          <button type="button" className="drp-btn confirm" onClick={handleConfirm} disabled={!start}>확인</button>
        </div>
      </div>
    </div>
  );
}

export default DateRangePickerModal;