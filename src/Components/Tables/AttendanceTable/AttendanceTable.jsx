import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRowExpansion } from '../../Hooks/useRowExpansion'; 
import { grades, shouldHandleRowClick } from '../../../Utils/TableHelpers';
import { formatStudentName, formatDate, formatNA, formatAttendanceStatus } from '../../../Utils/Formatters'; 
import { sortEntities } from '../../../Utils/SortEntities'; 
import { compareSections } from '../../../Utils/CompareHelpers';
import { getProfileColor, getProfileInitial } from '../../../Utils/ProfileHelpers';
import SectionDropdown from '../../UI/Buttons/SectionDropdown/SectionDropdown';
import styles from './AttendanceTable.module.css';
import { useAttendance } from '../../Hooks/useAttendance';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare, faTimes } from "@fortawesome/free-solid-svg-icons";
import { useToast } from '../../Toast/ToastContext/ToastContext';
import { supabase } from '../../../lib/supabase';
import Table from '../Table/Table.jsx';
import EntityDropdown from '../../UI/Buttons/EntityDropdown/EntityDropdown.jsx';
import Pagination from '../../../Components/UI/Buttons/Pagination/Pagination.jsx';
import Button from '../../UI/Buttons/Button/Button.jsx'; // ADDED THIS IMPORT

const STATUS_OPTIONS = [
  { label: 'Present', value: 'present' },
  { label: 'Late', value: 'late' },
  { label: 'Absent', value: 'absent' }
];

const formatDateTimeLocal = (dateString) => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.error('Error formatting date:', dateString, error);
    return 'N/A';
  }
};

// ===== SHARED PROFILE CIRCLE RENDERER =====
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

