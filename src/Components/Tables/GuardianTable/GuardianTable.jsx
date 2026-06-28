import React, { useState, useEffect, useMemo } from 'react';
import { useEntityEdit } from '../../Hooks/useEntityEdit';
import { useRowExpansion } from '../../Hooks/useRowExpansion';
import { grades } from '../../../Utils/TableHelpers';
import { formatNA } from '../../../Utils/Formatters';
import SectionDropdown from '../../UI/Buttons/SectionDropdown/SectionDropdown';
import styles from './GuardianTable.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare } from "@fortawesome/free-solid-svg-icons";
import { supabase } from '../../../lib/supabase'; 
import Table from '../Table/Table.jsx';
import { useAuth } from '../../Authentication/AuthProvider/AuthProvider'; 

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
  currentPage = 1
}) => {
  const [guardians, setGuardians] = useState([]);
  const [currentClass, setCurrentClass] = useState(currentGrade);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const allUniqueSections = useMemo(() => {
    const sections = localGuardians
      .map(guardian => guardian.section || '')
      .filter(section => section && section !== 'N/A' && section.trim() !== '');

    const uniqueSections = [...new Set(sections)];
    return uniqueSections.sort();
  }, [localGuardians]);

  const currentGradeSections = useMemo(() => {
    if (currentClass === 'all') {
      return allUniqueSections;
    }

    const sections = localGuardians
      .filter(guardian => guardian.grade === currentClass)
      .map(guardian => guardian.section || '')
      .filter(section => section && section !== 'N/A' && section.trim() !== '');

    const uniqueSections = [...new Set(sections)];
    return uniqueSections.sort();
  }, [localGuardians, currentClass, allUniqueSections]);

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
    cancelEdit();

    if (selectedSection && onSectionSelect) {
      onSectionSelect('');
    }

    if (selectedSection && onClearSectionFilter) {
      onClearSectionFilter();
    }

    setTimeout(() => setLoading(false), 100);
  };

  const handleSectionFilter = (section) => {
    if (onSectionSelect) {
      onSectionSelect(section);
    }
  };

  const handleEditClick = (guardian, e) => {
    e.stopPropagation();
    startEdit(guardian);
    toggleRow(null);
  };

  const handleSaveEdit = async (guardianId, e) => {
    if (e) e.stopPropagation();

    const result = await saveEdit(
      guardianId, 
      currentClass, 
      async (id, data) => {
        const updateData = {
          guardian_first_name: data.first_name,
          guardian_middle_name: data.middle_name,
          guardian_last_name: data.last_name,
          guardian_email: data.email,
          guardian_phone_number: data.phone_number,
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('students')
          .update(updateData)
          .eq('id', id);

        if (error) throw error;
        return { success: true };
      }
    );

    if (result.success) {
    }
  };

  const handleRowClick = (guardianId, e) => {
    const isEditing = editingId === guardianId;
    const isInteractiveElement = e.target.closest('.edit-input') || 
                                 e.target.closest('.action-button') ||
                                 e.target.closest('button') ||
                                 e.target.closest('input');

    if (!isEditing && !isInteractiveElement) {
      toggleRow(guardianId);
    }
  };

  const renderEditField = (guardian, fieldName) => {
    if (editingId === guardian.id) {
      const error = validationErrors[fieldName];

      return (
        <div className={styles.editFieldContainer}>
          <input
            type={fieldName === 'email' ? 'email' : 'text'}
            name={fieldName}
            value={editFormData[fieldName] || ''}
            onChange={(e) => updateEditField(fieldName, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className={`${styles.editInput} ${error ? styles.errorInput : ''} edit-input`}
            placeholder={fieldName.replace('_', ' ')}
          />
          {error && <div className={styles.errorMessage}>{error}</div>}
        </div>
      );
    }
    return fieldName === 'email' || fieldName === 'phone_number'
      ? formatNA(guardian[fieldName])
      : guardian[fieldName] || '';
  };

  const renderActionButtons = (guardian) => {
    if (editingId === guardian.id) {
      return (
        <div className={`${styles.editActions} action-button`}>
          <button 
            onClick={(e) => handleSaveEdit(guardian.id, e)}
            disabled={saving}
            className={styles.saveBtn}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button 
            onClick={() => cancelEdit()}
            disabled={saving}
            className={styles.cancelBtn}
          >
            Cancel
          </button>
        </div>
      );
    }
    return (
      <div className={styles.icon} onClick={(e) => handleEditClick(guardian, e)}>
        <FontAwesomeIcon icon={faPenToSquare} className="action-button" />
      </div>
    );
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
        {/* Close button - collapses the expanded row */}
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
          {/* Guardian Details Section */}
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

          {/* Children/Student Details Section */}
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

          {/* Record Information Section */}
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

  const renderEditCell = (guardian) => (
    <div className={styles.editCell}>
      {editingId === guardian.id ? (
        renderActionButtons(guardian)
      ) : (
        <div className={styles.icon}>
          <FontAwesomeIcon 
            icon={faPenToSquare} 
            onClick={(e) => handleEditClick(guardian, e)}
            className="action-button"
          />
        </div>
      )}
    </div>
  );

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
        message = `Showing ${guardianCount} guardian/s in Grade ${currentClass}`;
      }
    }

    return message;
  };

  const getVisibleRowClassName = useMemo(() => {
    return ({ row }) => {
      return [
        styles.guardianRow,
        editingId === row.id ? styles.editingRow : ''
      ].filter(Boolean).join(' ');
    };
  }, [editingId]);

  const withColumnWidth = (width, minWidth) => ({
    width,
    minWidth: `${minWidth}px`
  });

  const tableColumns = useMemo(() => [
    {
      key: 'first_name',
      label: 'FIRST NAME',
      headerStyle: withColumnWidth('15%', 120),
      cellStyle: withColumnWidth('15%', 120),
      renderCell: ({ row }) => renderEditField(row, 'first_name')
    },
    {
      key: 'last_name',
      label: 'LAST NAME',
      headerStyle: withColumnWidth('15%', 120),
      cellStyle: withColumnWidth('15%', 120),
      renderCell: ({ row }) => renderEditField(row, 'last_name')
    },
    {
      key: 'guardian_of',
      label: 'GUARDIAN OF',
      headerStyle: withColumnWidth('25%', 150),
      cellStyle: withColumnWidth('25%', 150),
      renderCell: ({ row }) => row.guardian_of
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
      key: 'phone_number',
      label: 'PHONE NO.',
      headerStyle: withColumnWidth('15%', 120),
      cellStyle: withColumnWidth('15%', 120),
      renderCell: ({ row }) => renderEditField(row, 'phone_number')
    },
    {
      key: 'edit',
      label: 'EDIT',
      headerStyle: withColumnWidth('10%', 80),
      cellStyle: withColumnWidth('10%', 80),
      renderCell: ({ row }) => renderEditCell(row)
    }
  ], [sectionsToShowInDropdown, selectedSection, renderEditCell, renderEditField]);

  return (
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
  );
};

export default GuardianTable;