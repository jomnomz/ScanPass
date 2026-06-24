import { useState, useEffect, useMemo, useCallback } from 'react';
import { formatStudentName, formatNA } from '../../../Utils/Formatters';
import { sortEntities } from '../../../Utils/SortEntities';
import styles from './TeacherAttendanceTable.module.css';
import { supabase } from '../../../lib/supabase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDays } from '@fortawesome/free-solid-svg-icons';
import Input from '../../../Components/UI/Input/Input.jsx';
import Table from '../Table/Table.jsx';
import EntityDropdown from '../../UI/Buttons/EntityDropdown/EntityDropdown.jsx';

const STATUS_OPTIONS = [
  { label: 'Present', value: 'present' },
  { label: 'Late', value: 'late' },
  { label: 'Absent', value: 'absent' }
];

const getPHDateIso = (date = new Date()) => {
  const phTime = new Date(date.getTime() + (8 * 60 * 60 * 1000));
  return phTime.toISOString().split('T')[0];
};

const formatDateOption = (dateString) => {
  const date = new Date(`${dateString}T00:00:00Z`);
  const phTime = new Date(date.getTime() + (8 * 60 * 60 * 1000));

  return phTime.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [availableDates, setAvailableDates] = useState([]);
  const [datesLoading, setDatesLoading] = useState(false);

  const activeDate = selectedDate || getPHDateIso();

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

  const dateOptions = useMemo(() => {
    const options = [activeDate, ...availableDates];
    return [...new Set(options)].sort((left, right) => right.localeCompare(left));
  }, [activeDate, availableDates]);

  const filteredAttendances = useMemo(() => {
    let filtered = attendances;

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((attendance) => {
        const fullName = `${attendance.first_name || ''} ${attendance.last_name || ''} ${attendance.middle_name || ''}`.toLowerCase();
        const lrn = attendance.lrn?.toLowerCase() || '';
        return fullName.includes(searchLower) || lrn.includes(searchLower);
      });
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(
        (attendance) => attendance.status?.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    return sortEntities(filtered, { type: 'student' });
  }, [attendances, searchTerm, statusFilter]);

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
          <span className={`${styles.statusPill} ${statusMeta.className}`}>
            {statusMeta.text}
          </span>
        );
      }
    }
  ], [formatTimeDisplay, getStatusMeta, statusFilter, withColumnWidth]);

  const getRowClassName = useCallback(({ rowIndex }) => {
    return rowIndex % 2 === 0 ? styles.attendanceRowEven : styles.attendanceRowOdd;
  }, []);

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

  return (
    <div className={styles.attendanceTableContainer}>
      <section className={styles.summaryCard}>
        <div className={styles.summaryHeader}>
          <div>
            <p className={styles.eyebrow}>Daily attendance snapshot</p>
            <h2 className={styles.className}>{className}</h2>
          </div>
          <div className={styles.metaCluster}>
            {subject && <span className={styles.metaChip}>{subject}</span>}
            {schoolYear && <span className={styles.metaChip}>{schoolYear}</span>}
            <span className={styles.metaChipStrong}>{displayDate || getPhilippinesDisplayDate(activeDate)}</span>
          </div>
        </div>

        <div className={styles.controlsRow}>
          <div className={styles.searchContainer}>
            <Input
              placeholder="Search students by name or LRN"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              search={true}
            />
          </div>

          <div className={styles.dateControls}>
            <div className={styles.dateSelector}>
              <span className={styles.dateIconWrap}>
                <FontAwesomeIcon icon={faCalendarDays} className={styles.dateIcon} />
              </span>
              <div className={styles.dateCopy}>
                <span className={styles.dateLabel}>Viewing date</span>
                <span className={`${styles.dateBadge} ${isToday(activeDate) ? styles.dateBadgeActive : ''}`}>
                  {isToday(activeDate) ? 'Today' : 'Past record'}
                </span>
              </div>
              <select
                className={styles.dateSelect}
                value={activeDate}
                onChange={(event) => setSelectedDate(event.target.value === getPHDateIso() ? '' : event.target.value)}
                disabled={datesLoading}
              >
                {dateOptions.map((date) => (
                  <option key={date} value={date}>
                    {formatDateOption(date)}{isToday(date) ? ' (Today)' : ''}
                  </option>
                ))}
              </select>
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

      <Table
        columns={tableColumns}
        rows={filteredAttendances}
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