const AttendanceTable = ({
  searchTerm = '',
  selectedSection = '',
  onSectionsUpdate,
  onGradeUpdate,
  onClearSectionFilter,
  onSectionSelect,
  availableSections = [],
  loading: parentLoading = false,
  selectedDate: controlledSelectedDate = null,
  statusFilter: externalStatusFilter = 'all',
  onStatsUpdate,
  currentPage = 1,
  onPageChange = () => {},
  rowsPerPage = 20,
  gradesData = [],
  sectionsData = []
}) => {
  const { 
    currentClass,
    attendances,
    loading: attendanceLoading,
    error,
    changeClass,
    fetchAttendanceForDate
  } = useAttendance();
  
  const { expandedRow, tableRef, toggleRow, isRowExpanded } = useRowExpansion();
  const { success, error: toastError } = useToast();
  
  const selectedDate = controlledSelectedDate;
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({
    time_in: '',
    time_out: ''
  });
  const [validationErrors, setValidationErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState(externalStatusFilter || 'all');
  
  // ===== BUILD GRADE-SECTIONS MAP (same as StudentTable) =====
  const [gradeSectionsMap, setGradeSectionsMap] = useState({});

  useEffect(() => {
    if (sectionsData.length > 0 && gradesData.length > 0) {
      console.log('📋 Building grade-sections map for attendance from props...');
      const map = {};
      
      const gradeIdToLevel = {};
      gradesData.forEach(grade => {
        gradeIdToLevel[grade.id] = grade.grade_level;
      });
      
      sectionsData.forEach(section => {
        const gradeLevel = gradeIdToLevel[section.grade_id];
        if (gradeLevel) {
          if (!map[gradeLevel]) {
            map[gradeLevel] = [];
          }
          map[gradeLevel].push(section.section_name);
        }
      });
      
      Object.keys(map).forEach(grade => {
        map[grade] = map[grade].sort(compareSections);
      });
      
      console.log('📋 Grade-sections map for attendance:', map);
      setGradeSectionsMap(map);
    }
  }, [gradesData, sectionsData]);

  useEffect(() => {
    setStatusFilter(externalStatusFilter || 'all');
  }, [externalStatusFilter]);

  const formatTimeDisplay = useCallback((timeString) => {
    if (!timeString) return 'N/A';
    try {
      const [hours, minutes, seconds] = timeString.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, minutes, seconds);
      return date.toLocaleTimeString('en-PH', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'Asia/Manila'
      });
    } catch (error) {
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
      
      await fetchAttendanceForDate(selectedDate, currentClass);
      
    } catch (error) {
      console.error('Error saving attendance:', error);
      toastError(`Failed to update attendance: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }, [validateForm, editFormData, calculateStatus, cancelEdit, selectedDate, currentClass, fetchAttendanceForDate, toastError, success]);

  const handleClassChange = useCallback((className) => {
    changeClass(className);
    onPageChange(1);
    toggleRow(null);
    cancelEdit();
    
    if (selectedSection && onSectionSelect) {
      const sectionsForNewGrade = gradeSectionsMap[className] || [];
      const isValidSection = sectionsForNewGrade.includes(selectedSection);
      
      if (!isValidSection) {
        onSectionSelect('');
        if (onClearSectionFilter) {
          onClearSectionFilter();
        }
      }
    }
    
    fetchAttendanceForDate(selectedDate, className);
  }, [changeClass, onPageChange, toggleRow, cancelEdit, selectedSection, onSectionSelect, onClearSectionFilter, selectedDate, fetchAttendanceForDate, gradeSectionsMap]);

  const handleSectionFilter = useCallback((section) => {
    if (onSectionSelect) {
      onSectionSelect(section);
    }
    onPageChange(1);
  }, [onSectionSelect, onPageChange]);

  const handleRowClick = useCallback((attendanceId, e) => {
    if (shouldHandleRowClick(editingId !== null, e.target)) {
      toggleRow(attendanceId);
    }
  }, [editingId, toggleRow]);

  const formatStatusWithStyle = useCallback((status) => {
    const baseClass = styles.status;
    let statusClass;
    
    switch (status) {
      case 'present':
        statusClass = styles.statusPresent;
        break;
      case 'late':
        statusClass = styles.statusLate;
        break;
      case 'absent':
        statusClass = styles.statusAbsent;
        break;
      default:
        statusClass = styles.statusAbsent;
    }
    
    return {
      text: formatAttendanceStatus(status),
      className: `${baseClass} ${statusClass}`
    };
  }, []);

  const calculateStats = useCallback((filteredData) => {
    const stats = {
      present: 0,
      absent: 0,
      late: 0,
      total: filteredData.length
    };

    filteredData.forEach(attendance => {
      switch (attendance.status) {
        case 'present':
          stats.present++;
          break;
        case 'absent':
          stats.absent++;
          break;
        case 'late':
          stats.late++;
          break;
      }
    });

    return stats;
  }, []);

  const allUniqueSections = useMemo(() => {
    const allSections = Object.values(gradeSectionsMap).flat();
    const uniqueSections = [...new Set(allSections)];
    return uniqueSections.sort(compareSections);
  }, [gradeSectionsMap]);

  const currentGradeSections = useMemo(() => {
    if (currentClass === 'all') {
      return allUniqueSections;
    }
    
    return gradeSectionsMap[currentClass] || [];
  }, [currentClass, gradeSectionsMap, allUniqueSections]);

  const sectionsToShowInDropdown = useMemo(() => {
    return currentGradeSections;
  }, [currentGradeSections]);

  const sortedAttendances = useMemo(() => {
    let filtered = attendances;
    
    if (selectedDate) {
      filtered = filtered.filter(attendance => attendance.date === selectedDate);
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(attendance => 
        attendance.status?.toLowerCase() === statusFilter.toLowerCase()
      );
    }
    
    if (currentClass !== 'all') {
      filtered = filtered.filter(attendance => attendance.grade === currentClass);
    }
    
    if (selectedSection) {
      filtered = filtered.filter(attendance => attendance.section === selectedSection);
    }
    
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(attendance => 
        attendance.lrn?.toLowerCase().includes(searchLower) ||
        attendance.first_name?.toLowerCase().includes(searchLower) ||
        attendance.last_name?.toLowerCase().includes(searchLower) ||
        attendance.grade?.toString().toLowerCase().includes(searchLower) ||
        attendance.section?.toString().toLowerCase().includes(searchLower) ||
        attendance.status?.toLowerCase().includes(searchLower) ||
        attendance.scan_type?.toLowerCase().includes(searchLower)
      );
    }
    
    return sortEntities(filtered, { type: 'student' });
  }, [attendances, selectedDate, statusFilter, currentClass, selectedSection, searchTerm]);

  // ===== STATS FOR KPI CARDS (same as teacher table) =====
  const stats = useMemo(() => {
    const total = sortedAttendances.length;
    const present = sortedAttendances.filter((item) => item.status === 'present').length;
    const late = sortedAttendances.filter((item) => item.status === 'late').length;
    const absent = sortedAttendances.filter((item) => item.status === 'absent').length;

    return { total, present, late, absent };
  }, [sortedAttendances]);

  const totalPages = Math.ceil(sortedAttendances.length / rowsPerPage);

  const paginatedAttendances = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedAttendances.slice(start, start + rowsPerPage);
  }, [sortedAttendances, currentPage, rowsPerPage]);

  const paginationContent = sortedAttendances.length > 0 ? (
    <Pagination
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
    />
  ) : null;

  // SETUP REALTIME SUBSCRIPTION FOR AUTO-UPDATE
  useEffect(() => {
    if (!selectedDate) return undefined;

    const channelName = `attendance-admin-${selectedDate}-${currentClass}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance'
        },
        () => {
          fetchAttendanceForDate(selectedDate, currentClass);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate, currentClass, fetchAttendanceForDate]);

  useEffect(() => {
    if (selectedSection && currentClass !== 'all') {
      const isValidSection = currentGradeSections.includes(selectedSection);
      if (!isValidSection && onSectionSelect) {
        onSectionSelect('');
      }
    }
  }, [currentClass, currentGradeSections, selectedSection, onSectionSelect]);

  useEffect(() => {
    if (onSectionsUpdate) {
      onSectionsUpdate(allUniqueSections);
    }
  }, [allUniqueSections, onSectionsUpdate]);

  useEffect(() => {
    if (onGradeUpdate) {
      onGradeUpdate(currentClass);
    }
  }, [currentClass, onGradeUpdate]);

  useEffect(() => {
    if (onStatsUpdate) {
      const stats = calculateStats(sortedAttendances);
      onStatsUpdate(stats);
    }
  }, [sortedAttendances, onStatsUpdate, calculateStats]);

  useEffect(() => {
    fetchAttendanceForDate(selectedDate, currentClass);
  }, [selectedDate, currentClass, fetchAttendanceForDate]);

  const renderTimePicker = useCallback((fieldName) => (
    <TimePicker
      name={fieldName}
      value={editFormData[fieldName]}
      onChange={handleTimeChange}
    />
  ), [editFormData, handleTimeChange]);

  // ===== UPDATED: renderActionButtons with Button component =====
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

  const renderExpandedContent = useCallback((attendance) => {
    const statusText = formatAttendanceStatus(attendance.status);
    const recordedAt = attendance.created_at ? formatDateTimeLocal(attendance.created_at) : 'N/A';
    
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
              Date: {formatDate(attendance.date)}
            </div>
            <div className={styles.attendanceInfo}>
              Status: {statusText}
            </div>
            <div className={styles.attendanceInfo}>
              Scan Type: {attendance.scan_type || 'N/A'}
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

          <div>
            <div className={styles.attendanceInfo}>
              <strong>Record Information</strong>
            </div>
            <div className={styles.attendanceInfo}>
              Recorded at: {recordedAt}
            </div>
          </div>
        </div>
      </div>
    );
  }, [formatStudentName, formatTimeDisplayShort, formatDate]);

  const getTableInfoMessage = useCallback(() => {
    const attendanceCount = sortedAttendances.length;
    
    let message = '';
    
    if (selectedDate) {
      message += `Date: ${selectedDate}`;
    } else {
      message += 'Today';
    }
    
    message += ` - Showing ${attendanceCount} attendance records`;
    
    if (selectedSection) {
      message += ` in Section ${selectedSection}`;
      
      if (currentClass === 'all') {
        message += ' across all grades';
      } else {
        message += ` in Grade ${currentClass}`;
      }
    } else if (currentClass !== 'all') {
      message += ` in Grade ${currentClass}`;
    }
    
    if (statusFilter !== 'all') {
      message += ` - Status: ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}`;
    }
    
    if (searchTerm) {
      message += ` matching "${searchTerm}"`;
    }
    
    return message;
  }, [sortedAttendances.length, selectedDate, selectedSection, currentClass, statusFilter, searchTerm]);

  const getVisibleRowClassName = useMemo(() => {
    return ({ row }) => {
      return [
        styles.studentRow,
        editingId === row.id ? styles.editingRow : ''
      ].filter(Boolean).join(' ');
    };
  }, [editingId]);

  const withColumnWidth = (width, minWidth) => ({
    width,
    minWidth: `${minWidth}px`
  });

  // ===== UPDATED TABLE COLUMNS: Replaced first_name and last_name with student column =====
  const tableColumns = useMemo(() => [
    {
      key: 'student',
      label: 'STUDENT',
      headerStyle: withColumnWidth('24%', 200),
      cellStyle: withColumnWidth('24%', 200),
      renderCell: ({ row }) => (
        <div className={styles.studentCell}>
          {renderProfileCircle(row, styles.profileSmall)}
          <div className={styles.studentCellText}>
            <div className={styles.studentCellName}>
              {formatStudentName(row)}
            </div>
            <div className={styles.studentCellLrn}>
              LRN: {row.lrn}
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'grade',
      label: 'GRADE',
      headerStyle: withColumnWidth('8%', 80),
      cellStyle: withColumnWidth('8%', 80),
      renderCell: ({ row }) => row.grade
    },
    {
      key: 'section',
      label: 'SECTION',
      headerStyle: withColumnWidth('12%', 120),
      cellStyle: withColumnWidth('12%', 120),
      renderHeader: () => (
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeaderRow}>
            <span>SECTION</span>
            <SectionDropdown 
              availableSections={sectionsToShowInDropdown}
              selectedValue={selectedSection}
              onSelect={handleSectionFilter}
            />
          </div>
        </div>
      ),
      renderCell: ({ row }) => row.section
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
      key: 'date',
      label: 'DATE',
      headerStyle: withColumnWidth('12%', 120),
      cellStyle: withColumnWidth('12%', 120),
      renderCell: ({ row }) => formatDate(row.date)
    },
    {
      key: 'status',
      label: 'STATUS',
      headerStyle: withColumnWidth('10%', 100),
      cellStyle: withColumnWidth('10%', 100),
      renderHeader: () => (
        <div className={styles.statusHeader}>
          <span>Status</span>
          <EntityDropdown
            options={STATUS_OPTIONS}
            selectedValue={statusFilter === 'all' ? '' : statusFilter}
            onSelect={(value) => {
              setStatusFilter(value || 'all');
              onPageChange(1);
            }}
            allLabel="All"
            buttonTitle="Filter status"
            getOptionLabel={(option) => option.label}
            getOptionValue={(option) => option.value}
          />
        </div>
      ),
      renderCell: ({ row }) => {
        const statusInfo = formatStatusWithStyle(row.status);
        return <span className={statusInfo.className}>{statusInfo.text}</span>;
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
    sectionsToShowInDropdown,
    selectedSection,
    handleSectionFilter,
    editingId,
    renderTimePicker,
    validationErrors.time_out,
    formatTimeDisplayShort,
    formatStatusWithStyle,
    statusFilter,
    renderEditCell,
    onPageChange
  ]);

  if (parentLoading || attendanceLoading) {
    return (
      <div className={styles.attendanceTableContainer}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading attendance records...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.attendanceTableContainer}>
        <div className={styles.error}>
          <h3>Error Loading Attendance</h3>
          <p>{error}</p>
          <button 
            className={styles.retryButton}
            onClick={() => fetchAttendanceForDate(selectedDate, currentClass)}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.attendanceTableContainer}>
      {/* === STATS CARDS (same style as teacher table) === */}
      <section className={styles.summaryCard}>

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

      <Table
        columns={tableColumns}
        rows={paginatedAttendances}
        getRowId={(row) => row.id}
        loading={false}
        error=""
        emptyMessage={getTableInfoMessage()}
        containerRef={tableRef}
        gradeTabs={{
          options: grades,
          currentValue: currentClass,
          onChange: handleClassChange,
          showAll: true,
          allLabel: 'All',
          renderLabel: (grade) => `Grade ${grade}`
        }}
        infoText=""
        tableLabel="Attendance"
        onRowClick={({ rowId, event }) => handleRowClick(rowId, event)}
        rowClassName={getVisibleRowClassName}
        expandedRowId={expandedRow}
        renderExpandedRow={({ row }) => renderExpandedContent(row)}
        persistExpandedRows={true}
        hideMainRowWhenExpanded={true}
        getExpandedRowClassName={({ isExpanded }) => `${styles.expandRow} ${isExpanded ? styles.expandRowActive : ''}`}
        className={styles.attendanceTableContainer}
        wrapperClassName={styles.tableWrapper}
        paginationContent={paginationContent}
        currentPage={currentPage}
        totalRowsOnPage={paginatedAttendances.length}
        visibleSelectedCount={0}
        isAllPagesSelected={false}
      />
    </div>
  );
};

export default AttendanceTable;