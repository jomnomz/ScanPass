import React, { useState, useEffect, useMemo } from 'react';
import { formatStudentName, formatNA } from '../../../Utils/Formatters';
import { sortEntities } from '../../../Utils/SortEntities';
import styles from './TeacherStudentViewTable.module.css';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../Authentication/AuthProvider/AuthProvider';
import { useRowExpansion } from '../../Hooks/useRowExpansion';
import Input from '../../UI/Input/Input';
import Button from '../../UI/Buttons/Button/Button';
import ReportGenerationModal from '../../Modals/ReportGenerationModal/ReportGenerationModal';
import ClassAttendanceReportModal from '../../Modals/ClassAttendanceReportModal/ClassAttendanceReportModal';
import Table from '../Table/Table.jsx';

const TeacherStudentViewTable = ({ selectedClass = '' }) => {
  const [students, setStudents] = useState([]);
  const [currentClassDetails, setCurrentClassDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();

  const [showReportGeneration, setShowReportGeneration] = useState(false);
  const [showClassAttendanceReport, setShowClassAttendanceReport] = useState(false);

  const { expandedRow, tableRef, toggleRow } = useRowExpansion();

  const parseClassName = (className) => {
    const match = className.match(/^(\d+)[-\s](.+)$/);
    if (match) return { grade: match[1], section: match[2] };
    return { grade: null, section: null };
  };

  const fetchClassDetails = async (className) => {
    if (!className || !user) return;
    try {
      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('id')
        .eq('email_address', user.email)
        .single();

      if (teacherError) return;

      const { grade, section } = parseClassName(className);
      if (!grade || !section) return;

      const { data: sectionData } = await supabase
        .from('sections')
        .select('id')
        .eq('section_name', section)
        .single();

      const { data: gradeData } = await supabase
        .from('grades')
        .select('id')
        .eq('grade_level', grade)
        .single();

      if (!sectionData || !gradeData) return;

      const { data: advisoryData } = await supabase
        .from('teacher_sections')
        .select('id')
        .eq('teacher_id', teacherData.id)
        .eq('section_id', sectionData.id)
        .eq('is_adviser', true)
        .maybeSingle();

      const { data: subjectData } = await supabase
        .from('teacher_subject_sections')
        .select(`subject:subjects ( subject_name, subject_code )`)
        .eq('teacher_id', teacherData.id)
        .eq('section_id', sectionData.id);

      const subjects = (subjectData || []).map(s => s.subject).filter(Boolean);
      subjects.sort((a, b) => a.subject_code.localeCompare(b.subject_code));

      const subjectDisplay = subjects.map(s => s.subject_code).join(' | ');

      setCurrentClassDetails({
        className,
        grade,
        section,
        isAdvisory: !!advisoryData,
        subjects,
        subjectDisplay,
      });
    } catch (err) {
      console.error('fetchClassDetails error:', err);
    }
  };

  const fetchClassStudents = async () => {
    if (!selectedClass) {
      setStudents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { grade, section } = parseClassName(selectedClass);

      if (!grade || !section) throw new Error(`Invalid class: ${selectedClass}`);

      const { data: sectionData, error: sectionError } = await supabase
        .from('sections')
        .select('id, section_name')
        .eq('section_name', section)
        .single();

      if (sectionError) throw new Error(`Section "${section}" not found`);

      const { data: gradeData, error: gradeError } = await supabase
        .from('grades')
        .select('id, grade_level')
        .eq('grade_level', grade)
        .single();

      if (gradeError) throw new Error(`Grade "${grade}" not found`);

      const { data: classStudents, error: studentsError } = await supabase
        .from('students')
        .select(`
          id,
          lrn,
          first_name,
          last_name,
          middle_name,
          email,
          phone_number,
          guardian_first_name,
          guardian_last_name,
          guardian_phone_number,
          guardian_email,
          created_at,
          grade:grades(grade_level),
          section:sections(section_name)
        `)
        .eq('grade_id', gradeData.id)
        .eq('section_id', sectionData.id)
        .order('last_name');

      if (studentsError) throw studentsError;

      const transformedData = (classStudents || []).map(student => ({
        ...student,
        grade: student.grade?.grade_level || 'N/A',
        section: student.section?.section_name || 'N/A',
      }));

      setStudents(transformedData);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching class students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassDetails(selectedClass);
    fetchClassStudents();
    toggleRow(null);
    setSearchTerm('');
  }, [selectedClass, user]);

  const sortedStudents = useMemo(() => sortEntities(students, { type: 'student' }), [students]);

  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return sortedStudents;
    const searchLower = searchTerm.toLowerCase().trim();
    return sortedStudents.filter(student =>
      student.lrn?.toLowerCase().includes(searchLower) ||
      student.first_name?.toLowerCase().includes(searchLower) ||
      student.middle_name?.toLowerCase().includes(searchLower) ||
      student.last_name?.toLowerCase().includes(searchLower) ||
      student.email?.toLowerCase().includes(searchLower)
    );
  }, [sortedStudents, searchTerm]);

  const handleRowClick = (studentId, e) => {
    if (e.target.closest('button') || e.target.closest('.action-button')) return;
    toggleRow(studentId);
  };

  const getTableInfoMessage = () => {
    const studentCount = filteredStudents.length;
    if (!currentClassDetails) return '';

    const { grade, section, isAdvisory, subjects } = currentClassDetails;

    let classInfo = `Grade ${grade} - Section ${section}`;

    if (subjects.length > 0) {
      const subjectCodes = subjects.map(s => s.subject_code).join(', ');
      classInfo += ` (${subjectCodes}`;
      if (isAdvisory) classInfo += ', Advisory Class';
      classInfo += ')';
    } else if (isAdvisory) {
      classInfo += ' (Advisory Class)';
    }

    let message = `Showing ${studentCount} student/s in ${classInfo}`;
    if (searchTerm) message += ` matching "${searchTerm}"`;
    return message;
  };

  const withColumnWidth = (width, minWidth) => ({
    width,
    minWidth: `${minWidth}px`,
  });

  const columns = useMemo(() => [
    {
      key: 'lrn',
      label: 'STUDENT ID',
      headerStyle: withColumnWidth('15%', 120),
      cellStyle: withColumnWidth('15%', 120),
      renderCell: ({ row }) => formatNA(row.lrn),
    },
    {
      key: 'name',
      label: 'NAME',
      headerStyle: withColumnWidth('25%', 180),
      cellStyle: withColumnWidth('25%', 180),
      renderCell: ({ row }) => formatStudentName(row),
    },
    {
      key: 'section',
      label: 'SECTION',
      headerStyle: withColumnWidth('15%', 120),
      cellStyle: withColumnWidth('15%', 120),
      renderCell: ({ row }) => row.section,
    },
    {
      key: 'email',
      label: 'EMAIL',
      headerStyle: withColumnWidth('35%', 180),
      cellStyle: withColumnWidth('35%', 180),
      renderCell: ({ row }) => formatNA(row.email),
    },
  ], []);

  if (loading && students.length === 0) {
    return (
      <div className={styles.teacherStudentView}>
        <div className={styles.loading}>Loading student profiles...</div>
      </div>
    );
  }

  if (!selectedClass) {
    return (
      <div className={styles.teacherStudentView}>
        <div className={styles.noStudents}>Select a class from the sidebar to view students.</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.teacherStudentView}>
        <div className={styles.error}>Error: {error}</div>
      </div>
    );
  }

  const renderExpandedRow = (student) => (
    <div
      className={`${styles.studentCard} ${styles.expandableCard}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className={styles.closeExpandBtn}
        onClick={(e) => { e.stopPropagation(); toggleRow(null); }}
        aria-label="Close"
        type="button"
      >
        ✕
      </button>

      <div className={styles.studentHeader}>{formatStudentName(student)}</div>

      <div className={styles.details}>
        <div>
          <div className={styles.studentInfo}><strong>Student Details</strong></div>
          <div className={styles.studentInfo}>Student ID: {formatNA(student.lrn)}</div>
          <div className={styles.studentInfo}>Section: {student.section}</div>
          <div className={styles.studentInfo}>Phone Number: {formatNA(student.phone_number)}</div>
        </div>
        <div>
          <div className={styles.studentInfo}><strong>Guardian Information</strong></div>
          <div className={styles.studentInfo}>
            Name of Parent: {formatNA(student.guardian_first_name)} {formatNA(student.guardian_last_name)}
          </div>
          <div className={styles.studentInfo}>Phone Number: {formatNA(student.guardian_phone_number)}</div>
          <div className={styles.studentInfo}>Email address: {formatNA(student.guardian_email)}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.teacherStudentView} ref={tableRef}>
      <div className={styles.searchContainer}>
        <div className={styles.searchRow}>
          <Input
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            search={true}
          />
          <Button
            label="Class Attendance Report"
            onClick={() => setShowClassAttendanceReport(true)}
            color="ocean"
            height="sm"
            width="auto"
            title="Show class attendance report"
          />
        </div>
      </div>

      <Table
        columns={columns}
        rows={filteredStudents}
        getRowId={(row) => row.id}
        loading={loading}
        error={error ? `Error: ${error}` : ''}
        emptyMessage={
          searchTerm
            ? `No students found matching "${searchTerm}"`
            : `No students found in class ${selectedClass}`
        }
        containerRef={tableRef}
        tableLabel="Teacher students"
        onRowClick={({ row, event }) => handleRowClick(row.id, event)}
        expandedRowId={expandedRow}
        renderExpandedRow={({ row }) => renderExpandedRow(row)}
        persistExpandedRows
        hideMainRowWhenExpanded
        getExpandedRowClassName={({ isExpanded }) =>
          `${styles.expandRow} ${isExpanded ? styles.expandRowActive : ''}`
        }
        className={styles.teacherStudentTableContainer}
        wrapperClassName={styles.tableWrapper}
        infoText={getTableInfoMessage()}
        striped={true}
        stickyHeader
      />

      <ReportGenerationModal
        isOpen={showReportGeneration}
        onClose={() => setShowReportGeneration(false)}
        currentClass={selectedClass}
      />

      <ClassAttendanceReportModal
        isOpen={showClassAttendanceReport}
        onClose={() => setShowClassAttendanceReport(false)}
        currentClass={selectedClass}
      />
    </div>
  );
};

export default TeacherStudentViewTable;