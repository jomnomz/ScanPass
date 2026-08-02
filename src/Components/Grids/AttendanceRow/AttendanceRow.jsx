import React, { useState, useEffect, useRef } from "react";
import styles from "./AttendanceRow.module.css";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function getRealToday() {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
}

function isFutureDate(y, m, d) {
  const today = getRealToday();
  if (y > today.y) return true;
  if (y === today.y && m > today.m) return true;
  if (y === today.y && m === today.m && d > today.d) return true;
  return false;
}

function isTodayDate(y, m, d) {
  const today = getRealToday();
  return y === today.y && m === today.m && d === today.d;
}

function parseKey(key) {
  if (!key) return null;
  const parts = key.split("-").map(Number);
  if (parts.length !== 3) return null;
  return { y: parts[0], m: parts[1] - 1, d: parts[2] };
}

/**
 * hasDataDates: array of "YYYY-MM-DD" strings for days that actually have
 * attendance records — same shape as DatePickerCalendar's prop. A past day
 * NOT in this set is treated as having no attendance data: it's dimmed and
 * not selectable, same as a future day. Today is always shown/selectable
 * regardless of whether a record exists yet.
 */
export default function AttendanceRow({ onSelect, selectedDateKey, hasDataDates = [] }) {
  const hasDataSet = new Set(hasDataDates);
  const today = getRealToday();
  const initSelected = parseKey(selectedDateKey) || today;

  const [view, setView] = useState({ y: initSelected.y, m: initSelected.m });
  const [selected, setSelected] = useState(initSelected);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const rowRef = useRef(null);
  const todayCellRef = useRef(null);
  const hasAutoScrolled = useRef(false);

  useEffect(() => {
    const parsed = parseKey(selectedDateKey);
    if (!parsed) return;
    setSelected(parsed);
    setView({ y: parsed.y, m: parsed.m });
  }, [selectedDateKey]);

  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const isViewAtCurrentMonth = view.y === today.y && view.m === today.m;
  const canGoNextMonth = !isViewAtCurrentMonth;

  // How many school days have actually happened this (viewed) month —
  // driven by real attendance records (hasDataDates), not just elapsed
  // calendar days. Today counts too, the moment it has a record.
  const viewMonthPrefix = `${view.y}-${String(view.m + 1).padStart(2, "0")}`;
  const schoolDaysThisMonth = hasDataDates.filter((key) => key.startsWith(viewMonthPrefix)).length;

  function changeMonth(dir) {
    setView((prev) => {
      let m = prev.m + dir;
      let y = prev.y;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      return { y, m };
    });
  }

  function isSelectable(y, m, d) {
    if (isFutureDate(y, m, d)) return false;
    if (isTodayDate(y, m, d)) return true;
    return hasDataSet.has(toKey(y, m, d));
  }

  function handleSelect(d) {
    if (!isSelectable(view.y, view.m, d)) return;
    const key = toKey(view.y, view.m, d);
    const isToday = isTodayDate(view.y, view.m, d);

    setSelected({ y: view.y, m: view.m, d });
    onSelect?.({ date: new Date(view.y, view.m, d), isToday, key });
  }

  function updateScrollButtons() {
    const el = rowRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  // Default view: bring today's cell into view — but only if it isn't
  // already visible. scrollIntoView's "nearest" option does the minimum
  // scroll needed (none, if today's already on screen) instead of always
  // jumping to the end of the row (which used to overshoot past today
  // whenever today wasn't the last day being rendered).
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    const t = setTimeout(() => {
      if (!hasAutoScrolled.current) {
        if (isViewAtCurrentMonth && todayCellRef.current) {
          todayCellRef.current.scrollIntoView({
            inline: "nearest",
            block: "nearest",
            behavior: "auto",
          });
        } else {
          // Viewing a past month with no "today" cell — anchor to the end.
          el.scrollLeft = el.scrollWidth;
        }
        hasAutoScrolled.current = true;
      }
      updateScrollButtons();
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Re-anchor to the right whenever the month changes (not just on first mount).
  useEffect(() => {
    hasAutoScrolled.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.y, view.m]);

  function scrollRow(dir) {
    const el = rowRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 350, behavior: "smooth" });
  }

  const selKey = toKey(selected.y, selected.m, selected.d);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.monthNav}>
            <button className={`${styles.navBtn} ${styles.active}`} onClick={() => changeMonth(-1)}>
              &#8592;
            </button>
            <span className={styles.monthLabel}>{MONTHS[view.m]} {view.y}</span>
            <button
              className={`${styles.navBtn} ${canGoNextMonth ? styles.active : styles.disabled}`}
              onClick={() => canGoNextMonth && changeMonth(1)}
              disabled={!canGoNextMonth}
            >
              &#8594;
            </button>
          </div>
          <div className={styles.divider} />
          <span className={styles.schoolDaysLabel}>
            <span className={styles.schoolDaysCount}>{schoolDaysThisMonth}</span> School Days this month
          </span>
        </div>

        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <div className={styles.legendDotToday} />
            <span>Today</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendDotHasData} />
            <span>Past date</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendDotNoData} />
            <span>No data</span>
          </div>
        </div>
      </div>

      <div className={styles.rowWrap}>
        <button
          className={`${styles.scrollBtn} ${!canScrollLeft ? styles.scrollBtnHidden : ""}`}
          onClick={() => scrollRow(-1)}
          aria-label="Scroll earlier days"
        >
          &#8249;
        </button>

        <div className={styles.row} ref={rowRef} onScroll={updateScrollButtons}>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
            const key = toKey(view.y, view.m, d);
            const future = isFutureDate(view.y, view.m, d);
            const todayCell = isTodayDate(view.y, view.m, d);
            const hasData = hasDataSet.has(key);
            const selectable = isSelectable(view.y, view.m, d);
            const isSel = selKey === key;

            let numClass = styles.dayNum;
            if (isSel && todayCell) numClass = `${styles.dayNum} ${styles.dayNumTodaySel}`;
            else if (isSel) numClass = `${styles.dayNum} ${styles.dayNumSel}`;
            else if (todayCell) numClass = `${styles.dayNum} ${styles.dayNumToday}`;
            else if (!selectable) numClass = `${styles.dayNum} ${styles.dayNumFuture}`;

            let dotClass = styles.dot;
            if (todayCell) dotClass = `${styles.dot} ${styles.dotToday}`;
            else if (hasData && !future) dotClass = `${styles.dot} ${styles.dotHasData}`;
            else if (!future) dotClass = `${styles.dot} ${styles.dotNoData}`;

            return (
              <div
                key={d}
                ref={todayCell ? todayCellRef : null}
                onClick={() => handleSelect(d)}
                className={`${styles.cell} ${!selectable ? styles.cellFuture : ""}`}
              >
                <div className={numClass}>{String(d).padStart(2, "0")}</div>
                <div className={dotClass} />
              </div>
            );
          })}
        </div>

        <button
          className={`${styles.scrollBtn} ${!canScrollRight ? styles.scrollBtnHidden : ""}`}
          onClick={() => scrollRow(1)}
          aria-label="Scroll later days"
        >
          &#8250;
        </button>
      </div>
    </div>
  );
}