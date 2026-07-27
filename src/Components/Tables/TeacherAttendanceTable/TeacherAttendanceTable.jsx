import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { formatStudentName, formatNA } from '../../../Utils/Formatters';
import { sortEntities } from '../../../Utils/SortEntities';
import styles from './TeacherAttendanceTable.module.css';
import { supabase } from '../../../lib/supabase';
import Input from  '../../UI/Inputs/Input/Input.jsx';
import Table from '../Table/Table.jsx';
import EntityDropdown from '../../UI/Buttons/EntityDropdown/EntityDropdown.jsx';
import DatePickerCalendar from '../../../Components/UI/Buttons/DatePickerCalendar/DatePickerCalendar';
import Button from '../../../Components/UI/Buttons/Button/Button.jsx';
import Pagination from '../../../Components/UI/Buttons/Pagination/Pagination.jsx';
import useSearchFilter from '../../Hooks/useSearchFilter.js';

const STATUS_OPTIONS = [
  { label: 'Present', value: 'present' },
  { label: 'Late', value: 'late' },
  { label: 'Absent', value: 'absent' }
];

const getPHDateIso = (date = new Date()) => {
  const phTime = new Date(date.getTime() + (8 * 60 * 60 * 1000));
  return phTime.toISOString().split('T')[0];
};

function TeacherAttendanceTable({
  className,
  subject,
  schoolYear
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

  const calendarBtnRef = useRef(null);

  const activeDate = selectedDate || getPHDateIso();

  // FIX: Combine name parts with filter(Boolean) to avoid double spaces
  const { searchTerm, setSearchTerm, filteredRows: searchFilteredRows } = useSearchFilter(
    attendances,
    [
      (row) => [row.first_name, row.middle_name, row.last_name]
        .filter(Boolean)
        .join(' '),
      'lrn'
    ]
  );

  // Parse className into grade and section
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

      const { data: classStudents, error: studentsError } = await supabase
        .from('students')
        .select(`
          id,
          lrn,
          first_name,
          last_name,
          middle_name,
          grade_id,
          section_id
        `)
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
            middle_name: student.middle_name,
            time_in: attendance.time_in,
            time_out: attendance.time_out,
            date: attendance.date,
            status: attendance.status || 'present'
          };
        }

        return {
          id: `${student.id}-${activeDate}`,
          student_id: student.id,
          lrn: student.lrn,
          first_name: student.first_name,
          last_name: student.last_name,
          middle_name: student.middle_name,
          time_in: null,
          time_out: null,
          date: activeDate,
          status: 'absent'
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

  // Combine search filter with status filter
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

  const tableColumns = useMemo(() => [
    {
      key: 'lrn',
      label: 'LRN',
      headerStyle: withColumnWidth('18%', 120),
      cellStyle: withColumnWidth('18%', 120),
      renderCell: ({ row }) => formatNA(row.lrn)
    },
    {
      key: 'student_name',
      label: 'STUDENT NAME',
      headerStyle: withColumnWidth('34%', 220),
      cellStyle: withColumnWidth('34%', 220),
      headerClassName: styles.nameHeader,
      cellClassName: styles.nameCell,
      renderCell: ({ row }) => formatStudentName(row)
    },
    {
      key: 'time_in',
      label: 'TIME IN',
      headerStyle: withColumnWidth('16%', 140),
      cellStyle: withColumnWidth('16%', 140),
      renderCell: ({ row }) => formatTimeDisplay(row.time_in)
    },
    {
      key: 'time_out',
      label: 'TIME OUT',
      headerStyle: withColumnWidth('16%', 140),
      cellStyle: withColumnWidth('16%', 140),
      renderCell: ({ row }) => formatTimeDisplay(row.time_out)
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
    }
  ], [formatTimeDisplay, getStatusMeta, statusFilter, withColumnWidth]);

  const getRowClassName = useCallback(({ rowIndex }) => {
    return rowIndex % 2 === 0 ? styles.attendanceRowEven : styles.attendanceRowOdd;
  }, []);

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

  // Close calendar on click outside
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
      <section className={styles.summaryCard}>
        {/* Top row: eyebrow + meta chips */}
        <div className={styles.summaryHeader}>
          <div>
            <p className={styles.eyebrow}>Daily attendance snapshot</p>
          </div>
          <div className={styles.metaCluster}>
            {subject && <span className={styles.metaChip}>{subject}</span>}
            {schoolYear && <span className={styles.metaChip}>{schoolYear}</span>}
          </div>
        </div>

        {/* Controls row: search + calendar close together */}
        <div className={styles.controlsRow}>
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

      {/* Section tab bar — floating between stats and table */}
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
      />
    </div>
  );
}

export default TeacherAttendanceTable;