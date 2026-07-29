import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { formatStudentName, formatNA } from '../../../Utils/Formatters';
import { sortEntities } from '../../../Utils/SortEntities';
import styles from './TeacherAttendanceTable.module.css';
import { supabase } from '../../../lib/supabase';
import Input from '../../UI/Inputs/Input/Input.jsx';
import Table from '../Table/Table.jsx';
import EntityDropdown from '../../UI/Buttons/EntityDropdown/EntityDropdown.jsx';
import DatePickerCalendar from '../../../Components/UI/Buttons/DatePickerCalendar/DatePickerCalendar';
import Button from '../../../Components/UI/Buttons/Button/Button.jsx';
import Pagination from '../../../Components/UI/Buttons/Pagination/Pagination.jsx';
import useSearchFilter from '../../Hooks/useSearchFilter.js';
import { useToast } from '../../Toast/ToastContext/ToastContext';
import { exportEntity } from '../../../Utils/exportEntity.js';
import { getProfileColor, getProfileInitial } from '../../../Utils/ProfileHelpers';
import DownloadIcon from '@mui/icons-material/Download';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare, faTimes } from "@fortawesome/free-solid-svg-icons";
import { useRowExpansion } from '../../Hooks/useRowExpansion';
import { shouldHandleRowClick } from '../../../Utils/TableHelpers';

const STATUS_OPTIONS = [
  { label: 'Present', value: 'present' },
  { label: 'Late', value: 'late' },
  { label: 'Absent', value: 'absent' }
];

const getPHDateIso = (date = new Date()) => {
  const phTime = new Date(date.getTime() + (8 * 60 * 60 * 1000));
  return phTime.toISOString().split('T')[0];
};

// ===== PROFILE CIRCLE RENDERER =====
const renderProfileCircle = (attendance, sizeClassName) => {
  const { bg, text } = getProfileColor(
    attendance.student_id ?? attendance.lrn ?? `${attendance.first_name}${attendance.last_name}`
  );

  if (attendance.photo_url) {
    return (
      <img
        src={attendance.photo_url}
        alt={formatStudentName(attendance)}
        className={sizeClassName}
        style={{ objectFit: 'cover' }}
      />
    );
  }

  return (
    <div className={sizeClassName} style={{ backgroundColor: bg, color: text }}>
      {getProfileInitial(attendance.first_name)}
    </div>
  );
};

// ===== TIME PICKER COMPONENT =====
const TimePicker = ({ value, onChange, name }) => {
  const handleChange = (e) => {
    const newTime = e.target.value;
    if (onChange) {
      onChange({ target: { name, value: newTime } });
    }
  };
  
  const handleClear = (e) => {
    e.stopPropagation();
    if (onChange) {
      onChange({ target: { name, value: '' } });
    }
  };
  
  return (
    <div className={styles.timeInputContainer}>
      <input
        type="time"
        name={name}
        value={value || ''}
        onChange={handleChange}
        className={styles.timeInput}
        step="60"
      />
      {value && (
        <button 
          type="button" 
          onClick={handleClear}
          className={styles.clearTimeButton}
          title="Clear time"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      )}
    </div>
  );
};

