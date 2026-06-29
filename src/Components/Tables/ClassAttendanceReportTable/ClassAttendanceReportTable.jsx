import React, { useEffect, useState, useMemo } from 'react';
import Table from '../Table/Table.jsx';
import { formatStudentName } from '../../../Utils/Formatters';
import { supabase } from '../../../lib/supabase';
import Pagination from '../../UI/Buttons/Pagination/Pagination.jsx';
import styles from './ClassAttendanceReportTable.module.css';

const withColumnWidth = (width, minWidth) => ({ width, minWidth: `${minWidth}px` });

const ROWS_PER_PAGE = 20;

const ClassAttendanceReportTable = ({
  currentClass, selectedMonth, attendanceRows, setAttendanceRows,
  loading, setLoading, currentPage, setCurrentPage, totalPages,
  setTotalPages, monthNames
}) => {
  const [error, setError] = useState(null);

  const parseClassName = (className) => {
    const match = className?.match(/^(\d+)[-\s](.+)$/);
    if (match) return { grade: match[1], section: match[2] };
    return { grade: null, section: null };
  };

  const { grade, section } = parseClassName(currentClass);

  useEffect(() => {
    const fetchAttendanceData = async () => {
      if (!currentClass) return;
      setLoading(true);
      setError(null);
      try {
        const { grade, section } = parseClassName(currentClass);
        if (!grade || !section) throw new Error('Invalid class name');

        const { data: sectionData, error: sectionError } = await supabase
          .from('sections').select('id, section_name').eq('section_name', section).single();
        if (sectionError) throw sectionError;

        const { data: gradeData, error: gradeError } = await supabase
          .from('grades').select('id, grade_level').eq('grade_level', grade).single();
        if (gradeError) throw gradeError;

        const { data: students, error: studentsError } = await supabase
          .from('students').select('id, first_name, last_name, middle_name')
          .eq('grade_id', gradeData.id).eq('section_id', sectionData.id);
        if (studentsError) throw studentsError;

        const studentIds = students.map(s => s.id);
        let newAttendanceRows = [];

        if (studentIds.length > 0) {
          const { data: attendanceData, error: attendanceError } = await supabase
            .from('attendance').select('student_id, status, date').in('student_id', studentIds);
          if (attendanceError) throw attendanceError;

          students.forEach(student => {
            const records = (attendanceData || []).filter(a => {
              const d = new Date(a.date);
              return a.student_id === student.id &&
                d.getFullYear() === selectedMonth.year &&
                d.getMonth() === selectedMonth.month;
            });
            const schoolDays = records.length;
            const present = records.filter(r => r.status === 'present').length;
            const late = records.filter(r => r.status === 'late').length;
            const absent = records.filter(r => r.status === 'absent').length;
            const attendanceRate = schoolDays > 0
              ? (((present + late) / schoolDays) * 100).toFixed(2) : '0.00';
            newAttendanceRows.push({
              id: student.id,
              name: formatStudentName(student),
              schoolDays, present, late, absent,
              attendanceRate: `${attendanceRate}%`
            });
          });
        }

        setAttendanceRows(newAttendanceRows);
        setTotalPages(Math.ceil(newAttendanceRows.length / ROWS_PER_PAGE));
        setCurrentPage(1);
      } catch (err) {
        setError(err.message || 'Failed to load attendance data');
      } finally {
        setLoading(false);
      }
    };
    fetchAttendanceData();
  }, [currentClass, selectedMonth]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return attendanceRows.slice(start, start + ROWS_PER_PAGE);
  }, [attendanceRows, currentPage]);

  const columns = useMemo(() => [
    { key: 'name', label: 'Student Name', headerStyle: withColumnWidth('30%', 180), cellStyle: withColumnWidth('30%', 180), renderCell: ({ row }) => row.name },
    { key: 'schoolDays', label: 'School Days', headerStyle: withColumnWidth('14%', 80), cellStyle: withColumnWidth('14%', 80), renderCell: ({ row }) => row.schoolDays },
    { key: 'present', label: 'Present', headerStyle: withColumnWidth('14%', 80), cellStyle: withColumnWidth('14%', 80), renderCell: ({ row }) => row.present },
    { key: 'late', label: 'Late', headerStyle: withColumnWidth('14%', 80), cellStyle: withColumnWidth('14%', 80), renderCell: ({ row }) => row.late },
    { key: 'absent', label: 'Absent', headerStyle: withColumnWidth('14%', 80), cellStyle: withColumnWidth('14%', 80), renderCell: ({ row }) => row.absent },
    { key: 'attendanceRate', label: 'Attendance Rate', headerStyle: withColumnWidth('14%', 100), cellStyle: withColumnWidth('14%', 100), renderCell: ({ row }) => row.attendanceRate },
  ], []);

  return (
    <>
      <div className={styles.tabBar}>
        <div className={styles.tabBarLeft}>
          {grade && section && (
            <span className={styles.classLabel}>
              Grade {grade} - {section}
            </span>
          )}
        </div>
        {totalPages > 1 && (
          <div className={styles.tabBarRight}>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      <Table
        columns={columns}
        rows={paginatedRows}
        getRowId={row => row.id}
        loading={loading}
        error={error ? `Error: ${error}` : ''}
        emptyMessage={loading ? 'Loading...' : 'No attendance data found.'}
        tableLabel="Class Attendance Report"
        striped={false}
        stickyHeader={true}
        wrapperClassName={styles.modalTableScroll}
      />
    </>
  );
};

export default ClassAttendanceReportTable;