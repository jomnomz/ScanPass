import React, { useState, useEffect, useMemo } from 'react';
import styles from './SubjectTable.module.css';
import { EntityService } from '../../../Utils/EntityService';
import { useRowExpansion } from '../../Hooks/useRowExpansion'; 
import { useEntityEdit } from '../../Hooks/useEntityEdit'; 
import DeleteEntityModal from '../../Modals/DeleteEntityModal/DeleteEntityModal';
import { useToast } from '../../Toast/ToastContext/ToastContext';
import { supabase } from '../../../lib/supabase';
import Table from '../Table/Table';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare, faTrashCan, faPlus } from "@fortawesome/free-solid-svg-icons";
import ActionsMenu from '../../UI/Menus/ActionsMenu/ActionsMenu';
import Button from '../../UI/Buttons/Button/Button.jsx';

// Date formatter function
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

const SubjectTable = ({ 
  searchTerm = '',
  subjects: propSubjects = [], // ← paginated from parent
  totalFilteredCount = 0,
  onSelectedSubjectsUpdate,
  selectedSubjects = [],
  onSingleDeleteClick,
  onEntityDataUpdate,
  isAllPagesSelected = false,
  onSelectAllPages,
  onClearAllPages,
  currentPage = 1,
}) => {
  const [allSubjects, setAllSubjects] = useState([]); // full dataset for export
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { expandedRow, toggleRow, isRowExpanded, tableRef } = useRowExpansion();
  const { success, error: toastError } = useToast();
  
  const subjectService = new EntityService('subjects');

  // Fetch function for subjects
  const fetchSubjects = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .order('subject_name');
      
      if (error) throw error;
      
      setAllSubjects(data || []);
      if (onEntityDataUpdate) onEntityDataUpdate(data || []);
      
    } catch (err) {
      console.error('Error fetching subjects:', err);
      setError(err.message);
      setAllSubjects([]);
    } finally {
      setLoading(false);
    }
  };

  // Entity edit hook
  const {
    editingId,
    editFormData,
    saving,
    validationErrors,
    startEdit,
    cancelEdit,
    updateEditField,
    saveEdit
  } = useEntityEdit(allSubjects, setAllSubjects, 'subject', fetchSubjects);

  // Initial fetch and real-time subscription
  useEffect(() => {
    fetchSubjects();
    
    const subscription = supabase
      .channel('subjects-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subjects'
        },
        () => {
          fetchSubjects();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Use propSubjects for display (already paginated+filtered by parent)
  const displaySubjects = propSubjects;

  // ===== SNAPSHOT-BASED BANNER PERSISTENCE (same pattern as GradeSectionTable) =====
  const [fullySelectedSnapshots, setFullySelectedSnapshots] = useState(new Map());

  useEffect(() => {
    const allVisibleSelectedNow = displaySubjects.length > 0 &&
      displaySubjects.every(subject => selectedSubjects.includes(subject.id));

    if (!allVisibleSelectedNow) return;

    const currentIds = displaySubjects.map(s => s.id);

    setFullySelectedSnapshots(prev => {
      const existing = prev.get(currentPage);
      const isSame = existing &&
        existing.length === currentIds.length &&
        existing.every((id, i) => id === currentIds[i]);

      if (isSame) return prev;

      const next = new Map(prev);
      next.set(currentPage, currentIds);
      return next;
    });
  }, [displaySubjects, selectedSubjects, currentPage]);

  useEffect(() => {
    const selectedSet = new Set(selectedSubjects);

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

      return changed ? next : prev;
    });
  }, [selectedSubjects]);

  const hasTriggeredSelectAll = useMemo(() => {
    return fullySelectedSnapshots.size > 0;
  }, [fullySelectedSnapshots]);

  useEffect(() => {
    setFullySelectedSnapshots(new Map());
  }, [searchTerm]);

  // ===== END SNAPSHOT LOGIC =====

  // Handle individual subject selection
  const handleSubjectSelect = (subjectId, e) => {
    e.stopPropagation();
    
    // If all pages are selected and we're unselecting one, clear the "all" state
    if (isAllPagesSelected && selectedSubjects.includes(subjectId)) {
      if (onClearAllPages) onClearAllPages();
      return;
    }
    
    const newSelected = selectedSubjects.includes(subjectId)
      ? selectedSubjects.filter(id => id !== subjectId)
      : [...selectedSubjects, subjectId];
    
    if (onSelectedSubjectsUpdate) {
      onSelectedSubjectsUpdate(newSelected);
    }
  };

  // Handle select all on current page
  const handleSelectAll = () => {
    const allVisibleIds = displaySubjects.map(subject => subject.id);
    const allSelected = allVisibleIds.every(id => selectedSubjects.includes(id));
    
    if (allSelected) {
      const newSelected = selectedSubjects.filter(id => !allVisibleIds.includes(id));
      if (onSelectedSubjectsUpdate) onSelectedSubjectsUpdate(newSelected);
      if (newSelected.length === 0 && onClearAllPages) onClearAllPages();
    } else {
      const newSelected = [...new Set([...selectedSubjects, ...allVisibleIds])];
      if (onSelectedSubjectsUpdate) onSelectedSubjectsUpdate(newSelected);
    }
  };

  const allVisibleSelected = displaySubjects.length > 0 && 
    displaySubjects.every(subject => selectedSubjects.includes(subject.id));

  // ===== Hide infoText when all pages are selected =====
  const computedInfoText = (() => {
    const allPagesSelected = selectedSubjects.length === totalFilteredCount && totalFilteredCount > 0;

    if (allPagesSelected) return '';

    if (selectedSubjects.length > 0) return `${selectedSubjects.length} subject/s selected`;
    return '';
  })();

  // ===== selectAllBanner with snapshot-based logic =====
  const selectAllBanner = (() => {
    const hasAnyPageFullySelected = hasTriggeredSelectAll;
    const allPagesSelected = selectedSubjects.length === totalFilteredCount && totalFilteredCount > 0;
    const hasMorePages = totalFilteredCount > displaySubjects.length;

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
          Select all {totalFilteredCount} subjects
        </button>
      );
    }

    return null;
  })();
  // ===== END select-all banner =====

  // Delete handler
  const handleDeleteClick = (subject, e) => {
    e.stopPropagation();
    if (onSingleDeleteClick) {
      onSingleDeleteClick(subject, 'subject');
    } else {
      setSelectedSubject(subject);
      setIsDeleteModalOpen(true);
    }
  };

  // Confirm delete
  const handleConfirmDelete = async (id) => {
    setIsDeleting(true);
    try {
      if (editingId === id) cancelEdit();
      await subjectService.delete(id);
      success('Subject deleted successfully');
      await fetchSubjects();
      // Remove from selected if it was selected
      const newSelected = selectedSubjects.filter(selectedId => selectedId !== id);
      if (onSelectedSubjectsUpdate) {
        onSelectedSubjectsUpdate(newSelected);
      }
    } catch (err) {
      toastError(`Failed to delete: ${err.message}`);
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      setSelectedSubject(null);
    }
  };

  // Edit handlers
  const handleEditClick = (subject, e) => {
    e.stopPropagation();
    startEdit(subject);
  };

  const handleSaveEdit = async (id, e) => {
    if (e) e.stopPropagation();
    
    const result = await saveEdit(id, null, async (id, data) => {
      return await subjectService.update(id, {
        subject_code: data.subject_code,
        subject_name: data.subject_name
      });
    });

    if (result.success) {
      success('Subject updated successfully');
      await fetchSubjects();
    }
  };

  const handleCancelEdit = (e) => {
    if (e) e.stopPropagation();
    cancelEdit();
  };