function TeacherAttendanceTable({
  className
}) {
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [displayDate, setDisplayDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [availableDates, setAvailableDates] = useState([]);
  const [datesLoading, setDatesLoading] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  
  // ===== EDIT STATE =====
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({
    time_in: '',
    time_out: ''
  });
  const [validationErrors, setValidationErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const calendarBtnRef = useRef(null);
  const { expandedRow, tableRef, toggleRow, isRowExpanded } = useRowExpansion();
  const { success, error: toastError } = useToast();

  const activeDate = selectedDate || getPHDateIso();

  const { searchTerm, setSearchTerm, filteredRows: searchFilteredRows } = useSearchFilter(
    attendances,
    [
      (row) => [row.first_name, row.last_name]
        .filter(Boolean)
        .join(' '),
      'lrn'
    ]
  );

  const parsedClass = useMemo(() => {
    if (!className) return { grade: null, section: null };
    const match = className.match(/^(\d+)[-\s](.+)$/);
    if (match) {
      return { grade: match[1].trim(), section: match[2].trim() };
    }
    return { grade: null, section: null };
  }, [className]);

  const getPhilippinesDisplayDate = useCallback((dateString) => {
    const date = new Date(`${dateString}T00:00:00Z`);
    const phTime = new Date(date.getTime() + (8 * 60 * 60 * 1000));

    return phTime.toLocaleDateString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, []);

  const parseClassName = useCallback((value) => {
    if (!value) {
      return { grade: null, section: null };
    }

    const match = value.match(/^(\d+)[-\s](.+)$/);

    if (match) {
      return {
        grade: match[1].trim(),
        section: match[2].trim()
      };
    }

    return { grade: null, section: null };
  }, []);

  const findSectionId = useCallback(async (grade, sectionName) => {
    try {
      const { data: gradeData, error: gradeError } = await supabase
        .from('grades')
        .select('id')
        .eq('grade_level', parseInt(grade, 10))
        .single();

      if (gradeError || !gradeData) {
        console.error('Error finding grade:', gradeError);
        return null;
      }

      const { data: sectionData, error: sectionError } = await supabase
        .from('sections')
        .select('id')
        .eq('grade_id', gradeData.id)
        .eq('section_name', sectionName)
        .single();

      if (sectionError || !sectionData) {
        console.error('Error finding section:', sectionError);
        return null;
      }

      return sectionData.id;
    } catch (fetchError) {
      console.error('Error in findSectionId:', fetchError);
      return null;
    }
  }, []);

  const fetchAvailableDates = useCallback(async () => {
    if (!className) {
      return;
    }

    setDatesLoading(true);

    try {
      const { grade, section } = parseClassName(className);

      if (!grade || !section) {
        setAvailableDates([]);
        return;
      }

      const sectionId = await findSectionId(grade, section);

      if (!sectionId) {
        setAvailableDates([]);
        return;
      }

      const { data: classStudents, error: studentsError } = await supabase
        .from('students')
        .select('id')
        .eq('section_id', sectionId);

      if (studentsError) {
        throw studentsError;
      }

      if (!classStudents?.length) {
        setAvailableDates([]);
        return;
      }

      const studentIds = classStudents.map((student) => student.id);
      const { data: attendanceDates, error: datesError } = await supabase
        .from('attendance')
        .select('date')
        .in('student_id', studentIds)
        .order('date', { ascending: false });

      if (datesError) {
        throw datesError;
      }

      const uniqueDates = [...new Set((attendanceDates || []).map((item) => item.date))];
      setAvailableDates(uniqueDates);
    } catch (fetchError) {
      console.error('Error fetching dates:', fetchError);
      setAvailableDates([]);
    } finally {
      setDatesLoading(false);
    }
  }, [className, findSectionId, parseClassName]);

  // ===== CALCULATE STATUS =====
  const calculateStatus = useCallback(async (timeIn, studentGrade) => {
    if (!timeIn) return { status: 'absent', shouldClearTimes: false };
    
    try {
      const { data: gradeData, error: gradeError } = await supabase
        .from('grades')
        .select('id')
        .eq('grade_level', studentGrade)
        .single();
      
      if (gradeError || !gradeData) {
        return { status: 'absent', shouldClearTimes: false };
      }
      
      const gradeId = gradeData.id;
      const { data: schedule, error: scheduleError } = await supabase
        .from('grade_schedules')
        .select('*')
        .eq('grade_id', gradeId)
        .single();
      
      if (scheduleError || !schedule) {
        return calculateStatusFallback(timeIn);
      }
      
      const [scanHour, scanMinute] = timeIn.split(':').map(Number);
      const [classStartHour, classStartMinute] = schedule.class_start.split(':').map(Number);
      const [classEndHour, classEndMinute] = schedule.class_end.split(':').map(Number);
      
      const scanTotalMinutes = scanHour * 60 + scanMinute;
      const classStartMinutes = classStartHour * 60 + classStartMinute;
      const classEndMinutes = classEndHour * 60 + classEndMinute;
      const gracePeriod = schedule.grace_period_minutes || 15;
      
      if (scanTotalMinutes < classStartMinutes) {
        return { status: 'present', shouldClearTimes: false };
      } else if (scanTotalMinutes <= classStartMinutes + gracePeriod) {
        return { status: 'present', shouldClearTimes: false };
      } else if (scanTotalMinutes <= classEndMinutes) {
        return { status: 'late', shouldClearTimes: false };
      } else {
        return { status: 'absent', shouldClearTimes: true };
      }
      
    } catch (error) {
      return calculateStatusFallback(timeIn);
    }
  }, []);

  const calculateStatusFallback = useCallback((timeIn) => {
    if (!timeIn) return { status: 'absent', shouldClearTimes: false };
    try {
      const [hours, minutes] = timeIn.split(':').map(Number);
      const scanTotalMinutes = hours * 60 + minutes;
      const classStartMinutes = 8 * 60;
      const classEndMinutes = 15 * 60;
      const gracePeriod = 15;
      
      if (scanTotalMinutes <= classStartMinutes + gracePeriod) {
        return { status: 'present', shouldClearTimes: false };
      } else if (scanTotalMinutes <= classEndMinutes) {
        return { status: 'late', shouldClearTimes: false };
      } else {
        return { status: 'absent', shouldClearTimes: true };
      }
    } catch (error) {
      return { status: 'absent', shouldClearTimes: false };
    }
  }, []);

  // ===== FETCH CLASS ATTENDANCE =====
  const fetchClassAttendance = useCallback(async () => {
    if (!className) {
      setError('No class selected.');
      setAttendances([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { grade, section } = parseClassName(className);

      if (!grade || !section) {
        throw new Error(`Invalid class name format: ${className}`);
      }

      const sectionId = await findSectionId(grade, section);

      if (!sectionId) {
        throw new Error(`Section "${section}" in Grade ${grade} not found`);
      }

      let selectFields = `
        id,
        lrn,
        first_name,
        last_name,
        grade_id,
        section_id
      `;
      
      try {
        const { data: testData, error: testError } = await supabase
          .from('students')
          .select('photo_url')
          .limit(1);
        
        if (!testError) {
          selectFields = `
            id,
            lrn,
            first_name,
            last_name,
            grade_id,
            section_id,
            photo_url
          `;
        }
      } catch (err) {
        console.log('photo_url column not found in students table, using fallback');
      }

      const { data: classStudents, error: studentsError } = await supabase
        .from('students')
        .select(selectFields)
        .eq('section_id', sectionId)
        .order('last_name')
        .order('first_name');

      if (studentsError) {
        throw studentsError;
      }

      if (!classStudents?.length) {
        setAttendances([]);
        setDisplayDate(getPhilippinesDisplayDate(activeDate));
        setLoading(false);
        return;
      }

      const studentIds = classStudents.map((student) => student.id);
      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', activeDate)
        .in('student_id', studentIds);

      if (attendanceError) {
        throw attendanceError;
      }

      const attendanceMap = new Map();
      (attendanceRecords || []).forEach((record) => {
        attendanceMap.set(record.student_id, record);
      });

      const transformedData = classStudents.map((student) => {
        const attendance = attendanceMap.get(student.id);

        if (attendance) {
          return {
            id: attendance.id,
            student_id: student.id,
            lrn: student.lrn,
            first_name: student.first_name,
            last_name: student.last_name,
            photo_url: student.photo_url || null,
            time_in: attendance.time_in,
            time_out: attendance.time_out,
            date: attendance.date,
            status: attendance.status || 'present',
            grade: grade,
            section: section
          };
        }

        return {
          id: `${student.id}-${activeDate}`,
          student_id: student.id,
          lrn: student.lrn,
          first_name: student.first_name,
          last_name: student.last_name,
          photo_url: student.photo_url || null,
          time_in: null,
          time_out: null,
          date: activeDate,
          status: 'absent',
          grade: grade,
          section: section
        };
      });

      setAttendances(transformedData);
      setDisplayDate(getPhilippinesDisplayDate(activeDate));
    } catch (fetchError) {
      console.error('Error fetching attendance:', fetchError);
      setAttendances([]);
      setError(fetchError.message || 'Failed to load attendance records.');
    } finally {
      setLoading(false);
    }
  }, [activeDate, className, findSectionId, getPhilippinesDisplayDate, parseClassName]);

  // ===== FORMAT HELPERS =====
  const formatTimeDisplay = useCallback((timeString) => {
    if (!timeString) {
      return formatNA(timeString);
    }

    try {
      const [hours, minutes] = timeString.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;

      return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch (formatError) {
      console.error('Error formatting time:', formatError, timeString);
      return timeString;
    }
  }, []);

  const formatTimeDisplayShort = useCallback((timeString) => {
    if (!timeString) return '—';
    try {
      const [hours, minutes] = timeString.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, minutes);
      return date.toLocaleTimeString('en-PH', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Manila'
      });
    } catch (error) {
      return timeString;
    }
  }, []);

  const formatTimeForInput = useCallback((timeString) => {
    if (!timeString) return '';
    try {
      const [hours, minutes] = timeString.split(':');
      return `${hours}:${minutes}`;
    } catch (error) {
      return '';
    }
  }, []);

  const getStatusMeta = useCallback((status) => {
    switch (status?.toLowerCase()) {
      case 'present':
        return { className: styles.statusPresent, text: 'Present' };
      case 'late':
        return { className: styles.statusLate, text: 'Late' };
      case 'absent':
      default:
        return { className: styles.statusAbsent, text: 'Absent' };
    }
  }, []);

  const isToday = useCallback((dateString) => {
    if (!dateString) {
      return false;
    }

    return dateString === getPHDateIso();
  }, []);

  // ===== EXPORT HANDLER =====
  const handleExportAttendance = () => {
    try {
      exportEntity({
        entity: 'attendance',
        data: filteredAttendances,
        filename: 'attendance-export',
      });
      success('Successfully downloaded attendance data table');
    } catch (err) {
      toastError(`Failed to export attendance data: ${err.message}`);
    }
  };

  // ===== EDIT HANDLERS =====
  const startEdit = useCallback((attendance) => {
    setEditingId(attendance.id);
    setEditFormData({
      time_in: formatTimeForInput(attendance.time_in),
      time_out: formatTimeForInput(attendance.time_out)
    });
    setValidationErrors({});
  }, [formatTimeForInput]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditFormData({
      time_in: '',
      time_out: ''
    });
    setValidationErrors({});
  }, []);

  const handleTimeChange = useCallback((e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: null }));
    }
  }, [validationErrors]);

  const validateForm = useCallback(() => {
    const errors = {};
    
    if (editFormData.time_out && !editFormData.time_in) {
      errors.time_out = 'Time out requires time in';
    }
    
    if (editFormData.time_in && editFormData.time_out) {
      const [inHours, inMinutes] = editFormData.time_in.split(':').map(Number);
      const [outHours, outMinutes] = editFormData.time_out.split(':').map(Number);
      
      const timeIn = new Date();
      timeIn.setHours(inHours, inMinutes, 0, 0);
      
      const timeOut = new Date();
      timeOut.setHours(outHours, outMinutes, 0, 0);
      
      if (timeOut < timeIn) {
        errors.time_out = 'Time out cannot be earlier than time in';
      }
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [editFormData]);

  const saveEdit = useCallback(async (attendanceId, studentGrade) => {
    if (!validateForm()) {
      toastError('Please fix validation errors');
      return;
    }
    
    setSaving(true);
    try {
      let updateData;
      let statusResult;
      
      if (editFormData.time_in) {
        statusResult = await calculateStatus(editFormData.time_in, studentGrade);
        
        if (statusResult.shouldClearTimes) {
          updateData = {
            time_in: null,
            time_out: null,
            status: 'absent',
            scan_type: null
          };
        } else {
          updateData = {
            time_in: editFormData.time_in ? `${editFormData.time_in}:00` : null,
            time_out: editFormData.time_out ? `${editFormData.time_out}:00` : null,
            status: statusResult.status
          };
        }
      } else {
        updateData = {
          time_in: null,
          time_out: null,
          status: 'absent',
          scan_type: null
        };
      }
      
      const { error } = await supabase
        .from('attendance')
        .update(updateData)
        .eq('id', attendanceId);
      
      if (error) throw error;
      
      if (statusResult?.shouldClearTimes) {
        success('Time entered is after class. Student marked as absent with times cleared.');
      } else if (editFormData.time_in) {
        success(`Attendance updated successfully (${statusResult?.status || 'absent'})`);
      } else {
        success('Student marked as absent');
      }
      
      cancelEdit();
      await fetchClassAttendance();
      
    } catch (error) {
      console.error('Error saving attendance:', error);
      toastError(`Failed to update attendance: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }, [validateForm, editFormData, calculateStatus, cancelEdit, fetchClassAttendance, toastError, success]);

  // ===== ROW CLICK HANDLER =====
  const handleRowClick = useCallback((attendanceId, e) => {
    if (shouldHandleRowClick(editingId !== null, e.target)) {
      toggleRow(attendanceId);
    }
  }, [editingId, toggleRow]);

  // ===== FILTERED ATTENDANCES =====
  const filteredAttendances = useMemo(() => {
    let filtered = searchFilteredRows;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(
        (attendance) => attendance.status?.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    return sortEntities(filtered, { type: 'student' });
  }, [searchFilteredRows, statusFilter]);

  const ROWS_PER_PAGE = 20;
  const totalPages = Math.ceil(filteredAttendances.length / ROWS_PER_PAGE);

  const paginatedAttendances = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredAttendances.slice(start, start + ROWS_PER_PAGE);
  }, [filteredAttendances, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, activeDate, className]);

  const paginationContent = totalPages > 1 ? (
    <Pagination
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={setCurrentPage}
    />
  ) : null;

  const stats = useMemo(() => {
    const total = filteredAttendances.length;
    const present = filteredAttendances.filter((item) => item.status === 'present').length;
    const late = filteredAttendances.filter((item) => item.status === 'late').length;
    const absent = filteredAttendances.filter((item) => item.status === 'absent').length;

    return { total, present, late, absent };
  }, [filteredAttendances]);

  const withColumnWidth = useCallback((width, minWidth) => ({
    width,
    minWidth: `${minWidth}px`
  }), []);

  // ===== RENDER EDIT ACTIONS =====
  const renderActionButtons = useCallback((attendanceId, studentGrade) => (
    <div className={styles.editActions}>
      <Button 
        onClick={(e) => {
          e.stopPropagation();
          cancelEdit();
        }}
        disabled={saving}
        label="Cancel"
        color="ghost"
        height="xs"
        width="auto"
        pill={false}
      />
      <Button 
        onClick={(e) => {
          e.stopPropagation();
          saveEdit(attendanceId, studentGrade);
        }}
        disabled={saving}
        label={saving ? 'Saving...' : 'Save'}
        color="ocean"
        height="xs"
        width="auto"
        pill={false}
      />
    </div>
  ), [saveEdit, cancelEdit, saving]);

  const renderEditCell = useCallback((attendance) => (
    <div className={styles.editCell}>
      {editingId === attendance.id ? (
        renderActionButtons(attendance.id, attendance.grade)
      ) : (
        <div className={styles.icon}>
          <FontAwesomeIcon 
            icon={faPenToSquare} 
            onClick={(e) => {
              e.stopPropagation();
              startEdit(attendance);
            }}
            className="action-button"
            title="Edit attendance times"
          />
        </div>
      )}
    </div>
  ), [editingId, renderActionButtons, startEdit]);

  const renderTimePicker = useCallback((fieldName) => (
    <TimePicker
      name={fieldName}
      value={editFormData[fieldName]}
      onChange={handleTimeChange}
    />
  ), [editFormData, handleTimeChange]);

  // ===== EXPANDED CONTENT =====
  const renderExpandedContent = useCallback((attendance) => {
    const statusText = attendance.status?.charAt(0).toUpperCase() + attendance.status?.slice(1) || 'Absent';
    const recordedAt = attendance.created_at ? new Date(attendance.created_at).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }) : 'N/A';
    
    return (
      <div 
        className={`${styles.attendanceCard} ${styles.expandableCard}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className={styles.closeExpandBtn}
          onClick={(e) => {
            e.stopPropagation();
            toggleRow(null);
          }}
          aria-label="Close"
        >
          ✕
        </button>

        <div className={styles.expandedLayout}>
          {renderProfileCircle(attendance, styles.profileLarge)}

          <div className={styles.cardBody}>
            <div className={styles.attendanceHeader}>
              {formatStudentName(attendance)}
            </div>
            
            <div className={styles.details}>
              <div>
                <div className={styles.attendanceInfo}>
                  <strong>Attendance Details</strong>
                </div>
                <div className={styles.attendanceInfo}>
                  Time In: {formatTimeDisplayShort(attendance.time_in) || 'N/A'}
                </div>
                <div className={styles.attendanceInfo}>
                  Time Out: {formatTimeDisplayShort(attendance.time_out) || 'N/A'}
                </div>
                <div className={styles.attendanceInfo}>
                  Date: {displayDate || attendance.date}
                </div>
                <div className={styles.attendanceInfo}>
                  Status: {statusText}
                </div>
              </div>

              <div>
                <div className={styles.attendanceInfo}>
                  <strong>Student Details</strong>
                </div>
                <div className={styles.attendanceInfo}>
                  LRN: {attendance.lrn || 'N/A'}
                </div>
                <div className={styles.attendanceInfo}>
                  Full Name: {formatStudentName(attendance)}
                </div>
                <div className={styles.attendanceInfo}>
                  Grade & Section: {attendance.grade} - {attendance.section}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }, [formatTimeDisplayShort, displayDate, toggleRow]);

  // ===== TABLE COLUMNS =====
  const tableColumns = useMemo(() => [
    {
      key: 'student',
      label: 'STUDENT',
      headerStyle: withColumnWidth('30%', 220),
      cellStyle: withColumnWidth('30%', 220),
      cellClassName: styles.studentCell,
      renderCell: ({ row }) => (
        <div className={styles.studentCellContent}>
          {renderProfileCircle(row, styles.profileSmall)}
          <div className={styles.studentCellText}>
            <div className={styles.studentCellName}>
              {formatStudentName(row)}
            </div>
            <div className={styles.studentCellLrn}>
              LRN: {row.lrn || 'N/A'}
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'time_in',
      label: 'TIME IN',
      headerStyle: withColumnWidth('14%', 120),
      cellStyle: withColumnWidth('14%', 120),
      renderCell: ({ row }) => (
        editingId === row.id ? (
          <div className={styles.timeCell}>
            {renderTimePicker('time_in')}
          </div>
        ) : (
          <div className={styles.timeCell}>
            <div className={styles.timeDisplay}>
              {formatTimeDisplayShort(row.time_in)}
            </div>
          </div>
        )
      )
    },
    {
      key: 'time_out',
      label: 'TIME OUT',
      headerStyle: withColumnWidth('14%', 120),
      cellStyle: withColumnWidth('14%', 120),
      renderCell: ({ row }) => (
        editingId === row.id ? (
          <div className={styles.timeCell}>
            {renderTimePicker('time_out')}
            {validationErrors.time_out && (
              <div className={styles.errorMessage}>{validationErrors.time_out}</div>
            )}
          </div>
        ) : (
          <div className={styles.timeCell}>
            <div className={styles.timeDisplay}>
              {formatTimeDisplayShort(row.time_out)}
            </div>
          </div>
        )
      )
    },
    {
      key: 'status',
      label: 'STATUS',
      headerStyle: withColumnWidth('16%', 150),
      cellStyle: withColumnWidth('16%', 150),
      renderHeader: () => (
        <div className={styles.statusHeader}>
          <span>Status</span>
          <EntityDropdown
            options={STATUS_OPTIONS}
            selectedValue={statusFilter === 'all' ? '' : statusFilter}
            onSelect={(value) => setStatusFilter(value || 'all')}
            allLabel="All"
            buttonTitle="Filter status"
            getOptionLabel={(option) => option.label}
            getOptionValue={(option) => option.value}
          />
        </div>
      ),
      renderCell: ({ row }) => {
        const statusMeta = getStatusMeta(row.status);

        return (
          <span className={`${styles.status} ${statusMeta.className}`}>
            {statusMeta.text}
          </span>
        );
      }
    },
    {
      key: 'edit',
      label: 'EDIT',
      headerStyle: withColumnWidth('8%', 70),
      cellStyle: withColumnWidth('8%', 70),
      renderCell: ({ row }) => renderEditCell(row)
    }
  ], [
    withColumnWidth,
    editingId,
    renderTimePicker,
    formatTimeDisplayShort,
    validationErrors.time_out,
    statusFilter,
    getStatusMeta,
    renderEditCell
  ]);

  const getRowClassName = useCallback(({ row }) => {
    return [
      styles.attendanceRow,
      editingId === row.id ? styles.editingRow : ''
    ].filter(Boolean).join(' ');
  }, [editingId]);

  const getDateLabel = useCallback(() => {
    if (!activeDate) return 'Select date';
    const [y, m, d] = activeDate.split('-').map(Number);
    const sel = new Date(y, m - 1, d);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isToday = sel.getTime() === todayStart.getTime();
    const isPast = sel.getTime() < todayStart.getTime();
    const monthStr = sel.toLocaleString('default', { month: 'short' });

    if (isToday) return `Today · ${monthStr} ${d}, ${y}`;
    if (isPast) return `Past Date · ${monthStr} ${d}, ${y}`;
    return `${monthStr} ${d}, ${y}`;
  }, [activeDate]);

  useEffect(() => {
    fetchAvailableDates();
  }, [fetchAvailableDates]);

  useEffect(() => {
    fetchClassAttendance();
  }, [fetchClassAttendance]);

  useEffect(() => {
    if (!className) {
      return undefined;
    }

    const channel = supabase
      .channel(`attendance-${className}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance'
        },
        () => {
          fetchClassAttendance();
          fetchAvailableDates();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [className, fetchAvailableDates, fetchClassAttendance]);

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

  return (
    <div className={styles.attendanceTableContainer}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Daily Attendance</h2>
      </div>

      <section className={styles.summaryCard}>
        <div className={styles.controlsRow}>
          <Button
            color="teaGreen"
            height="sm"
            width="auto"
            icon={<DownloadIcon />}
            label="Export"
            onClick={handleExportAttendance}
            disabled={loading || filteredAttendances.length === 0}
          />

          <div className={styles.controlsRight}>
            <div className={styles.searchContainer}>
              <Input
                placeholder="Search Students..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                search={true}
              />
            </div>

            <div className={styles.dateControls}>
              <div ref={calendarBtnRef} className={styles.calendarWrapper}>
                <Button
                  color="nav"
                  height="sm"
                  width="auto"
                  onClick={() => setCalendarOpen((v) => !v)}
                  disabled={datesLoading}
                  icon={
                    <span className={styles.calendarTriggerInner}>
                      <span className="material-icons" style={{ fontSize: '16px', opacity: 0.6 }}>calendar_today</span>
                      <span className={styles.calendarDivider} />
                      <span className={styles.calendarTriggerLabel}>{getDateLabel()}</span>
                      <span className="material-icons" style={{ fontSize: '16px', opacity: 0.5 }}>
                        {calendarOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                      </span>
                    </span>
                  }
                />

                {calendarOpen && (
                  <div className={styles.calendarDropdown}>
                    <DatePickerCalendar
                      selectedDateKey={activeDate}
                      hasDataDates={availableDates}
                      onSelect={({ key }) => {
                        setSelectedDate(key === getPHDateIso() ? '' : key);
                        setCalendarOpen(false);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.statsGrid}>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>Total students</span>
            <strong className={styles.statValue}>{stats.total}</strong>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>Present</span>
            <strong className={`${styles.statValue} ${styles.statPresent}`}>{stats.present}</strong>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>Late</span>
            <strong className={`${styles.statValue} ${styles.statLate}`}>{stats.late}</strong>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>Absent</span>
            <strong className={`${styles.statValue} ${styles.statAbsent}`}>{stats.absent}</strong>
          </article>
        </div>
      </section>

      {parsedClass.section && (
        <div className={styles.sectionTabBar}>
          <div className={styles.sectionTabActive}>
            <span className={styles.sectionTabGrade}>Grade {parsedClass.grade} -</span>
            <span className={styles.sectionTabName}>{parsedClass.section}</span>
          </div>
          {paginationContent && (
            <div className={styles.sectionTabPagination}>
              {paginationContent}
            </div>
          )}
        </div>
      )}

      <Table
        columns={tableColumns}
        rows={paginatedAttendances}
        getRowId={(row) => row.id}
        loading={loading}
        error={error}
        emptyMessage="No attendance records match the current filters."
        tableLabel={`Attendance for ${className}`}
        rowClassName={getRowClassName}
        className={styles.tableSurface}
        wrapperClassName={styles.tableWrapper}
        containerRef={tableRef}
        onRowClick={({ rowId, event }) => handleRowClick(rowId, event)}
        expandedRowId={expandedRow}
        renderExpandedRow={({ row }) => renderExpandedContent(row)}
        persistExpandedRows={true}
        hideMainRowWhenExpanded={true}
        getExpandedRowClassName={({ isExpanded }) => `${styles.expandRow} ${isExpanded ? styles.expandRowActive : ''}`}
      />
    </div>
  );
}

export default TeacherAttendanceTable;