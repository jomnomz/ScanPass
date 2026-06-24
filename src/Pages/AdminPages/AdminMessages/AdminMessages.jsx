import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './AdminMessages.module.css';
import SectionLabel from '../../../Components/UI/Labels/SectionLabel/SectionLabel.jsx';
import MessageTable from '../../../Components/Tables/MessageTable/MessageTable.jsx';
import Input from '../../../Components/UI/Input/Input.jsx';
import DatePickerCalendar from '../../../Components/UI/Buttons/DatePickerCalendar/DatePickerCalendar';
import { supabase } from '../../../lib/supabase';
import Button from '../../../Components/UI/Buttons/Button/Button.jsx';

function AdminMessages() {
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

  const fetchAvailableDates = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_distinct_sms_dates');
      if (error) throw error;

      const uniqueDates = (data || [])
        .map(row => {
          if (!row?.date) return null;
          const m = String(row.date).match(/^\d{4}-\d{2}-\d{2}/);
          return m ? m[0] : null;
        })
        .filter(Boolean);

      const today = getCurrentPhilippinesDate();
      // Always inject today even if no SMS sent yet
      const allDates = [...new Set([today, ...uniqueDates])];

      setAvailableDates(allDates);

      if (!selectedDate) {
        setSelectedDate(today); // always default to today
      }
    } catch (err) {
      console.error('❌ Failed to fetch SMS dates:', err);
      const today = getCurrentPhilippinesDate();
      setAvailableDates([today]);
      setSelectedDate(today);
    }
  }, [getCurrentPhilippinesDate]);

  useEffect(() => {
    fetchAvailableDates();
  }, [fetchAvailableDates]);

  useEffect(() => {
    const channel = supabase
      .channel('public:sms_logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sms_logs' }, () => {
        fetchAvailableDates();
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch (e) {}
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
    const monthStr = sel.toLocaleString('default', { month: 'short' });
    if (isToday) return `Today · ${monthStr} ${d}, ${y}`;
    return `Past Date · ${monthStr} ${d}, ${y}`;
  };

  const handleSearchChange = (e) => setSearchTerm(e.target.value);
  const handleSectionSelect = (section) => setSelectedSection(section);
  const handleClearSectionFilter = () => setSelectedSection('');
  const handleSectionsUpdate = (sections) => setAvailableSections(sections);
  const handleGradeUpdate = (grade) => setCurrentGrade(grade);

  return (
    <main className={styles.main}>
      <SectionLabel label="Notification Records" />

      <div className={styles.top}>
        <div className={styles.searchAndFilter}>
          <div className={styles.searchContainer}>
            <Input
              placeholder="Search SMS Messages"
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

      <MessageTable
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

export default AdminMessages;