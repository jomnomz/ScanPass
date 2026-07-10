import React, { useState, useEffect } from 'react';
import Modal from '../Modal/Modal';
import Button from '../../../Components/UI/Buttons/Button/Button';
import styles from './ReportGenerationModal.module.css';
import { supabase } from '../../../lib/supabase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes, faArrowLeft, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../Authentication/AuthProvider/AuthProvider';

const ReportGenerationModal = ({ isOpen, onClose, currentClass }) => {
  const { user } = useAuth();
  const [teacherId, setTeacherId] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [attendanceDates, setAttendanceDates] = useState([]);
  const [selectedDates, setSelectedDates] = useState({});
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [gradeLevel, setGradeLevel] = useState(null);

  const formatDate = (date, formatStr = 'yyyy-MM-dd') => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    if (formatStr === 'MMMM yyyy') {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
      return `${monthNames[d.getMonth()]} ${year}`;
    } else if (formatStr === 'MMM d') {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[d.getMonth()]} ${d.getDate()}`;
    }
    return `${year}-${month}-${day}`;
  };

  const startOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  };

  const endOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  };

  const addMonths = (date, months) => {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  };

  const subMonths = (date, months) => {
    return addMonths(date, -months);
  };

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const extractGradeLevel = (className) => {
    if (!className) return null;
    const match = className.match(/^(\d+)[-\s]/);
    return match ? match[1] : null;
  };

  useEffect(() => {
    const getTeacherId = async () => {
      if (!user?.email) return;
      
      const { data, error } = await supabase
        .from('teachers')
        .select('id')
        .eq('email_address', user.email)
        .single();
        
      if (!error && data) {
        setTeacherId(data.id);
      }
    };
    
    getTeacherId();
  }, [user]);

  useEffect(() => {
    if (currentClass) {
      const grade = extractGradeLevel(currentClass);
      setGradeLevel(grade);
    }
  }, [currentClass]);

  useEffect(() => {
    if (!isOpen || !teacherId || !gradeLevel) return;
    
    loadMonthData();
  }, [isOpen, teacherId, gradeLevel, currentMonth]);

  const loadMonthData = async () => {
    setLoading(true);
    
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      
      console.log(`Loading data for Grade ${gradeLevel}, ${formatDate(start)} to ${formatDate(end)}`);
      
      const { data: gradeData, error: gradeError } = await supabase
        .from('grades')
        .select('id')
        .eq('grade_level', gradeLevel)
        .single();
      
      if (gradeError) throw gradeError;
      if (!gradeData) throw new Error(`Grade ${gradeLevel} not found`);
      
      const { data: students, error: studentsError } = await supabase
          .from('students')
          .select('id, lrn')  // lrn no longer needed here either, but harmless to keep
          .eq('grade_id', gradeData.id);

        if (studentsError) throw studentsError;

        const studentIds = students?.map(s => s.id) || [];

        if (studentIds.length === 0) {
          console.log('No students found for this grade');
          setAttendanceDates([]);
          setSelectedDates({});
          setLoading(false);
          return;
        }

        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance')
          .select('date, student_id')
          .gte('date', formatDate(start))
          .lte('date', formatDate(end))
          .in('student_id', studentIds);
      
      if (attendanceError) throw attendanceError;
      
      console.log('Attendance data found:', attendanceData?.length);
      
      const uniqueDates = [...new Set(attendanceData?.map(item => item.date) || [])].sort();
      console.log('Unique dates with ANY attendance:', uniqueDates);
      
      setAttendanceDates(uniqueDates);
      
      const { data: savedDays, error: savedError } = await supabase
        .from('class_school_days')
        .select('date')
        .eq('class_name', `Grade ${gradeLevel}`)
        .eq('teacher_id', teacherId)
        .gte('date', formatDate(start))
        .lte('date', formatDate(end));
      
      if (savedError) {
        console.error('Saved days error:', savedError);
        throw savedError;
      }
      
      console.log('Saved school days:', savedDays);
      
      const initialSelections = {};
      const savedDateSet = new Set(savedDays?.map(item => item.date) || []);
      
      if (savedDateSet.size > 0) {
        uniqueDates.forEach(date => {
          initialSelections[date] = savedDateSet.has(date);
        });
      } else {
        uniqueDates.forEach(date => {
          initialSelections[date] = true;
        });
      }
      
      setSelectedDates(initialSelections);
      setHasChanges(false);
      
    } catch (error) {
      console.error('Error loading month data:', error);
      alert('Error loading data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDateClick = (dateStr) => {
    if (!attendanceDates.includes(dateStr)) return;
    
    const newSelected = !selectedDates[dateStr];
    setSelectedDates(prev => ({
      ...prev,
      [dateStr]: newSelected
    }));
    setHasChanges(true);
  };

  const saveSchoolDays = async () => {
    if (!teacherId || !gradeLevel) return;
    
    try {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      
      const datesToSave = Object.entries(selectedDates)
        .filter(([dateStr, isSelected]) => isSelected)
        .map(([dateStr]) => dateStr);
      
      console.log('Saving dates for Grade', gradeLevel, ':', datesToSave);
      
      const { error: deleteError } = await supabase
        .from('class_school_days')
        .delete()
        .eq('class_name', `Grade ${gradeLevel}`)
        .eq('teacher_id', teacherId)
        .gte('date', formatDate(start))
        .lte('date', formatDate(end));
      
      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw deleteError;
      }
      
      if (datesToSave.length > 0) {
        const records = datesToSave.map(dateStr => ({
          date: dateStr,
          class_name: `Grade ${gradeLevel}`,
          teacher_id: teacherId,
          created_at: new Date().toISOString()
        }));
        
        console.log('Inserting records:', records);
        
        const { error: insertError } = await supabase
          .from('class_school_days')
          .insert(records);
        
        if (insertError) {
          console.error('Insert error:', insertError);
          throw insertError;
        }
      }
      
      alert(`Successfully saved ${datesToSave.length} valid school days for Grade ${gradeLevel}`);
      setHasChanges(false);
      
      loadMonthData();
      
    } catch (error) {
      console.error('Error saving school days:', error);
      alert('Failed to save: ' + error.message);
    }
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = new Date(year, month, 1).getDay();
    
    const days = [];
    
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = formatDate(date);
      const hasAttendance = attendanceDates.includes(dateStr);
      const isSelected = selectedDates[dateStr] || false;
      
      days.push({
        day,
        date,
        dateStr,
        hasAttendance,
        isSelected
      });
    }
    
    return (
      <div className={styles.calendarGrid}>
        <div className={styles.weekdays}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className={styles.weekday}>{day}</div>
          ))}
        </div>
        
        <div className={styles.daysGrid}>
          {days.map((dayData, index) => {
            if (!dayData) {
              return <div key={`empty-${index}`} className={styles.emptyCell}></div>;
            }
            
            const { day, dateStr, hasAttendance, isSelected } = dayData;
            const canClick = hasAttendance;
            
            return (
              <div
                key={dateStr}
                className={`${styles.dayCell} ${hasAttendance ? styles.hasAttendance : ''} ${isSelected ? styles.selected : ''}`}
                style={{
                  backgroundColor: hasAttendance && isSelected ? '#10b981' : 
                                 hasAttendance && !isSelected ? '#f3f4f6' : 
                                 '#ffffff',
                  border: hasAttendance ? '1px solid #d1d5db' : '1px solid #e5e7eb',
                  cursor: canClick ? 'pointer' : 'default'
                }}
                onClick={() => canClick && handleDateClick(dateStr)}
                title={`${formatDate(dayData.date, 'MMM d')} - ${hasAttendance ? 'Has attendance data' : 'No data'}${isSelected ? ' (Valid school day)' : ''}`}
              >
                <div className={styles.dayNumber}>{day}</div>
                {hasAttendance && isSelected && (
                  <div className={styles.checkmark}>
                    <FontAwesomeIcon icon={faCheck} />
                  </div>
                )}
                {hasAttendance && !isSelected && (
                  <div className={styles.xmark}>
                    <FontAwesomeIcon icon={faTimes} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const getMonthSummary = () => {
    const totalDaysWithAttendance = attendanceDates.length;
    const selectedSchoolDays = Object.values(selectedDates).filter(v => v).length;
    
    return (
      <div className={styles.monthSummary}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Days with Attendance:</span>
          <span className={styles.summaryValue}>{totalDaysWithAttendance}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Valid School Days:</span>
          <span className={styles.summaryValue} style={{color: '#10b981'}}>{selectedSchoolDays}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Teacher Override:</span>
          <span className={styles.summaryValue} style={{color: hasChanges ? '#f59e0b' : '#6b7280'}}>
            {hasChanges ? 'Unsaved Changes' : 'No Changes'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div className={styles.reportGenerationModal}>
        <div className={styles.modalHeader}>
          <h2>Mark Valid Days - Grade {gradeLevel}</h2>
          <p className={styles.subtitle}>
            Green boxes have attendance data. Click to toggle as valid school day.
            <br />
            <small>This configuration will affect ALL sections in Grade {gradeLevel}</small>
          </p>
        </div>
        
        <div className={styles.monthNavigation}>
          <Button
            icon={<FontAwesomeIcon icon={faArrowLeft} />}
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            color="secondary"
            height="xs"
            width="xxss"
          />
          <h3>{formatDate(currentMonth, 'MMMM yyyy')}</h3>
          <Button
            icon={<FontAwesomeIcon icon={faArrowRight} />}
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            color="secondary"
            height="xs"
            width="xxss"
          />
        </div>
        
        {getMonthSummary()}
        
        <div className={styles.calendarContainer}>
          {loading ? (
            <div className={styles.loading}>Loading attendance data...</div>
          ) : attendanceDates.length === 0 ? (
            <div className={styles.noData}>
              No attendance data found for Grade {gradeLevel} in {formatDate(currentMonth, 'MMMM yyyy')}
            </div>
          ) : (
            renderCalendar()
          )}
        </div>
        
        
        <div className={styles.footer}>
          <div className={styles.footerActions}>
            <Button
              label="Close"
              color="secondary"
              onClick={onClose}
              height="sm"
            />
            <Button
              label="Save"
              color="success"
              onClick={saveSchoolDays}
              disabled={!hasChanges}
              height="sm"
            />
            <Button
              label="Refresh"
              color="primary"
              onClick={loadMonthData}
              height="sm"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ReportGenerationModal;