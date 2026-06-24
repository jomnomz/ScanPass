import React, { useState, useEffect } from "react";
import styles from "./DatePickerCalendar.module.css";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function toKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
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

export default function DatePickerCalendar({ onSelect, hasDataDates = [], selectedDateKey }) {
  const hasDataSet = new Set(hasDataDates);
  const today = getRealToday();

  const initSelected = parseKey(selectedDateKey) || today;

  const [view, setView] = useState({ y: initSelected.y, m: initSelected.m });
  const [selected, setSelected] = useState(initSelected);

  useEffect(() => {
    const parsed = parseKey(selectedDateKey);
    if (!parsed) return;
    setSelected(parsed);
    setView({ y: parsed.y, m: parsed.m });
  }, [selectedDateKey]);

  const firstDay = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();

  const isViewAtCurrentMonth = view.y === today.y && view.m === today.m;
  const canGoNext = !isViewAtCurrentMonth;

  function changeMonth(dir) {
    setView((prev) => {
      let m = prev.m + dir;
      let y = prev.y;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      return { y, m };
    });
  }

  function handleSelect(d) {
    if (isFutureDate(view.y, view.m, d)) return;
    const key = toKey(view.y, view.m, d);
    const isToday = isTodayDate(view.y, view.m, d);
    if (!isToday && !hasDataSet.has(key)) return;

    const next = { y: view.y, m: view.m, d };
    setSelected(next);
    onSelect?.({
      date: new Date(view.y, view.m, d),
      isToday,
      key,
    });
  }

  const selKey = toKey(selected.y, selected.m, selected.d);
  const isSelectedToday = isTodayDate(selected.y, selected.m, selected.d);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <button className={styles.navBtn} onClick={() => changeMonth(-1)}>&#8592;</button>
        <span className={styles.monthLabel}>{MONTHS[view.m]} {view.y}</span>
        <button
          className={`${styles.navBtn} ${canGoNext ? styles.active : styles.disabled}`}
          onClick={() => canGoNext && changeMonth(1)}
          disabled={!canGoNext}
        >
          &#8594;
        </button>
      </div>

      <div className={styles.grid}>
        {DAY_LABELS.map((l) => (
          <div key={l} className={styles.dayLabel}>{l}</div>
        ))}

        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}

        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
          const key = toKey(view.y, view.m, d);
          const future = isFutureDate(view.y, view.m, d);
          const todayCell = isTodayDate(view.y, view.m, d);
          const isSel = selKey === key;
          const hasData = hasDataSet.has(key);
          const noData = !todayCell && !hasData && !future;
          
          const shouldHide = future && !hasData;

          let numClass = styles.dayNum;
          if (isSel && todayCell)  numClass = `${styles.dayNum} ${styles.dayNumTodaySel}`;
          else if (isSel)          numClass = `${styles.dayNum} ${styles.dayNumSel}`;
          else if (todayCell)      numClass = `${styles.dayNum} ${styles.dayNumToday}`;
          else if (future && hasData) numClass = `${styles.dayNum} ${styles.dayNumFutureWithData}`;
          else if (future || noData) numClass = `${styles.dayNum} ${styles.dayNumFuture}`;

          let dotClass = styles.dot;
          if (todayCell)                dotClass = `${styles.dot} ${styles.dotToday}`;
          else if (hasData && !future)  dotClass = `${styles.dot} ${styles.dotHasData}`;
          else if (hasData && future)   dotClass = `${styles.dot} ${styles.dotHasData}`;

          if (shouldHide) {
            return <div key={d} className={styles.cellHidden} />;
          }

          return (
            <div
              key={d}
              onClick={() => !future && !noData && handleSelect(d)}
              className={`${styles.cell}${(future && !hasData) || noData ? ` ${styles.cellFuture}` : ""}`}
            >
              <div className={numClass}>{d}</div>
              <div className={dotClass} />
            </div>
          );
        })}
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
      </div>
    </div>
  );
}