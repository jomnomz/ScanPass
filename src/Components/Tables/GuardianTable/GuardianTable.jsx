import React, { useState, useEffect, useMemo } from 'react';
import { useEntityEdit } from '../../Hooks/useEntityEdit';
import { useRowExpansion } from '../../Hooks/useRowExpansion';
import { grades } from '../../../Utils/TableHelpers';
import { formatNA } from '../../../Utils/Formatters';
import { compareSections } from '../../../Utils/CompareHelpers';
import SectionDropdown from '../../UI/Buttons/SectionDropdown/SectionDropdown';
import EditEntityFormModal from '../../Modals/EditEntityFormModal/EditEntityFormModal.jsx';
import EditGuardianForm from '../../Forms/EditGuardianForm/EditGuardianForm.jsx';
import styles from './GuardianTable.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare, faEnvelope, faPhone } from "@fortawesome/free-solid-svg-icons";
import { supabase } from '../../../lib/supabase';
import Table from '../Table/Table.jsx';
import { useAuth } from '../../Authentication/AuthProvider/AuthProvider';
import { useToast } from '../../Toast/ToastContext/ToastContext';

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

const GuardianTable = ({
  searchTerm = '',
  selectedSection = '',
  onSectionsUpdate,
  onGradeUpdate,
  onClearSectionFilter,
  onSectionSelect,
  availableSections = [],
  guardians: propGuardians = [],
  loading: parentLoading = false,
  currentGrade = 'all',
  paginationContent = null,
  totalGuardianCount = 0,
  currentPage = 1,
  gradesData = [],
  sectionsData = []
}) => {
  const [guardians, setGuardians] = useState([]);
  const [currentClass, setCurrentClass] = useState(currentGrade);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ===== MODAL STATE MACHINE =====
  // 'closed' | 'editing'
  const [editModalState, setEditModalState] = useState('closed');
  const [editingEntity, setEditingEntity] = useState(null);
  const [saveError, setSaveError] = useState('');

  const { expandedRow, tableRef, toggleRow, isRowExpanded } = useRowExpansion();
  const {
    editingId,
    editFormData,
    saving,
    validationErrors,
    startEdit,
    cancelEdit,
    updateEditField,
    saveEdit
  } = useEntityEdit(guardians, setGuardians, 'guardian');
  const [localGuardians, setLocalGuardians] = useState([]);

  const { user, profile } = useAuth();
  const { success } = useToast();
  
  // ===== BUILD GRADE-SECTIONS MAP (same as StudentTable) =====
  const [gradeSectionsMap, setGradeSectionsMap] = useState({});

  useEffect(() => {
    if (sectionsData.length > 0 && gradesData.length > 0) {
      console.log('📋 Building grade-sections map for guardians from props...');
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
      
      console.log('📋 Grade-sections map for guardians:', map);
      setGradeSectionsMap(map);
    }
  }, [gradesData, sectionsData]);

  useEffect(() => {
    setCurrentClass(currentGrade);
  }, [currentGrade]);

  useEffect(() => {
    if (propGuardians && propGuardians.length > 0) {
      console.log('📊 Initializing guardians from parent:', propGuardians.length);
      setGuardians(propGuardians);
      setLoading(false);
    } else if (!parentLoading) {
      setGuardians([]);
      setLoading(false);
    }
  }, [propGuardians, parentLoading]);

  useEffect(() => {
    if (propGuardians && propGuardians.length >= 0) {
      setGuardians(propGuardians);
    }
  }, [propGuardians]);

  useEffect(() => {
    const subscription = supabase
      .channel('guardians-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'students'
        },
        () => {
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (guardians && guardians.length > 0) {
      setLocalGuardians(guardians);
    } else {
      setLocalGuardians([]);
    }
  }, [guardians]);

  useEffect(() => {
    if (onGradeUpdate) {
      onGradeUpdate(currentClass);
    }
  }, [currentClass, onGradeUpdate]);

  // ===== FIXED: Section dropdown now uses gradeSectionsMap (unpaginated reference data) =====
  // Full, unpaginated section list — derived from gradeSectionsMap, which is
  // itself built from gradesData/sectionsData (unpaginated reference tables),
  // not from the paginated `guardians` array. This ensures the dropdown always
  // shows every section for a grade, regardless of which page of guardians is
  // currently loaded.
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

  // No re-filtering or re-sorting needed — parent already handled it
  const sortedGuardians = localGuardians;

  useEffect(() => {
    if (onSectionsUpdate) {
      onSectionsUpdate(allUniqueSections);
    }
  }, [allUniqueSections, onSectionsUpdate]);

  const handleClassChange = (className) => {
    setCurrentClass(className);
    setLoading(true);
    toggleRow(null);
    handleCloseModal();

    // ===== FIXED: Only clear section if it's no longer valid =====
    // This matches AttendanceTable's behavior
    if (selectedSection && onSectionSelect) {
      // Check if section is still valid for the new grade
      const sectionsForNewGrade = gradeSectionsMap[className] || [];
      const isValidSection = sectionsForNewGrade.includes(selectedSection);
      
      if (!isValidSection) {
        onSectionSelect('');
        if (onClearSectionFilter) {
          onClearSectionFilter();
        }
      }
    }

    setTimeout(() => setLoading(false), 100);
  };

  const handleSectionFilter = (section) => {
    if (onSectionSelect) {
      onSectionSelect(section);
    }
  };

  // ===== OPEN MODAL instead of inline edit =====
  const handleEditClick = (guardian, e) => {
    e.stopPropagation();
    startEdit(guardian);
    setEditingEntity(guardian);
    setEditModalState('editing');
    setSaveError('');
    toggleRow(null);
  };

  // ===== CLOSE MODAL =====
  const handleCloseModal = () => {
    setEditModalState('closed');
    setEditingEntity(null);
    cancelEdit();
    setSaveError('');
  };

  // ===== FIXED: SAVE FROM MODAL =====
  const handleEditFormSave = async () => {
    const guardian = editingEntity;
    if (!guardian) return;

    setSaveError('');

    if (!editFormData.first_name?.trim() || !editFormData.last_name?.trim()) {
      setSaveError('First name and last name are required');
      return;
    }

    try {
      // Prepare the update data
      const updateData = {
        guardian_first_name: editFormData.first_name,
        guardian_middle_name: editFormData.middle_name || '',
        guardian_last_name: editFormData.last_name,
        guardian_email: editFormData.email || '',
        guardian_phone_number: editFormData.phone_number || '',
        updated_at: new Date().toISOString(),
        updated_by: user?.id
      };

      // Update in database
      const { data, error } = await supabase
        .from('students')
        .update(updateData)
        .eq('id', guardian.id)
        .select('*');

      if (error) throw error;

      // Get the updated record with all fields
      const updatedGuardian = data[0];

      // Format the updated guardian for the local state
      const formattedGuardian = {
        ...updatedGuardian,
        // Map the guardian fields back to what the table expects
        first_name: updatedGuardian.guardian_first_name,
        middle_name: updatedGuardian.guardian_middle_name,
        last_name: updatedGuardian.guardian_last_name,
        email: updatedGuardian.guardian_email,
        phone_number: updatedGuardian.guardian_phone_number,
        // Keep student info
        guardian_of: updatedGuardian.guardian_of || `${updatedGuardian.first_name} ${updatedGuardian.last_name}`,
        student_lrn: updatedGuardian.lrn,
        grade: updatedGuardian.grade,
        section: updatedGuardian.section
      };

      // Update local state with the formatted guardian
      setGuardians(prevGuardians => {
        return prevGuardians.map(g => 
          g.id === guardian.id ? formattedGuardian : g
        );
      });

      // Update localGuardians as well to keep sync
      setLocalGuardians(prev => {
        return prev.map(g => 
          g.id === guardian.id ? formattedGuardian : g
        );
      });

      success('Guardian updated successfully');
      setEditModalState('closed');
      setEditingEntity(null);
      cancelEdit();

    } catch (error) {
      console.error('Update error:', error);
      setSaveError(error.message || 'Failed to update guardian');
    }
  };

  const handleRowClick = (guardianId, e) => {
    const isInteractiveElement = e.target.closest('.action-button') ||
                                 e.target.closest('button') ||
                                 e.target.closest('input');

    if (!isInteractiveElement) {
      toggleRow(guardianId);
    }
  };

  const renderExpandedContent = (guardian) => {
    const addedAt = formatDateTimeLocal(guardian.created_at);
    const updatedAt = guardian.updated_at ? formatDateTimeLocal(guardian.updated_at) : 'Never updated';

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

    const updatedByName = guardian.updated_by
      ? (guardian.updated_by_user
          ? `${guardian.updated_by_user.first_name || ''} ${guardian.updated_by_user.last_name || ''}`.trim() ||
            guardian.updated_by_user.username ||
            guardian.updated_by_user.email ||
            'User'
          : (currentUserId && guardian.updated_by === currentUserId ? currentUserName : 'User')
        )
      : 'Not yet updated';

    return (
      <div
        className={`${styles.guardianCard} ${styles.expandableCard}`}
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

        <div className={styles.guardianHeader}>
          {guardian.first_name} {guardian.middle_name} {guardian.last_name}
        </div>

        <div className={styles.details}>
          <div>
            <div className={styles.guardianInfo}>
              <strong>Guardian Details</strong>
            </div>
            <div className={styles.guardianInfo}>
              Full Name: {guardian.first_name} {guardian.middle_name || ''} {guardian.last_name}
            </div>
            <div className={styles.guardianInfo}>
              Email: {formatNA(guardian.email)}
            </div>
            <div className={styles.guardianInfo}>
              Phone: {formatNA(guardian.phone_number)}
            </div>
          </div>

          <div>
            <div className={styles.guardianInfo}>
              <strong>Children/Student Details</strong>
            </div>
            <div className={styles.guardianInfo}>
              Full Name: {guardian.guardian_of || 'N/A'}
            </div>
            <div className={styles.guardianInfo}>
              Student LRN: {guardian.student_lrn || 'N/A'}
            </div>
            <div className={styles.guardianInfo}>
              Grade and Section: {guardian.grade} - {guardian.section}
            </div>
          </div>

          <div>
            <div className={styles.guardianInfo}>
              <strong>Record Information</strong>
            </div>
            <div className={styles.guardianInfo}>
              Added: {addedAt}
            </div>
            <div className={styles.guardianInfo}>
              Last Updated: {updatedAt}
            </div>
            <div className={styles.guardianInfo}>
              Last Updated By: {updatedByName}
              {guardian.updated_by && guardian.updated_by_user && (
                <span style={{ color: '#666', fontSize: '0.9em', marginLeft: '8px' }}>
                  ({guardian.updated_by_user.username || guardian.updated_by_user.email})
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getTableInfoMessage = () => {
    const guardianCount = sortedGuardians.length;

    let message = '';

    if (selectedSection) {
      message = `Showing ${guardianCount} guardian/s in Section ${selectedSection}`;

      if (currentClass === 'all') {
        message += ' across all grades';
      } else {
        message += ` in Grade ${currentClass}`;
      }

      if (searchTerm) {
        message += ` matching "${searchTerm}"`;
      }
    } else if (searchTerm) {
      message = `Found ${guardianCount} guardian/s matching "${searchTerm}"`;

      if (currentClass === 'all') {
        message += ' across all grades';
      } else {
        message += ` in Grade ${currentClass}`;
      }
    } else {
      if (currentClass === 'all') {
        message = `Showing ${guardianCount} guardian/s across all grades`;
      } else {
        message += `Showing ${guardianCount} guardian/s in Grade ${currentClass}`;
      }
    }

    return message;
  };

  const getVisibleRowClassName = useMemo(() => {
    return ({ row }) => {
      return [
        styles.guardianRow,
      ].filter(Boolean).join(' ');
    };
  }, []);

  const withColumnWidth = (width, minWidth) => ({
    width,
    minWidth: `${minWidth}px`
  });

  // ===== UPDATED TABLE COLUMNS: Replaced first_name, last_name, phone_number with guardian + contact =====
  const tableColumns = useMemo(() => [
    {
      key: 'guardian',
      label: 'GUARDIAN',
      headerStyle: withColumnWidth('20%', 200), textAlign: 'left' ,
      cellStyle: withColumnWidth('20%', 200), textAlign: 'left' ,
      renderCell: ({ row }) => (
        <div className={styles.guardianCellText}>
          <div className={styles.guardianCellName}>
            {row.first_name} {row.last_name}
          </div>
          <div className={styles.guardianCellOf}>
            Guardian of: {row.guardian_of || 'N/A'}
          </div>
        </div>
      )
    },
    {
      key: 'contact',
      label: 'CONTACT',
      headerStyle: { ...withColumnWidth('30%', 160), textAlign: 'left' },
      cellStyle: { ...withColumnWidth('30%', 160), textAlign: 'left' },
      renderCell: ({ row }) => (
        <div className={styles.contactCell}>
          <div className={styles.contactRow}>
            <FontAwesomeIcon icon={faEnvelope} className={styles.contactIcon} />
            <span className={styles.contactText}>{formatNA(row.email)}</span>
          </div>
          <div className={styles.contactRow}>
            <FontAwesomeIcon icon={faPhone} className={styles.contactIcon} />
            <span className={styles.contactText}>{formatNA(row.phone_number)}</span>
          </div>
        </div>
      )
    },
    {
      key: 'grade',
      label: 'GRADE',
      headerStyle: withColumnWidth('10%', 80),
      cellStyle: withColumnWidth('10%', 80),
      renderCell: ({ row }) => row.grade
    },
    {
      key: 'section',
      label: 'SECTION',
      headerStyle: withColumnWidth('15%', 100),
      cellStyle: withColumnWidth('15%', 100),
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
      key: 'edit',
      label: 'EDIT',
      headerStyle: { ...withColumnWidth('8%', 70),  },
      cellStyle: { ...withColumnWidth('8%', 70),  },
      renderCell: ({ row }) => (
        <div className={styles.icon}>
          <FontAwesomeIcon
            icon={faPenToSquare}
            onClick={(e) => handleEditClick(row, e)}
            className="action-button"
          />
        </div>
      )
    }
  ], [sectionsToShowInDropdown, selectedSection]);

  return (
    <>
      <Table
        columns={tableColumns}
        rows={sortedGuardians}
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
        infoText=""
        selectedInfoText=""
        paginationContent={paginationContent}
        tableLabel="Guardians"
        onRowClick={({ rowId, event }) => handleRowClick(rowId, event)}
        rowClassName={getVisibleRowClassName}
        expandedRowId={expandedRow}
        renderExpandedRow={({ row }) => renderExpandedContent(row)}
        persistExpandedRows={true}
        hideMainRowWhenExpanded={true}
        getExpandedRowClassName={({ isExpanded }) => `${styles.expandRow} ${isExpanded ? styles.expandRowActive : ''}`}
        className={styles.guardianTableContainer}
        wrapperClassName={styles.tableWrapper}
        isAllPagesSelected={false}
        visibleSelectedCount={0}
        totalRowsOnPage={sortedGuardians.length}
        currentPage={currentPage}
      />

      <EditEntityFormModal
        isOpen={editModalState === 'editing'}
        onClose={handleCloseModal}
        title="Edit Guardian"
        onSave={handleEditFormSave}
        saving={saving}
        errorMessage={saveError}
        height="350px"
      >
        <EditGuardianForm
          guardian={editingEntity}
          formData={editFormData}
          onFieldChange={updateEditField}
          validationErrors={validationErrors}
          disabled={saving}
        />
      </EditEntityFormModal>
    </>
  );
};

export default GuardianTable;