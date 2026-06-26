  import React, { useMemo, useState, useEffect } from 'react';
  import { grades, shouldHandleRowClick } from '../../../Utils/TableHelpers';
  import { formatStudentName, formatNA } from '../../../Utils/Formatters';
  import { compareSections } from '../../../Utils/CompareHelpers';
  import SectionDropdown from '../../UI/Buttons/SectionDropdown/SectionDropdown';
  import QRCodeModal from '../../Modals/QRCodeModal/QRCodeModal';
  import QRCodeUpdateWarningModal from '../../Modals/QRCodeUpdateWarningModal/QRCodeUpdateWarningModal';
  import styles from './StudentTable.module.css';
  import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
  import { faCircle as farCircle } from "@fortawesome/free-regular-svg-icons";
  import { faQrcode, faPenToSquare, faTrashCan, faCircle as fasCircle, faPlus } from "@fortawesome/free-solid-svg-icons";
  import { useToast } from '../../Toast/ToastContext/ToastContext';
  import { useAuth } from '../../Authentication/AuthProvider/AuthProvider'; 
  import { useEntityEdit } from '../../Hooks/useEntityEdit'; 
  import { useRowExpansion } from '../../Hooks/useRowExpansion'; 
  import { useStudentActions } from '../../Hooks/useEntityActions'; 
  import { StudentService } from '../../../Utils/EntityService'; 
  import Table from '../Table/Table.jsx';

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

  const StudentTable = ({ 
    searchTerm = '', 
    selectedSection = '', 
    onSectionsUpdate, 
    onSelectedStudentsUpdate,
    onStudentDataUpdate,
    onGradeUpdate,
    onClearSectionFilter,
    onSingleDeleteClick,
    refreshStudents,
    refreshAllStudents,
    onSectionSelect,
    availableSections = [],
    students: propStudents = [],
    gradesData = [],
    sectionsData = [],
    loading: parentLoading = false,
    paginationContent = null,
    totalStudentCount = 0,
    isAllPagesSelected = false,
    onSelectAllPages,
    onClearAllPages,
    currentPage = 1,
    onFilteredCountChange
  }) => {
      
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentClass, setCurrentClass] = useState('all');
    
    const { editingId: editingStudent, editFormData, saving, validationErrors, startEdit, cancelEdit, updateEditField, saveEdit } = useEntityEdit(
      students, 
      setStudents,
      'student',
      refreshAllStudents
    );
    
    const { expandedRow, tableRef, toggleRow, isRowExpanded } = useRowExpansion();
    const { 
      qrModalOpen, setQrModalOpen, selectedStudent, 
      handleQRCodeClick 
    } = useStudentActions(setStudents);

    const { success } = useToast();
    const { user, profile, loading: authLoading } = useAuth();
    const [updateWarningOpen, setUpdateWarningOpen] = useState(false);
    const [pendingUpdate, setPendingUpdate] = useState(null);
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [gradeSectionsMap, setGradeSectionsMap] = useState({});

    const studentService = useMemo(() => new StudentService(), []);

    useEffect(() => {
      if (propStudents && propStudents.length > 0) {
        console.log('📊 Initializing students from parent:', propStudents.length);
        setStudents(propStudents);
        setLoading(false);
      } else if (!parentLoading) {
        setStudents([]);
        setLoading(false);
      }
    }, [propStudents, parentLoading]);

    useEffect(() => {
      if (propStudents && propStudents.length >= 0) {
        setStudents(propStudents);
      }
    }, [propStudents]);

    useEffect(() => {
      if (sectionsData.length > 0 && gradesData.length > 0) {
        console.log('📋 Building grade-sections map from props...');
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
        
        console.log('📋 Grade-sections map:', map);
        setGradeSectionsMap(map);
      }
    }, [gradesData, sectionsData]);

    const allUniqueSections = useMemo(() => {
      const sections = students
        .map(student => student.section || '')
        .filter(section => section && section.trim() !== '');
      
      const uniqueSections = [...new Set(sections)];
      const sorted = uniqueSections.sort(compareSections);
      return sorted;
    }, [students]);

    const currentGradeSections = useMemo(() => {
      if (currentClass === 'all') {
        return allUniqueSections;
      }
      
      const sections = students
        .filter(student => student.grade === currentClass)
        .map(student => student.section || '')
        .filter(section => section && section.trim() !== '');
      
      const uniqueSections = [...new Set(sections)];
      return uniqueSections.sort(compareSections);
    }, [students, currentClass, allUniqueSections]);

    const sectionsToShowInDropdown = useMemo(() => {
      return currentGradeSections;
    }, [currentGradeSections]);

    const availableSectionsForCurrentGrade = useMemo(() => {
      if (!editFormData.grade) return [];
      
      const sections = gradeSectionsMap[editFormData.grade] || [];
      return sections;
    }, [editFormData.grade, gradeSectionsMap]);

    useEffect(() => {
      if (onGradeUpdate) {
        onGradeUpdate(currentClass);
      }
    }, [currentClass, onGradeUpdate]);

    useEffect(() => {
      if (onSectionsUpdate) {
        onSectionsUpdate(allUniqueSections);
      }
    }, [allUniqueSections, onSectionsUpdate]);

    // No re-filtering or re-sorting needed — parent already handled it
    const sortedStudents = students;

    useEffect(() => {
      if (onFilteredCountChange) {
        onFilteredCountChange(sortedStudents.length);
      }
    }, [sortedStudents.length, onFilteredCountChange]);

    const visibleSelectedStudents = useMemo(() => {
      const visibleStudentIds = new Set(sortedStudents.map(student => student.id));
      return selectedStudents.filter(id => visibleStudentIds.has(id));
    }, [selectedStudents, sortedStudents]);

    useEffect(() => {
      if (onSelectedStudentsUpdate) {
        onSelectedStudentsUpdate(visibleSelectedStudents);
      }
    }, [visibleSelectedStudents, onSelectedStudentsUpdate]);

    const handleClassChange = (className) => {
      setCurrentClass(className);
      toggleRow(null); 
      cancelEdit(); 
      setSelectedStudents([]); 
      
      if (selectedSection && onSectionSelect) {
        onSectionSelect('');
      }
      
      if (selectedSection && onClearSectionFilter) {
        onClearSectionFilter();
      }
    };

    const handleSectionFilter = (section) => {
      if (onSectionSelect) {
        onSectionSelect(section);
      }
    };

    const handleRowClick = (studentId, e) => {
      if (shouldHandleRowClick(editingStudent, e.target)) {
        toggleRow(studentId);
      }
    };

    const handleEditClick = (student, e) => {
      e.stopPropagation();
      
      console.log('✏️ Editing student:', {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        grade: student.grade,
        section: student.section
      });
      
      const studentForEdit = {
        ...student,
        grade: student.grade, 
        section: student.section
      };
      
      startEdit(studentForEdit);
      toggleRow(null); 
    };

    const handleInputChange = (e) => {
      const { name, value } = e.target;
      updateEditField(name, value);
    };

    const handleSelectChange = (e) => {
      const { name, value } = e.target;
      
      if (name === 'grade') {
        const gradeSections = gradeSectionsMap[value] || [];
        
        if (editFormData.section && gradeSections.includes(editFormData.section)) {
          updateEditField(name, value);
        } else {
          const firstSection = gradeSections.length > 0 ? gradeSections[0] : '';
          updateEditField('section', firstSection);
          updateEditField(name, value);
        }
      } else {
        updateEditField(name, value);
      }
    };

    const handleSaveEdit = async (studentId, e) => {
      if (e) e.stopPropagation();
      
      const student = students.find(s => s.id === studentId);
      
      const criticalFieldsChanged = 
        editFormData.lrn !== student.lrn ||
        editFormData.first_name !== student.first_name ||
        editFormData.last_name !== student.last_name ||
        editFormData.grade !== student.grade ||
        editFormData.section !== student.section;

      if (criticalFieldsChanged) {
        setPendingUpdate({ studentId, student });
        setUpdateWarningOpen(true);
      } else {
        await performStudentUpdate(studentId);
      }
    };

    const performStudentUpdate = async (studentId) => {
      let gradeId = null;
      let sectionId = null;
      
      try {
        console.log('🔍 Finding grade and section IDs for:', {
          grade: editFormData.grade,
          section: editFormData.section
        });
        
        if (editFormData.grade) {
          const grade = gradesData.find(g => g.grade_level === editFormData.grade);
          
          if (grade) {
            gradeId = grade.id;
            console.log('✅ Found grade_id:', gradeId, 'for grade:', editFormData.grade);
          } else {
            console.error('❌ Grade not found:', editFormData.grade);
            console.log('Available grades:', gradesData.map(g => g.grade_level));
          }
        }
        
        if (editFormData.section && gradeId) {
          const sectionsForGrade = sectionsData.filter(s => s.grade_id === gradeId);
          console.log('📋 Sections for grade_id', gradeId, ':', sectionsForGrade);
          
          const section = sectionsData.find(s => 
            s.section_name === editFormData.section && 
            s.grade_id === gradeId
          );
          
          if (section) {
            sectionId = section.id;
            console.log('✅ Found section_id:', sectionId);
          } else {
            console.error('❌ Section not found for this grade');
          }
        }
        
        console.log('📝 Final IDs to update:', { gradeId, sectionId });
        
        if (!gradeId) {
          throw new Error(`Grade "${editFormData.grade}" not found. Available grades: ${gradesData.map(g => g.grade_level).join(', ')}`);
        }
        
        const result = await saveEdit(
          studentId, 
          currentClass, 
          async (id, data) => {
            const updateData = {
              lrn: data.lrn,
              first_name: data.first_name,
              middle_name: data.middle_name,
              last_name: data.last_name,
              email: data.email,
              phone_number: data.phone_number,
              guardian_first_name: data.guardian_first_name,
              guardian_middle_name: data.guardian_middle_name,
              guardian_last_name: data.guardian_last_name,
              guardian_phone_number: data.guardian_phone_number,
              guardian_email: data.guardian_email,
              updated_by: user?.id,
              updated_at: new Date().toISOString()
            };
            
            updateData.grade_id = gradeId;
            updateData.grade = editFormData.grade;
            
            if (sectionId) {
              updateData.section_id = sectionId;
              updateData.section = editFormData.section;
            } else {
              updateData.section_id = null;
              updateData.section = '';
            }
            
            console.log('💾 Updating student:', updateData);
            
            const result = await studentService.update(id, updateData);
            return result;
          }
        );
        
        if (result.success) {
          success('Student updated successfully');
          if (refreshStudents) {
            await refreshStudents();
          }
        }
        
      } catch (error) {
        console.error('Update error:', error);
        alert(`Error: ${error.message}`);
      }
    };

    const handleConfirmUpdate = async () => {
      if (pendingUpdate) {
        await performStudentUpdate(pendingUpdate.studentId);
        setPendingUpdate(null);
        setUpdateWarningOpen(false);
      }
    };

    const handleInputClick = (e) => {
      e.stopPropagation();
    };

    const handleQRCodeClickWithEvent = async (student, e) => {
      e.stopPropagation();
      await handleQRCodeClick(student);
    };

    const handleDeleteClickWithEvent = (student, e) => {
      e.stopPropagation();
      if (onSingleDeleteClick) {
        onSingleDeleteClick(student);
      }
    };

    const handleStudentSelect = (studentId, e) => {
      e.stopPropagation();
      setSelectedStudents(prev => {
        if (prev.includes(studentId)) {
          return prev.filter(id => id !== studentId);
        } else {
          return [...prev, studentId];
        }
      });
    };

    const handleSelectAll = () => {
      const allVisibleStudentIds = sortedStudents.map(student => student.id);
      
      if (allVisibleStudentIds.every(id => selectedStudents.includes(id))) {
        setSelectedStudents(prev => prev.filter(id => !allVisibleStudentIds.includes(id)));
        if (onClearAllPages) onClearAllPages();
      } else {
        setSelectedStudents(prev => {
          const newSelection = new Set([...prev, ...allVisibleStudentIds]);
          return Array.from(newSelection);
        });
      }
    };

    const allVisibleSelected = sortedStudents.length > 0 && 
      sortedStudents.every(student => selectedStudents.includes(student.id));

    const allOnPageSelected = sortedStudents.length > 0 &&
      sortedStudents.every(student => selectedStudents.includes(student.id));

    const computedInfoText = (() => {
      if (isAllPagesSelected) return `All ${totalStudentCount} students selected`;
      if (allOnPageSelected) return `Selected all ${sortedStudents.length} student/s • Page ${currentPage}`;
      if (visibleSelectedStudents.length > 0) return `${visibleSelectedStudents.length} selected • Page ${currentPage}`;
      return '';
    })();

    const selectAllBanner = (() => {
      if (isAllPagesSelected) {
        return (
          <button
            onClick={onClearAllPages}
            onMouseEnter={e => e.currentTarget.style.background = '#0a5042'}
            onMouseLeave={e => e.currentTarget.style.background = '#0F6B58'}
            style={{ 
              background: '#0F6B58', 
              border: '1px solid #0F6B58', 
              borderRadius: '999px', 
              cursor: 'pointer', 
              color: 'white', 
              fontSize: '0.85rem', 
              fontWeight: 600, 
              padding: '6px 12px', 
              textDecoration: 'none',
              transition: 'background 0.2s ease'
            }}
          >
            Clear all
          </button>
        );
      }
      if (allOnPageSelected && totalStudentCount > sortedStudents.length) {
        return (
          <button
            onClick={onSelectAllPages}
            onMouseEnter={e => e.currentTarget.style.background = '#0a5042'}
            onMouseLeave={e => e.currentTarget.style.background = '#0F6B58'}
            style={{ 
              background: '#0F6B58', 
              border: '1px solid #0F6B58', 
              borderRadius: '999px', 
              cursor: 'pointer', 
              color: 'white', 
              fontSize: '0.85rem', 
              fontWeight: 600, 
              padding: '6px 12px', 
              textDecoration: 'none',
              transition: 'background 0.2s ease'
            }}
          >
            <FontAwesomeIcon icon={faPlus} style={{ marginRight: '6px', fontSize: '0.75rem' }} />
            Select all {totalStudentCount} students
          </button>
        );
      }
      return null;
    })();

    const renderEditInput = (fieldName, type = 'text') => (
      <input
        type={type}
        name={fieldName}
        value={editFormData[fieldName] || ''}
        onChange={handleInputChange}
        onClick={handleInputClick}
        className={`${styles.editInput} ${validationErrors[fieldName] ? styles.errorInput : ''} edit-input`}
      />
    );

    const renderGuardianEditInput = (fieldName, type = 'text') => (
      <input
        type={type}
        name={fieldName}
        value={editFormData[fieldName] || ''}
        onChange={handleInputChange}
        onClick={handleInputClick}
        className={`${styles.editInput} ${validationErrors[fieldName] ? styles.errorInput : ''} edit-input`}
        placeholder={`Guardian ${fieldName.replace('guardian_', '').replace('_', ' ')}`}
      />
    );

    const renderGradeDropdown = () => (
      <select
        name="grade"
        value={editFormData.grade || ''}
        onChange={handleSelectChange}
        onClick={handleInputClick}
        className={`${styles.editSelect} ${validationErrors.grade ? styles.errorInput : ''} edit-input`}
      >
        {grades.map(grade => (
          <option key={grade} value={grade}>
            Grade {grade}
          </option>
        ))}
      </select>
    );

    const renderSectionDropdown = () => {
      const sections = availableSectionsForCurrentGrade;
      
      if (!editFormData.grade || sections.length === 0) {
        return (
          <div className={styles.noSectionsMessage}>
            {!editFormData.grade ? 'Select a grade first' : 'No sections available for this grade'}
          </div>
        );
      }
      
      return (
        <select
          name="section"
          value={editFormData.section || ''}
          onChange={handleSelectChange}
          onClick={handleInputClick}
          className={`${styles.editSelect} ${validationErrors.section ? styles.errorInput : ''} edit-input`}
        >
          {sections.map(section => (
            <option key={section} value={section}>
              {section}
            </option>
          ))}
        </select>
      );
    };

    const renderField = (student, fieldName, isEditable = true) => {
      if (editingStudent === student.id && isEditable) {
        if (fieldName === 'grade') {
          return renderGradeDropdown();
        } else if (fieldName === 'section') {
          return renderSectionDropdown();
        } else if (fieldName.startsWith('guardian_')) {
          return renderGuardianEditInput(fieldName, fieldName.includes('email') ? 'email' : 'text');
        }
        return renderEditInput(fieldName, fieldName === 'email' ? 'email' : 'text');
      }
      
      if (fieldName === 'email' || fieldName === 'phone_number') {
        return ''; 
      }
      
      if (fieldName.startsWith('guardian_')) {
        return formatNA(student[fieldName]);
      }
      
      return student[fieldName] || '';
    };

    const renderActionButtons = (student) => (
      <div className={`${styles.editActions} action-button`}>
        <button 
          onClick={(e) => handleSaveEdit(student.id, e)}
          disabled={saving || !editFormData.grade || !editFormData.section}
          className={styles.saveBtn}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button 
          onClick={() => {
            cancelEdit();
          }}
          disabled={saving}
          className={styles.cancelBtn}
        >
          Cancel
        </button>
      </div>
    );

    const renderEditCell = (student) => (
      <div className={styles.editCell}>
        {editingStudent === student.id ? (
          renderActionButtons(student)
        ) : (
          <div className={styles.icon}>
            <FontAwesomeIcon 
              icon={faPenToSquare} 
              onClick={(e) => handleEditClick(student, e)}
              className="action-button"
            />
          </div>
        )}
      </div>
    );

    const renderExpandedContent = (student) => {
      const addedAt = formatDateTimeLocal(student.created_at);
      const updatedAt = student.updated_at ? formatDateTimeLocal(student.updated_at) : 'Never updated';
      
      const getCurrentUserName = () => {
        if (!user) return 'N/A';
        if (profile) {
          const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
          return name || profile.username || profile.email || 'Current User';
        }
        return user.email || 'Current User';
      };
      
      const currentUserName = getCurrentUserName();
      const currentUserId = user?.id;
      
      const updatedByName = student.updated_by 
        ? (student.updated_by_user 
            ? `${student.updated_by_user.first_name || ''} ${student.updated_by_user.last_name || ''}`.trim() || 
              student.updated_by_user.username || 
              student.updated_by_user.email || 
              'User'
            : (currentUserId && student.updated_by === currentUserId ? currentUserName : 'User')
          )
        : 'Not yet updated';

      return (
        <div 
          className={`${styles.studentCard} ${styles.expandableCard}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.studentHeader}>
            {formatStudentName(student)}
          </div>
        
          <div className={styles.details}>
            <div>
              <div className={styles.studentInfo}>
                <strong>Student Details</strong>
              </div>
              <div className={styles.studentInfo}>LRN: {student.lrn}</div>
              <div className={styles.studentInfo}>Grade & Section: {student.grade} - {student.section}</div>
              <div className={styles.studentInfo}>Full Name: {formatStudentName(student)}</div>
              <div className={styles.studentInfo}>Email: {formatNA(student.email)}</div>
              <div className={styles.studentInfo}>Phone: {formatNA(student.phone_number)}</div>
            </div>

            <div>
              <div className={styles.studentInfo}>
                <strong>Guardian Information</strong>
              </div>
              <div className={styles.studentInfo}>
                Name: {formatNA(student.guardian_first_name)} {(student.guardian_middle_name)} {formatNA(student.guardian_last_name)}
              </div>
              <div className={styles.studentInfo}>
                Phone: {formatNA(student.guardian_phone_number)}
              </div>
              <div className={styles.studentInfo}>
                Email: {formatNA(student.guardian_email)}
              </div>
            </div>

            <div>
              <div className={styles.studentInfo}>
                <strong>Record Information</strong>
              </div>
              <div className={styles.studentInfo}>
                Added: {addedAt}
              </div>
              <div className={styles.studentInfo}>
                Last Updated: {updatedAt}
              </div>
              <div className={styles.studentInfo}>
                Last Updated By: {updatedByName}
                {student.updated_by && student.updated_by_user && (
                  <span style={{ color: '#666', fontSize: '0.9em', marginLeft: '8px' }}>
                    ({student.updated_by_user.username || student.updated_by_user.email})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    };

    const getTableInfoMessage = () => {
      const studentCount = sortedStudents.length;
      
      let message = '';
      
      if (selectedSection) {
        message = `Showing ${studentCount} student/s in Section ${selectedSection}`;
        
        if (currentClass === 'all') {
          message += ' across all grades';
        } else {
          message += ` in Grade ${currentClass}`;
        }
        
        if (searchTerm) {
          message += ` matching "${searchTerm}"`;
        }
      } else if (searchTerm) {
        message = `Found ${studentCount} student/s matching "${searchTerm}"`;
        
        if (currentClass === 'all') {
          message += ' across all grades';
        } else {
          message += ` in Grade ${currentClass}`;
        }
      } else {
        if (currentClass === 'all') {
          message = `Showing ${studentCount} student/s across all grades`;
        } else {
          message = `Showing ${studentCount} student/s in Grade ${currentClass}`;
        }
      }
      
      return message;
    };

    const getVisibleRowClassName = useMemo(() => {
      return ({ row }) => {
        return [
          styles.studentRow,
          editingStudent === row.id ? styles.editingRow : ''
        ].filter(Boolean).join(' ');
      };
    }, [editingStudent]);

    const withColumnWidth = (width, minWidth) => ({
      width,
      minWidth: `${minWidth}px`
    });

    const tableColumns = useMemo(() => [
      {
        key: 'select',
        label: '',
        headerStyle: withColumnWidth('5%', 40),
        cellStyle: withColumnWidth('5%', 40),
        renderHeader: () => (
          <div className={styles.icon} onClick={handleSelectAll}>
            <FontAwesomeIcon 
              icon={allVisibleSelected ? fasCircle : farCircle} 
              style={{ 
                cursor: 'pointer',
                color: allVisibleSelected ? '#0f6b58' : '' 
              }}
            />
          </div>
        ),
        renderCell: ({ row }) => {
          const isSelected = selectedStudents.includes(row.id);

          return (
            <div className={styles.icon} onClick={(e) => handleStudentSelect(row.id, e)}>
              <FontAwesomeIcon 
                icon={isSelected ? fasCircle : farCircle} 
                style={{ 
                  cursor: 'pointer', 
                  color: isSelected ? '#0f6b58' : '' 
                }}
              />
            </div>
          );
        }
      },
      {
        key: 'lrn',
        label: 'LRN',
        headerStyle: withColumnWidth('12%', 100),
        cellStyle: withColumnWidth('12%', 100),
        renderCell: ({ row }) => renderField(row, 'lrn')
      },
      {
        key: 'first_name',
        label: 'FIRST NAME',
        headerStyle: withColumnWidth('22%', 120),
        cellStyle: withColumnWidth('22%', 120),
        renderCell: ({ row }) => renderField(row, 'first_name')
      },
      {
        key: 'last_name',
        label: 'LAST NAME',
        headerStyle: withColumnWidth('15%', 120),
        cellStyle: withColumnWidth('15%', 120),
        renderCell: ({ row }) => renderField(row, 'last_name')
      },
      {
        key: 'grade',
        label: 'GRADE',
        headerStyle: withColumnWidth('10%', 80),
        cellStyle: withColumnWidth('10%', 80),
        renderCell: ({ row }) => renderField(row, 'grade')
      },
      {
        key: 'section',
        label: 'SECTION',
        headerStyle: withColumnWidth('12%', 110),
        cellStyle: withColumnWidth('12%', 110),
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
        renderCell: ({ row }) => renderField(row, 'section')
      },
      {
        key: 'qr_code',
        label: 'QR CODE',
        headerStyle: withColumnWidth('8%', 70),
        cellStyle: withColumnWidth('8%', 70),
        renderCell: ({ row }) => (
          <div className={styles.icon}>
            <FontAwesomeIcon 
              icon={faQrcode} 
              onClick={(e) => handleQRCodeClickWithEvent(row, e)} 
              className="action-button"
              style={{ cursor: 'pointer' }}
            />
          </div>
        )
      },
      {
        key: 'edit',
        label: 'EDIT',
        headerStyle: withColumnWidth('8%', 70),
        cellStyle: withColumnWidth('8%', 70),
        renderCell: ({ row }) => renderEditCell(row)
      },
      {
        key: 'delete',
        label: 'DELETE',
        headerStyle: withColumnWidth('8%', 70),
        cellStyle: withColumnWidth('8%', 70),
        renderCell: ({ row }) => (
          <div className={styles.icon}>
            <FontAwesomeIcon 
              icon={faTrashCan} 
              className="action-button"
              onClick={(e) => handleDeleteClickWithEvent(row, e)}
            />
          </div>
        )
      }
    ], [
      allVisibleSelected,
      selectedStudents,
      sectionsToShowInDropdown,
      selectedSection,
      renderField,
      renderEditCell
    ]);

    return (
      <>

        <Table
          columns={tableColumns}
          rows={sortedStudents}
          getRowId={(row) => row.id}
          loading={parentLoading || loading}
          error={error ? `Error: ${error}` : ''}
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
          infoText={computedInfoText}
          selectedInfoText=""
          headerContent={selectAllBanner}
          paginationContent={paginationContent}
          tableLabel="Students"
          onRowClick={({ rowId, event }) => handleRowClick(rowId, event)}
          isRowSelected={({ row }) => selectedStudents.includes(row.id)}
          rowClassName={getVisibleRowClassName}
          expandedRowId={expandedRow}
          renderExpandedRow={({ row }) => renderExpandedContent(row)}
          persistExpandedRows={true}
          hideMainRowWhenExpanded={true}
          getExpandedRowClassName={({ isExpanded }) => `${styles.expandRow} ${isExpanded ? styles.expandRowActive : ''}`}
          className={styles.studentTableContainer}
          wrapperClassName={styles.tableWrapper}
          isAllPagesSelected={isAllPagesSelected}
          visibleSelectedCount={visibleSelectedStudents.length}
          totalRowsOnPage={sortedStudents.length}
        />

        <QRCodeModal
          isOpen={qrModalOpen}
          onClose={() => setQrModalOpen(false)}
          student={selectedStudent}
        />

        <QRCodeUpdateWarningModal
          isOpen={updateWarningOpen}
          onClose={() => {
            setUpdateWarningOpen(false);
            setPendingUpdate(null);
          }}
          student={pendingUpdate?.student}
          onConfirm={handleConfirmUpdate}
        />
      </>
    );
  };

  export default StudentTable;