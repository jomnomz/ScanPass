import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './AdminAttendance.module.css';
import SectionLabel from '../../../Components/UI/Labels/SectionLabel/SectionLabel.jsx';
import AttendanceTable from '../../../Components/Tables/AttendanceTable/AttendanceTable.jsx';
import Input from '../../../Components/UI/Input/Input.jsx';
import DatePickerCalendar from '../../../Components/UI/Buttons/DatePickerCalendar/DatePickerCalendar';
import { supabase } from '../../../lib/supabase';
import Button from '../../../Components/UI/Buttons/Button/Button.jsx';

function AdminAttendance() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [availableSections, setAvailableSections] = useState([]);
  const [currentGrade, setCurrentGrade] = useState('all');
  const [loading, setLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState('');
  const [availableDates, setAvailableDates] = useState([]);

  const [calendarOpen, setCalendarOpen] = useState(false);
  const calendarBtnRef = useRef(null);

  const getCurrentPhilippinesDate = useCallback(() => {
    const now = new Date();
    const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return phTime.toISOString().split('T')[0];
  }, []);

  const fetchAvailableDatesFallback = useCallback(async () => {
    try {
      let allDates = [];
      let from = 0;
      const BATCH = 1000;

      while (true) {
        const { data, error } = await supabase
          .from('attendance')
          .select('date')
          .order('date', { ascending: false })
          .range(from, from + BATCH - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allDates = allDates.concat(data.map(r => r.date).filter(Boolean));
        if (data.length < BATCH) break;
        from += BATCH;
      }

      const uniqueDates = [...new Set(allDates.map(d => {
        const m = String(d).match(/^\d{4}-\d{2}-\d{2}/);
        return m ? m[0] : null;
      }).filter(Boolean))];

      console.log(`✅ Fallback: ${uniqueDates.length} unique dates from ${allDates.length} rows`);
      setAvailableDates(uniqueDates);

      if (!selectedDate) {
        const today = getCurrentPhilippinesDate();
        setSelectedDate(uniqueDates.includes(today) ? today : (uniqueDates[0] || today));
      }
    } catch (err) {
      console.error('❌ Fallback also failed:', err);
      setAvailableDates([]);
    }
  }, []);

  const fetchAvailableDates = useCallback(async () => {
    try {
      console.log('📅 Fetching distinct attendance dates via RPC...');

      const { data, error } = await supabase
        .rpc('get_distinct_attendance_dates');

      if (error) throw error;

      const normalize = (val) => {
        if (!val) return null;
        if (typeof val === 'string') {
          const m = val.match(/^\d{4}-\d{2}-\d{2}/);
          return m ? m[0] : null;
        }
        if (val instanceof Date) return val.toISOString().split('T')[0];
        return null;
      };

      const uniqueDates = (data || [])
        .map(row => normalize(row?.date))
        .filter(Boolean);

      console.log(`✅ Got ${uniqueDates.length} distinct dates`);
      console.log('📅 Range:', uniqueDates.at(-1), '→', uniqueDates[0]);
      console.log('📅 All dates:', uniqueDates);

      setAvailableDates(uniqueDates);

      if (!selectedDate) {
        const today = getCurrentPhilippinesDate();
        const todayExists = uniqueDates.includes(today);
        setSelectedDate(todayExists ? today : (uniqueDates[0] || today));
      }
    } catch (err) {
      console.error('❌ RPC failed, falling back to batch fetch...', err);
      await fetchAvailableDatesFallback();
    }
  }, [fetchAvailableDatesFallback]);

  useEffect(() => {
    fetchAvailableDates();
  }, [fetchAvailableDates, fetchAvailableDatesFallback]);

  useEffect(() => {
    const channel = supabase
      .channel('public:attendance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
        fetchAvailableDates();
      })
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        // ignore
      }
    };
  }, [fetchAvailableDates]);

  useEffect(() => {
    if (!calendarOpen) return;
    function handleClick(e) {
      if (calendarBtnRef.current && !calendarBtnRef.current.contains(e.target)) {
        setCalendarOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [calendarOpen]);

  const getDateLabel = () => {
    if (!selectedDate) return 'Select date';
    const [y, m, d] = selectedDate.split('-').map(Number);
    const sel = new Date(y, m - 1, d);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isToday = sel.getTime() === todayStart.getTime();
    const isPast = sel.getTime() < todayStart.getTime();
    const monthStr = sel.toLocaleString('default', { month: 'short' });
    
    if (isToday) return `Today · ${monthStr} ${d}, ${y}`;
    if (isPast) return `Past Date · ${monthStr} ${d}, ${y}`;
    return `${monthStr} ${d}, ${y}`;
  };

  const handleSearchChange = (e) => setSearchTerm(e.target.value);
  const handleSectionSelect = (section) => setSelectedSection(section);
  const handleClearSectionFilter = () => setSelectedSection('');
  const handleSectionsUpdate = (sections) => setAvailableSections(sections);
  const handleGradeUpdate = (grade) => setCurrentGrade(grade);

  return (
    <main className={styles.main}>
      <SectionLabel label="Attendance Records" />
      <div className={styles.top}>
        <div className={styles.searchAndFilter}>
          <div className={styles.searchContainer}>
            <Input
              placeholder="Search Attendance Records"
              value={searchTerm}
              onChange={handleSearchChange}
              search="true"
            />
          </div>

          <div className={styles.filtersContainer}>
            <div ref={calendarBtnRef} style={{ position: 'relative', display: 'inline-block' }}>
              <Button
                color="nav"
                height="sm"
                width="auto"
                onClick={() => setCalendarOpen((v) => !v)}
                icon={
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-icons" style={{ fontSize: '16px', opacity: 0.6 }}>calendar_today</span>
                    <span style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.15)' }} />
                    <span style={{ fontSize: '13px', fontWeight: 400 }}>{getDateLabel()}</span>
                    <span className="material-icons" style={{ fontSize: '16px', opacity: 0.5 }}>
                      {calendarOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                    </span>
                  </span>
                }
              />

              {calendarOpen && (
                <div style={{
                  position: 'absolute',
                  zIndex: 100,
                  top: 'calc(100% + 8px)',
                  right: 0,
                  left: 'auto',
                }}>
                  <DatePickerCalendar
                    selectedDateKey={selectedDate}
                    hasDataDates={availableDates}
                    onSelect={({ key }) => {
                      setSelectedDate(key);
                      setCalendarOpen(false);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AttendanceTable
        searchTerm={searchTerm}
        selectedSection={selectedSection}
        onSectionsUpdate={handleSectionsUpdate}
        onGradeUpdate={handleGradeUpdate}
        onClearSectionFilter={handleClearSectionFilter}
        onSectionSelect={handleSectionSelect}
        availableSections={availableSections}
        loading={loading}
        selectedDate={selectedDate}
      />
    </main>
  );
}

export default AdminAttendance;