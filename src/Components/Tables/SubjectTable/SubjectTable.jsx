import React, { useState, useEffect } from 'react';
import styles from './SubjectTable.module.css';
import { EntityService } from '../../../Utils/EntityService';
import { useRowExpansion } from '../../Hooks/useRowExpansion'; 
import { useEntityEdit } from '../../Hooks/useEntityEdit'; 
import DeleteEntityModal from '../../Modals/DeleteEntityModal/DeleteEntityModal';
import { useToast } from '../../Toast/ToastContext/ToastContext';
import { supabase } from '../../../lib/supabase';
import Table from '../Table/Table';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPenToSquare, 
  faTrashCan,
  faCircle as fasCircle 
} from "@fortawesome/free-solid-svg-icons";
import { faCircle as farCircleRegular } from "@fortawesome/free-regular-svg-icons";

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
      // Deselect all on current page
      if (onClearAllPages) onClearAllPages();
      else if (onSelectedSubjectsUpdate) {
        onSelectedSubjectsUpdate(selectedSubjects.filter(id => !allVisibleIds.includes(id)));
      }
    } else {
      // Select all on current page
      if (onSelectedSubjectsUpdate) {
        onSelectedSubjectsUpdate([...new Set([...selectedSubjects, ...allVisibleIds])]);
      }
    }
  };

  const allVisibleSelected = displaySubjects.length > 0 && 
    displaySubjects.every(subject => selectedSubjects.includes(subject.id));

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

  // Render edit cell
  const renderEditCell = (subject) => (
    <div className={styles.editCell}>
      {editingId === subject.id ? (
        <div className={styles.editActions}>
          <button 
            onClick={(e) => handleSaveEdit(subject.id, e)}
            disabled={saving}
            className={styles.saveBtn}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button 
            onClick={(e) => handleCancelEdit(e)}
            disabled={saving}
            className={styles.cancelBtn}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className={styles.icon}>
          <FontAwesomeIcon 
            icon={faPenToSquare} 
            onClick={(e) => handleEditClick(subject, e)}
            className="action-button"
          />
        </div>
      )}
    </div>
  );

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
        <div className={styles.icon} onClick={handleSelectAll}>
          <FontAwesomeIcon 
            icon={allVisibleSelected ? fasCircle : farCircleRegular}
            style={{ cursor: 'pointer', color: allVisibleSelected ? '#0f6b58' : '' }}
          />
        </div>
      ),
      renderCell: ({ row }) => {
        const isSelected = selectedSubjects.includes(row.id);
        return (
          <div className={styles.icon} onClick={(e) => handleSubjectSelect(row.id, e)}>
            <FontAwesomeIcon 
              icon={isSelected ? fasCircle : farCircleRegular}
              style={{ cursor: 'pointer', color: isSelected ? '#0f6b58' : '' }}
            />
          </div>
        );
      }
    },
    {
      key: 'subject_code',
      label: 'SUBJECT CODE',
      headerStyle: withColumnWidth('20%', 120),
      cellStyle: withColumnWidth('20%', 120),
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
      headerStyle: withColumnWidth('55%', 200),
      cellStyle: withColumnWidth('55%', 200),
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
      key: 'edit',
      label: 'EDIT',
      headerStyle: withColumnWidth('10%', 70),
      cellStyle: withColumnWidth('10%', 70),
      renderCell: ({ row }) => renderEditCell(row)
    },
    {
      key: 'delete',
      label: 'DELETE',
      headerStyle: withColumnWidth('10%', 70),
      cellStyle: withColumnWidth('10%', 70),
      renderCell: ({ row }) => (
        <div className={styles.icon}>
          <FontAwesomeIcon 
            icon={faTrashCan}
            className="action-button"
            onClick={(e) => handleDeleteClick(row, e)}
          />
        </div>
      )
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