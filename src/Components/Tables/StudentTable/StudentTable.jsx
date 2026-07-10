import React, { useMemo, useState, useEffect, useRef } from 'react';
import { grades, shouldHandleRowClick } from '../../../Utils/TableHelpers';
import { formatStudentName, formatNA } from '../../../Utils/Formatters';
import { compareSections } from '../../../Utils/CompareHelpers';
import { getProfileColor, getProfileInitial } from '../../../Utils/ProfileHelpers';
import SectionDropdown from '../../UI/Buttons/SectionDropdown/SectionDropdown';
import QRCodeModal from '../../Modals/QRCodeModal/QRCodeModal';
import QRCodeUpdateWarningModal from '../../Modals/QRCodeUpdateWarningModal/QRCodeUpdateWarningModal';
import EditEntityFormModal from '../../Modals/EditEntityFormModal/EditEntityFormModal.jsx';
import EditStudentForm from '../../Forms/EditStudentForm/EditStudentForm.jsx';
import styles from './StudentTable.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQrcode, faPenToSquare, faTrashCan, faPlus } from "@fortawesome/free-solid-svg-icons";
import { useToast } from '../../Toast/ToastContext/ToastContext';
import { useAuth } from '../../Authentication/AuthProvider/AuthProvider'; 
import { useEntityEdit } from '../../Hooks/useEntityEdit'; 
import { useRowExpansion } from '../../Hooks/useRowExpansion'; 
import { useStudentActions } from '../../Hooks/useEntityActions'; 
import { StudentService } from '../../../Utils/EntityService'; 
import Table from '../Table/Table.jsx';
import ActionsMenu from '../../UI/Menus/ActionsMenu/ActionsMenu';

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
const renderProfileCircle = (student, sizeClassName) => {
  const { bg, text } = getProfileColor(student.id ?? `${student.first_name}${student.last_name}`);

  if (student.photo_url) {
    return (
      <img
        src={student.photo_url}
        alt={formatStudentName(student)}
        className={sizeClassName}
        style={{ objectFit: 'cover' }}
      />
    );
  }

  return (
    <div className={sizeClassName} style={{ backgroundColor: bg, color: text }}>
      {getProfileInitial(student.first_name)}
    </div>
  );
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
  onFilteredCountChange,
  selectedStudents = [],
}) => {
    
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentClass, setCurrentClass] = useState('all');
  
  // ===== MODAL STATE MACHINE =====
  // 'closed' | 'editing' | 'confirming'
  const [editModalState, setEditModalState] = useState('closed');
  const [editingEntity, setEditingEntity] = useState(null);
  const [pendingCriticalUpdate, setPendingCriticalUpdate] = useState(null);
  const [saveError, setSaveError] = useState('');
  
  // NEW: ref to track the latest modal state for deferred cleanup
  const editModalStateRef = useRef(editModalState);
  useEffect(() => {
    editModalStateRef.current = editModalState;
  }, [editModalState]);
  
  // NEW: ref-based reentry guard for confirmation flow
  const confirmingRef = useRef(false);
  
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

  // ===== DEFINE sortedStudents BEFORE the useEffect that uses it =====
  const sortedStudents = students;

  useEffect(() => {
    if (onFilteredCountChange) {
      onFilteredCountChange(sortedStudents.length);
    }
  }, [sortedStudents.length, onFilteredCountChange]);

  // ===== SNAPSHOT-BASED BANNER PERSISTENCE (Cleaner version) =====
  const [fullySelectedSnapshots, setFullySelectedSnapshots] = useState(new Map());

  // Effect 1: capture a snapshot whenever the CURRENT page becomes fully selected.
  useEffect(() => {
    const allVisibleSelectedNow = sortedStudents.length > 0 &&
      sortedStudents.every(student => selectedStudents.includes(student.id));

    if (!allVisibleSelectedNow) return;

    const currentIds = sortedStudents.map(s => s.id);

    setFullySelectedSnapshots(prev => {
      const existing = prev.get(currentPage);
      const isSame = existing &&
        existing.length === currentIds.length &&
        existing.every((id, i) => id === currentIds[i]);

      if (isSame) return prev; // no-op, skip re-render

      const next = new Map(prev);
      next.set(currentPage, currentIds);
      return next;
    });
  }, [sortedStudents, selectedStudents, currentPage]);

  // Effect 2: prune any snapshot that's no longer fully selected.
  useEffect(() => {
    const selectedSet = new Set(selectedStudents);

    setFullySelectedSnapshots(prev => {
      let changed = false;
      const next = new Map();

      for (const [page, ids] of prev.entries()) {
        const stillFull = ids.length > 0 && ids.every(id => selectedSet.has(id));
        if (stillFull) {
          next.set(page, ids);
        } else {
          changed = true;
        }
      }

      return changed ? next : prev; // no-op if nothing needed pruning
    });
  }, [selectedStudents]);

  // Pure derived value: is any page's snapshot still fully intact?
  const hasTriggeredSelectAll = useMemo(() => {
    return fullySelectedSnapshots.size > 0;
  }, [fullySelectedSnapshots]);

  // ===== END SNAPSHOT LOGIC =====

  const handleClassChange = (className) => {
    setCurrentClass(className);
    toggleRow(null); 
    cancelEdit(); 
    if (onSelectedStudentsUpdate) onSelectedStudentsUpdate([]);
    if (onClearAllPages) onClearAllPages();
    
    // Clear snapshots when changing grade
    setFullySelectedSnapshots(new Map());
    
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

  // ===== UPDATED: Open modal instead of inline edit =====
  const handleEditClick = (student, e) => {
    e.stopPropagation();
    
    console.log('✏️ Opening edit modal for student:', {
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
    setEditingEntity(student);
    setEditModalState('editing');
    setSaveError('');
    toggleRow(null);
  };

  // ===== UPDATED: CLOSE MODAL =====
  const handleCloseModal = () => {
    setEditModalState('closed');
    setSaveError('');
    // editingEntity and form data are cleared in handleModalExited
    // after the exit animation finishes
  };

  // ===== NEW: Fires only when the edit modal has fully finished animating out =====
  const handleModalExited = () => {
    // Skip if we transitioned into the confirmation modal instead of
    // fully closing — that flow still needs editFormData intact.
    if (editModalStateRef.current !== 'closed') return;
    setEditingEntity(null);
    cancelEdit();
  };

  // ===== HANDLE SAVE FROM MODAL =====
  const handleEditFormSave = () => {
    const student = editingEntity;
    if (!student) return;
    
    setSaveError('');
    
    // Validate required fields
    if (!editFormData.grade || !editFormData.section) {
      setSaveError('Please select both grade and section');
      return;
    }

    // Only check for LRN changes - QR code is tied to LRN
    const lrnChanged = editFormData.lrn !== student.lrn;

    if (lrnChanged) {
      // Swap to the warning modal instead of stacking it on top
      setPendingCriticalUpdate({ studentId: student.id, student });
      setEditModalState('confirming');
    } else {
      performStudentUpdate(student.id);
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
        // Close everything on success
        setEditModalState('closed');
        setEditingEntity(null);
        setPendingCriticalUpdate(null);
        cancelEdit(); // clear form data now that the modal is fully gone
      }
      
    } catch (error) {
      console.error('Update error:', error);
      setSaveError(error.message || 'Failed to update student');
      // Stay in editing state so user can fix and retry
      setEditModalState('editing');
      throw error;
    }
  };

  // ===== HANDLE CONFIRM CRITICAL UPDATE =====
  const handleConfirmCriticalUpdate = async () => {
    // Guard against double-clicks using the ref
    if (!pendingCriticalUpdate || confirmingRef.current) return;
    
    confirmingRef.current = true;
    
    try {
      await performStudentUpdate(pendingCriticalUpdate.studentId);
      // performStudentUpdate handles closing on success
    } catch (error) {
      // Error handled in performStudentUpdate, which sets state back to 'editing'
      // Just clear pending state
      setPendingCriticalUpdate(null);
    } finally {
      confirmingRef.current = false;
    }
  };

  // ===== HANDLE CANCEL CRITICAL UPDATE =====
  const handleCancelCriticalUpdate = () => {
    setPendingCriticalUpdate(null);
    setEditModalState('editing'); // Go BACK to the edit form, not fully closed
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
    
    if (isAllPagesSelected && selectedStudents.includes(studentId)) {
      if (onClearAllPages) onClearAllPages();
      return;
    }
    
    const newSelected = selectedStudents.includes(studentId)
      ? selectedStudents.filter(id => id !== studentId)
      : [...selectedStudents, studentId];
    
    if (onSelectedStudentsUpdate) onSelectedStudentsUpdate(newSelected);
  };

  const handleSelectAll = () => {
    const allVisibleStudentIds = sortedStudents.map(student => student.id);
    const allSelected = allVisibleStudentIds.every(id => selectedStudents.includes(id));
    
    if (allSelected) {
      const newSelected = selectedStudents.filter(id => !allVisibleStudentIds.includes(id));
      if (onSelectedStudentsUpdate) onSelectedStudentsUpdate(newSelected);
      if (newSelected.length === 0 && onClearAllPages) onClearAllPages();
    } else {
      const newSelected = [...new Set([...selectedStudents, ...allVisibleStudentIds])];
      if (onSelectedStudentsUpdate) onSelectedStudentsUpdate(newSelected);
    }
  };

  const allVisibleSelected = sortedStudents.length > 0 && 
    sortedStudents.every(student => selectedStudents.includes(student.id));

  const computedInfoText = (() => {
    if (selectedStudents.length === totalStudentCount && totalStudentCount > 0) 
      return `All ${totalStudentCount} students selected`;
    if (selectedStudents.length > 0) return `${selectedStudents.length} student/s selected`;
    return '';
  })();

  // ===== UPDATED: selectAllBanner with snapshot-based logic =====
  const selectAllBanner = (() => {
    // Check if any page has been fully selected (using snapshots)
    const hasAnyPageFullySelected = hasTriggeredSelectAll;
    
    const allPagesSelected = selectedStudents.length === totalStudentCount && totalStudentCount > 0;
    const hasMorePages = totalStudentCount > sortedStudents.length;

    // If all pages are already selected, show "Clear all"
    if (allPagesSelected && hasMorePages) {
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

    // Show "Select all" if ANY page has been fully selected AND there are more pages
    if (hasAnyPageFullySelected && hasMorePages && !allPagesSelected) {
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

  // ===== REMOVED: inline edit render functions (now using modal) =====
  // renderEditInput, renderGuardianEditInput, renderGradeDropdown, 
  // renderSectionDropdown, renderField, renderActionButtons are no longer needed

  // ===== UPDATED: renderField now only shows display values =====
  const renderField = (student, fieldName) => {
    if (fieldName === 'email' || fieldName === 'phone_number') {
      return '';
    }
    
    if (fieldName.startsWith('guardian_')) {
      return formatNA(student[fieldName]);
    }
    
    return student[fieldName] || '';
  };

  // ===== RENDER EXPANDED CONTENT =====
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
          {renderProfileCircle(student, styles.profileLarge)}

          <div className={styles.cardBody}>
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
        // No more editingRow class since we use modal
      ].filter(Boolean).join(' ');
    };
  }, []);

  const withColumnWidth = (width, minWidth) => ({
    width,
    minWidth: `${minWidth}px`
  });

  // ===== TABLE COLUMNS - SELECT COLUMN IS FIRST =====
  const tableColumns = useMemo(() => [
    {
      key: 'select',
      label: '',
      headerStyle: withColumnWidth('5%', 40),
      cellStyle: withColumnWidth('5%', 40),
      renderHeader: () => (
        <div className={styles.checkboxWrapper}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={allVisibleSelected}
            onChange={handleSelectAll}
          />
        </div>
      ),
      renderCell: ({ row }) => {
        const isSelected = selectedStudents.includes(row.id);

        return (
          <div className={styles.checkboxWrapper}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={isSelected}
              onChange={(e) => handleStudentSelect(row.id, e)}
            />
          </div>
        );
      }
    },
    {
      key: 'profile',
      label: 'PROFILE',
      headerStyle: withColumnWidth('5%', 56),
      cellStyle: withColumnWidth('5%', 56),
      renderCell: ({ row }) => (
        <div className={styles.profileCellWrapper}>
          {renderProfileCircle(row, styles.profileSmall)}
        </div>
      )
    },
    {
      key: 'lrn',
      label: 'LRN',
      headerStyle: withColumnWidth('20%', 100),
      cellStyle: withColumnWidth('20%', 100),
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
      key: 'actions',
      label: 'ACTIONS',
      headerStyle: withColumnWidth('8%', 70),
      cellStyle: withColumnWidth('8%', 70),
      renderCell: ({ row }) => {
        return (
          <ActionsMenu
            actions={[
              { 
                label: 'QR Code', 
                icon: faQrcode, 
                onClick: (e) => handleQRCodeClickWithEvent(row, e) 
              },
              { 
                label: 'Edit', 
                icon: faPenToSquare, 
                onClick: (e) => handleEditClick(row, e) 
              },
              { 
                label: 'Delete', 
                icon: faTrashCan, 
                onClick: (e) => handleDeleteClickWithEvent(row, e), 
                variant: 'danger' 
              },
            ]}
          />
        );
      }
    }
  ], [
    allVisibleSelected,
    selectedStudents,
    sectionsToShowInDropdown,
    selectedSection,
    renderField,
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
        visibleSelectedCount={selectedStudents.length}
        totalRowsOnPage={sortedStudents.length}
      />

      <EditEntityFormModal
        isOpen={editModalState === 'editing'}
        onClose={handleCloseModal}
        onExited={handleModalExited}
        title="Edit Student"
        onSave={handleEditFormSave}
        saving={saving}
        saveDisabled={!editFormData.grade || !editFormData.section}
        errorMessage={saveError}
      >
        <EditStudentForm
          student={editingEntity}
          formData={editFormData}
          onFieldChange={updateEditField}
          validationErrors={validationErrors}
          gradeSectionsMap={gradeSectionsMap}
          disabled={saving}
        />
      </EditEntityFormModal>

      {/* ===== WARNING MODAL - only open when in 'confirming' state ===== */}
      <QRCodeUpdateWarningModal
        isOpen={editModalState === 'confirming'}
        onClose={handleCancelCriticalUpdate}
        student={pendingCriticalUpdate?.student}
        onConfirm={handleConfirmCriticalUpdate}
        saving={saving}
      />

      {/* ===== QR CODE MODAL ===== */}
      <QRCodeModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        student={selectedStudent}
      />

    </>
  );
};

export default StudentTable;