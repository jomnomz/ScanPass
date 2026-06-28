import React, { useState, useEffect, useMemo } from 'react';
import { formatStudentName, formatNA } from '../../../Utils/Formatters';
import { sortEntities } from '../../../Utils/SortEntities';
import styles from './TeacherStudentViewTable.module.css';
import { supabase } from '../../../lib/supabase';
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// import { faImage } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../Authentication/AuthProvider/AuthProvider';
import { useRowExpansion } from '../../Hooks/useRowExpansion';
import Input from '../../UI/Input/Input';
import Button from '../../UI/Buttons/Button/Button';
import ReportGenerationModal from '../../Modals/ReportGenerationModal/ReportGenerationModal';
import ClassAttendanceReportModal from '../../Modals/ClassAttendanceReportModal/ClassAttendanceReportModal';
// import StudentReportModal from '../../Modals/StudentReportModal/StudentReportModal';
import Table from '../Table/Table.jsx';

const TeacherStudentViewTable = () => {
  const [students, setStudents] = useState([]);
  const [teacherClasses, setTeacherClasses] = useState([]);
  const [currentClass, setCurrentClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();
  
  const [showReportGeneration, setShowReportGeneration] = useState(false);
  // const [showStudentReport, setShowStudentReport] = useState(false);
  // const [selectedStudent, setSelectedStudent] = useState(null);
  const [showClassAttendanceReport, setShowClassAttendanceReport] = useState(false); // Placeholder for class attendance report modal
  
  const { expandedRow, tableRef, toggleRow } = useRowExpansion();
  const classTabStorageKey = useMemo(() => {
    const teacherScope = user?.email || 'anonymous';
    return `teacher-students:selected-class:${teacherScope}`;
  }, [user?.email]);

  const fetchTeacherClasses = async () => {
    if (!user) return;

    try {
      const teacherEmail = user.email;
      
      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('id, first_name, last_name')
        .eq('email_address', teacherEmail)
        .single();

      if (teacherError) throw teacherError;

      const { data: teacherSectionsData, error: sectionsError } = await supabase
        .from('teacher_sections')
        .select(`
          id,
          section_id,
          is_adviser,
          section:sections (
            id,
            section_name,
            grade:grades (
              id,
              grade_level
            )
          )
        `)
        .eq('teacher_id', teacherData.id)
        .eq('is_adviser', true);

      if (sectionsError) throw sectionsError;

      const { data: teacherSubjectSectionsData, error: subjectSectionsError } = await supabase
        .from('teacher_subject_sections')
        .select(`
          id,
          subject_id,
          section_id,
          subject:subjects (
            id,
            subject_name,
            subject_code
          ),
          section:sections (
            id,
            section_name,
            grade:grades (
              id,
              grade_level
            )
          )
        `)
        .eq('teacher_id', teacherData.id);

      if (subjectSectionsError) throw subjectSectionsError;

      const classMap = new Map();

      if (teacherSectionsData && teacherSectionsData.length > 0) {
        teacherSectionsData.forEach(item => {
          if (item.section) {
            const grade = item.section.grade?.grade_level || '';
            const section = item.section.section_name || '';
            const className = `${grade}-${section}`;
            const key = className;
            
            if (!classMap.has(key)) {
              classMap.set(key, {
                id: item.id,
                className: className,
                grade: grade,
                section: section,
                schoolYear: 'SY 2024-2025',
                subjects: []
              });
            }
            
            classMap.get(key).subjects.push({
              subjectName: 'Advisory Class',
              subjectCode: 'ADV',
              isAdvisory: true
            });
          }
        });
      }

      if (teacherSubjectSectionsData && teacherSubjectSectionsData.length > 0) {
        teacherSubjectSectionsData.forEach(item => {
          if (item.section && item.subject) {
            const grade = item.section.grade?.grade_level || '';
            const section = item.section.section_name || '';
            const className = `${grade}-${section}`;
            const subjectCode = item.subject.subject_code || 'SUB';
            const subjectName = item.subject.subject_name || 'Subject';
            const key = className;
            
            if (!classMap.has(key)) {
              classMap.set(key, {
                id: item.id,
                className: className,
                grade: grade,
                section: section,
                schoolYear: 'SY 2024-2025',
                subjects: []
              });
            }
            
            classMap.get(key).subjects.push({
              subjectName: subjectName,
              subjectCode: subjectCode,
              isAdvisory: false
            });
          }
        });
      }

      const classes = Array.from(classMap.values()).map(cls => {
        cls.subjects.sort((a, b) => {
          if (!a.isAdvisory && b.isAdvisory) return -1;
          if (a.isAdvisory && !b.isAdvisory) return 1;
          return a.subjectCode.localeCompare(b.subjectCode);
        });

        const subjectDisplay = cls.subjects
          .map(sub => sub.subjectCode)
          .join(' | ');

        return {
          ...cls,
          subjectDisplay: subjectDisplay,
          fullSubjects: cls.subjects
        };
      });

      classes.sort((a, b) => {
        const gradeA = parseInt(a.grade) || 0;
        const gradeB = parseInt(b.grade) || 0;
        if (gradeA !== gradeB) return gradeA - gradeB;
        return a.section.localeCompare(b.section);
      });

      setTeacherClasses(classes);
      
      if (classes.length > 0) {
        let nextClass = classes[0].className;

        try {
          const savedClass = localStorage.getItem(classTabStorageKey);
          if (savedClass && classes.some(cls => cls.className === savedClass)) {
            nextClass = savedClass;
          }
        } catch (storageError) {
          console.warn('Unable to restore selected class tab:', storageError);
        }

        setCurrentClass(nextClass);
      }
    } catch (err) {
      console.error('Error fetching teacher classes:', err);
      setError('Failed to load teacher classes: ' + err.message);
    }
  };

  const fetchClassStudents = async () => {
    if (!currentClass) return;

    setLoading(true);
    setError(null);
    
    try {
      const { grade, section } = parseClassName(currentClass);
      
      if (!grade || !section) {
        throw new Error(`Invalid class name: ${currentClass}`);
      }
      
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
        section: student.section?.section_name || 'N/A'
      }));

      setStudents(transformedData);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching class students:', err);
    } finally {
      setLoading(false);
    }
  };

  const parseClassName = (className) => {
    const match = className.match(/^(\d+)[-\s](.+)$/);
    if (match) {
      const grade = match[1];
      const section = match[2];
      return { grade, section };
    }
    return { grade: null, section: null };
  };

  useEffect(() => {
    fetchTeacherClasses();
  }, [user]);

  useEffect(() => {
    if (currentClass) {
      fetchClassStudents();
    }
  }, [currentClass]);

  const sortedStudents = useMemo(() => {
    return sortEntities(students, { type: 'student' });
  }, [students]);

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

  // const handleViewReport = (student, e) => {
  //   e.stopPropagation();
  //   setSelectedStudent(student);
  //   setShowStudentReport(true);
  // };

  const handleClassChange = (className) => {
    setCurrentClass(className);

    try {
      localStorage.setItem(classTabStorageKey, className);
    } catch (storageError) {
      console.warn('Unable to persist selected class tab:', storageError);
    }

    toggleRow(null);
  };

  const handleRowClick = (studentId, e) => {
    if (e.target.closest('button') || e.target.closest('.action-button')) {
      return;
    }
    toggleRow(studentId);
  };

  const currentClassDetails = useMemo(() => {
    return teacherClasses.find(cls => cls.className === currentClass);
  }, [teacherClasses, currentClass]);

  const getTableInfoMessage = () => {
    const studentCount = filteredStudents.length;
    
    if (!currentClassDetails) return '';
    
    const { grade, section } = parseClassName(currentClass);
    
    let message = `Showing ${studentCount} student/s in Grade ${grade} - Section ${section}`;
    
    const hasAdvisory = currentClassDetails.subjects.some(sub => sub.isAdvisory);
    const otherSubjects = currentClassDetails.subjects.filter(sub => !sub.isAdvisory);
    
    if (otherSubjects.length > 0) {
      const subjectCodes = otherSubjects.map(sub => sub.subjectCode).join(', ');
      message += ` (${subjectCodes}`;
      
      if (hasAdvisory) {
        message += `, Advisory Class`;
      }
      
      message += `)`;
    } else if (hasAdvisory) {
      message += ` (Advisory Class)`;
    }
    
    if (searchTerm) {
      message += ` matching "${searchTerm}"`;
    }
    
    return message;
  };

  const withColumnWidth = (width, minWidth) => ({
    width,
    minWidth: `${minWidth}px`
  });

  const columns = useMemo(() => [
    {
      key: 'lrn',
      label: 'STUDENT ID',
      headerStyle: withColumnWidth('15%', 120),
      cellStyle: withColumnWidth('15%', 120),
      renderCell: ({ row }) => formatNA(row.lrn)
    },
    {
      key: 'name',
      label: 'NAME',
      headerStyle: withColumnWidth('25%', 180),
      cellStyle: withColumnWidth('25%', 180),
      renderCell: ({ row }) => formatStudentName(row)
    },
    {
      key: 'section',
      label: 'SECTION',
      headerStyle: withColumnWidth('15%', 120),
      cellStyle: withColumnWidth('15%', 120),
      renderCell: ({ row }) => row.section
    },
    {
      key: 'email',
      label: 'EMAIL',
      headerStyle: withColumnWidth('35%', 180),
      cellStyle: withColumnWidth('35%', 180),
      renderCell: ({ row }) => formatNA(row.email)
    }
    // Reports column commented out
    // ,{
    //   key: 'reports',
    //   label: 'REPORTS',
    //   headerStyle: withColumnWidth('10%', 80),
    //   cellStyle: withColumnWidth('10%', 80),
    //   renderCell: ({ row }) => (
    //     <div className={styles.reportButtonContainer}>
    //       <button 
    //         className={styles.reportButton}
    //         onClick={(e) => handleViewReport(row, e)}
    //         title="View attendance reports"
    //       >
    //         <FontAwesomeIcon icon={faImage} />
    //       </button>
    //     </div>
    //   )
    // }
  ], []);

  if (loading && students.length === 0) {
    return (
      <div className={styles.teacherStudentView}>
        <div className={styles.loading}>Loading student profiles...</div>
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

const renderExpandedRow = (student) => {
    return (
      <div 
        className={`${styles.studentCard} ${styles.expandableCard}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ✅ Close button - collapses the expanded row */}
        <button
          className={styles.closeExpandBtn}
          onClick={(e) => {
            e.stopPropagation();
            toggleRow(null);
          }}
          aria-label="Close"
          type="button"
        >
          ✕
        </button>

        <div className={styles.studentHeader}>
          {formatStudentName(student)}
        </div>
      
        <div className={styles.details}>
          <div>
            <div className={styles.studentInfo}>
              <strong>Student Details</strong>
            </div>
            <div className={styles.studentInfo}>Student ID: {formatNA(student.lrn)}</div>
            <div className={styles.studentInfo}>Section: {student.section}</div>
            <div className={styles.studentInfo}>Phone Number: {formatNA(student.phone_number)}</div>
          </div>

          <div>
            <div className={styles.studentInfo}>
              <strong>Guardian Information</strong>
            </div>
            <div className={styles.studentInfo}>
              Name of Parent: {formatNA(student.guardian_first_name)} {formatNA(student.guardian_last_name)}
            </div>
            <div className={styles.studentInfo}>
              Phone Number: {formatNA(student.guardian_phone_number)}
            </div>
            <div className={styles.studentInfo}>
              Email address: {formatNA(student.guardian_email)}
            </div>
          </div>
        </div>
      </div>
    );
  };

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
          {/* <Button
            label="Mark Valid Days"
            onClick={() => setShowReportGeneration(true)}
            color="ocean"
            height="sm"
            width="auto"
            title="Configure school days and attendance reports"
          /> */}
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
        emptyMessage={searchTerm 
          ? `No students found matching "${searchTerm}"` 
          : `No students found in class ${currentClass}`}
        containerRef={tableRef}
        tableLabel="Teacher students"
        onRowClick={({ row, event }) => handleRowClick(row.id, event)}
        expandedRowId={expandedRow}
        renderExpandedRow={({ row }) => renderExpandedRow(row)}
        persistExpandedRows
        hideMainRowWhenExpanded
        getExpandedRowClassName={({ isExpanded }) => `${styles.expandRow} ${isExpanded ? styles.expandRowActive : ''}`}
        className={styles.teacherStudentTableContainer}
        wrapperClassName={styles.tableWrapper}
        infoText={getTableInfoMessage()}
        gradeTabs={{
          options: teacherClasses,
          currentValue: currentClass,
          onChange: handleClassChange,
          showAll: false,
          renderLabel: (cls) => `${cls.className} | ${cls.subjectDisplay}`,
          getOptionValue: (cls) => cls.className
        }}
        striped={true}
        stickyHeader
      />

      <ReportGenerationModal
        isOpen={showReportGeneration}
        onClose={() => setShowReportGeneration(false)}
        currentClass={currentClass}
      />

      <ClassAttendanceReportModal
        isOpen={showClassAttendanceReport}
        onClose={() => setShowClassAttendanceReport(false)}
        currentClass={currentClass}
      />
      {/*
      <StudentReportModal
        isOpen={showStudentReport}
        onClose={() => setShowStudentReport(false)}
        student={selectedStudent}
        currentClass={currentClass}
      />
      */}
    </div>
  );
};

export default TeacherStudentViewTable;