// Render expanded row with details
const renderExpandedRow = (subject) => {
  const addedAt = formatDateTimeLocal(subject.created_at);
  const updatedAt = subject.updated_at ? formatDateTimeLocal(subject.updated_at) : 'Never updated';
  
  return (
    <div 
      className={`${styles.subjectCard} ${styles.expandableCard}`}
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
      >
        ✕
      </button>

      <div className={styles.subjectHeader}>
        {subject.subject_code} - {subject.subject_name}
      </div>
      <div className={styles.details}>
        <div>
          <div className={styles.subjectInfo}>
            <strong>Subject Details</strong>
          </div>
          <div className={styles.subjectInfo}>Subject Code: {subject.subject_code}</div>
          <div className={styles.subjectInfo}>Subject Name: {subject.subject_name}</div>
        </div>
        
        <div>
          <div className={styles.subjectInfo}>
            <strong>Record Information</strong>
          </div>
          <div className={styles.subjectInfo}>Added: {addedAt}</div>
          <div className={styles.subjectInfo}>Last Updated: {updatedAt}</div>
        </div>
      </div>
    </div>
  );
};

  const withColumnWidth = (width, minWidth) => ({
    width,
    minWidth: `${minWidth}px`
  });

  const columns = [
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
        const isSelected = selectedSubjects.includes(row.id);
        return (
          <div className={styles.checkboxWrapper}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={isSelected}
              onChange={(e) => handleSubjectSelect(row.id, e)}
            />
          </div>
        );
      }
    },
    {
      key: 'subject_code',
      label: 'SUBJECT CODE',
      headerStyle: withColumnWidth('35%', 120),
      cellStyle: withColumnWidth('35%', 120),
      renderCell: ({ row }) => {
        const isEditing = editingId === row.id;
        if (!isEditing) return row.subject_code;

        return (
          <input
            type="text"
            value={editFormData.subject_code || ''}
            onChange={(e) => updateEditField('subject_code', e.target.value.toUpperCase())}
            className={`${styles.editInput} ${validationErrors.subject_code ? styles.errorInput : ''}`}
            style={{ textTransform: 'uppercase' }}
            onClick={(e) => e.stopPropagation()}
          />
        );
      }
    },
    {
      key: 'subject_name',
      label: 'SUBJECT NAME',
      headerStyle: withColumnWidth('50%', 200),
      cellStyle: withColumnWidth('50%', 200),
      renderCell: ({ row }) => {
        const isEditing = editingId === row.id;
        if (!isEditing) return row.subject_name;

        return (
          <input
            type="text"
            value={editFormData.subject_name || ''}
            onChange={(e) => updateEditField('subject_name', e.target.value)}
            className={`${styles.editInput} ${validationErrors.subject_name ? styles.errorInput : ''}`}
            onClick={(e) => e.stopPropagation()}
          />
        );
      }
    },
    {
      key: 'actions',
      label: 'ACTIONS',
      headerStyle: { ...withColumnWidth('10%', 90), textAlign: 'left' },
      cellStyle: { ...withColumnWidth('10%', 90), textAlign: 'left' },
      renderCell: ({ row }) => {
        const isEditing = editingId === row.id;

        if (isEditing) {
          return (
            <div className={styles.editActions}>
              <Button 
                onClick={(e) => handleCancelEdit(e)}
                disabled={saving}
                label="Cancel"
                color="ghost"
                height="xs"
                width="auto"
                pill={false}
              />
              <Button 
                onClick={(e) => handleSaveEdit(row.id, e)}
                disabled={saving}
                label={saving ? 'Saving...' : 'Save'}
                color="ocean"
                height="xs"
                width="auto"
                pill={false}
              />
            </div>
          );
        }

        return (
          <ActionsMenu
            actions={[
              {
                label: 'Edit',
                icon: faPenToSquare,
                onClick: (e) => handleEditClick(row, e)
              },
              {
                label: 'Delete',
                icon: faTrashCan,
                onClick: (e) => handleDeleteClick(row, e),
                variant: 'danger'
              },
            ]}
          />
        );
      }
    }
  ];

  return (
    <div className={styles.subjectTableContainer} ref={tableRef}>
      <Table
        columns={columns}
        rows={displaySubjects}
        getRowId={(row) => row.id}
        loading={loading}
        error={error ? `Error: ${error}` : ''}
        emptyMessage={searchTerm ? `No subjects found matching "${searchTerm}"` : 'No subjects available'}
        containerRef={tableRef}
        tableLabel="Subject records"
        onRowClick={({ row }) => toggleRow(row.id)}
        isRowSelected={({ row }) => selectedSubjects.includes(row.id)}
        rowClassName={({ row }) => {
          const isEditing = editingId === row.id;
          return `${styles.subjectRow} ${isEditing ? styles.editingRow : ''}`;
        }}
        expandedRowId={expandedRow}
        renderExpandedRow={({ row }) => renderExpandedRow(row)}
        persistExpandedRows
        hideMainRowWhenExpanded
        getExpandedRowClassName={({ isExpanded }) => `${styles.expandRow} ${isExpanded ? styles.expandRowActive : ''}`}
        stickyHeader
        infoText={computedInfoText}
        selectedInfoText=""
        headerContent={selectAllBanner}
        isAllPagesSelected={isAllPagesSelected}
        visibleSelectedCount={selectedSubjects.length}
        totalRowsOnPage={displaySubjects.length}
        wrapperClassName={styles.tableWrapper}
      />

      {Object.keys(validationErrors).length > 0 && (
        <div className={styles.tableInfo}>
          <p className={styles.errorMessage}>{Object.values(validationErrors)[0]}</p>
        </div>
      )}

      <DeleteEntityModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!isDeleting) {
            setIsDeleteModalOpen(false);
            setSelectedSubject(null);
          }
        }}
        entity={selectedSubject}
        entityType="subject"
        onConfirm={handleConfirmDelete}
        currentFilter={searchTerm}
      />
    </div>
  );
};

export default SubjectTable;