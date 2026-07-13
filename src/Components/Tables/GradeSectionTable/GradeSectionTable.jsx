import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styles from './GradeSectionTable.module.css';
import { EntityService } from '../../../Utils/EntityService';
import { useRowExpansion } from '../../Hooks/useRowExpansion';
import DeleteEntityModal from '../../Modals/DeleteEntityModal/DeleteEntityModal';
import { useToast } from '../../Toast/ToastContext/ToastContext';
import { supabase } from '../../../lib/supabase';
import Table from '../Table/Table';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare, faTrashCan, faPlus } from "@fortawesome/free-solid-svg-icons";
import { compareSections } from '../../../Utils/CompareHelpers';
import ActionsMenu from '../../UI/Menus/ActionsMenu/ActionsMenu';
import Button from '../../UI/Buttons/Button/Button.jsx'; // ADDED THIS IMPORT

const formatDateTimeLocal = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
  } catch (error) {
    console.error('Error formatting date:', dateString, error);
    return 'N/A';
  }
};

const sortGradeSections = (sections) => {
  return [...sections].sort((a, b) => {
    const gradeA = parseInt(a.grade) || 0;
    const gradeB = parseInt(b.grade) || 0;
    if (gradeA !== gradeB) return gradeA - gradeB;
    return compareSections(a.section || '', b.section || '');
  });
};

const updateStudentsForSectionChange = async (oldSection, newGrade, newSection, sectionId) => {
  try {
    const { data: students, error: fetchError } = await supabase
      .from('students').select('id, first_name, last_name, grade, section, grade_id, section_id').eq('section_id', sectionId);
    if (fetchError) throw fetchError;
    if (!students || students.length === 0) return { success: true, updated: 0 };

    const { data: gradeData, error: gradeError } = await supabase
      .from('grades').select('id, grade_level').eq('grade_level', newGrade).single();
    if (gradeError) throw gradeError;

    const gradeId = gradeData?.id;
    let updatedCount = 0;
    const errors = [];

    for (const student of students) {
      try {
        const { error: updateError } = await supabase.from('students').update({
          grade: newGrade.toString(), section: newSection, grade_id: gradeId, updated_at: new Date().toISOString()
        }).eq('id', student.id);
        if (updateError) errors.push(`Student ${student.id}: ${updateError.message}`);
        else updatedCount++;
      } catch (err) { errors.push(`Student ${student.id}: ${err.message}`); }
    }
    if (errors.length > 0) return { success: false, updated: updatedCount, errors };
    return { success: true, updated: updatedCount };
  } catch (error) { throw error; }
};

const GradeSectionTable = ({ 
  searchTerm = '',
  gradeSections: propGradeSections = [],
  totalFilteredCount = 0,
  onSelectedGradeSectionsUpdate,
  selectedGradeSections = [],
  onSingleDeleteClick,
  onEntityDataUpdate,
  isAllPagesSelected = false,
  onSelectAllPages,
  onClearAllPages,
  currentPage = 1,
  refreshTrigger = 0,
}) => {
  const [allGradeSections, setAllGradeSections] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGradeSection, setSelectedGradeSection] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [updatingStudents, setUpdatingStudents] = useState(false);
  
  const { expandedRow, toggleRow, tableRef } = useRowExpansion();
  const { success, error: toastError } = useToast();
  const sectionService = new EntityService('sections');

  // Fetch all grade sections (parent handles filtering/pagination)
  const fetchGradeSections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: allGrades, error: gradesError } = await supabase
        .from('grades').select('id, grade_level').order('grade_level');
      if (gradesError) throw gradesError;
      
      const { data, error } = await supabase
        .from('sections').select(`*, grade:grades!grade_id (grade_level)`);
      if (error) throw error;
      
      setGrades(allGrades || []);
      const transformedData = (data || []).map(item => ({
        id: item.id,
        grade: item.grade?.grade_level || 'N/A',
        section: item.section_name || 'N/A',
        created_at: item.created_at,
        updated_at: item.updated_at,
        grade_id: item.grade_id
      }));
      const sorted = sortGradeSections(transformedData);
      setAllGradeSections(sorted);
      
      if (onEntityDataUpdate) {
        onEntityDataUpdate(sorted);
      }
    } catch (err) {
      setError(err.message);
      setAllGradeSections([]);
      setGrades([]);
    } finally {
      setLoading(false);
    }
  }, [onEntityDataUpdate]);

  useEffect(() => {
    fetchGradeSections();
    const subscription = supabase
      .channel('grade-sections-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sections' }, () => fetchGradeSections())
      .subscribe();
    return () => subscription.unsubscribe();
  }, [fetchGradeSections, refreshTrigger]);

  useEffect(() => {
    // propGradeSections is already paginated from parent
  }, [propGradeSections]);

  // ===== SNAPSHOT-BASED BANNER PERSISTENCE =====
  const [fullySelectedSnapshots, setFullySelectedSnapshots] = useState(new Map());

  useEffect(() => {
    const allVisibleSelectedNow = propGradeSections.length > 0 &&
      propGradeSections.every(gs => selectedGradeSections.includes(gs.id));

    if (!allVisibleSelectedNow) return;

    const currentIds = propGradeSections.map(gs => gs.id);

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
  }, [propGradeSections, selectedGradeSections, currentPage]);

  useEffect(() => {
    const selectedSet = new Set(selectedGradeSections);

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
  }, [selectedGradeSections]);

  const hasTriggeredSelectAll = useMemo(() => {
    return fullySelectedSnapshots.size > 0;
  }, [fullySelectedSnapshots]);

  useEffect(() => {
    setFullySelectedSnapshots(new Map());
  }, [searchTerm]);

  // ===== END SNAPSHOT LOGIC =====

  const startEdit = (gradeSection) => {
    setEditingId(gradeSection.id);
    setValidationErrors({});
    setEditFormData({
      grade: gradeSection.grade.toString(),
      section: gradeSection.section || '',
      originalGrade: gradeSection.grade,
      originalSection: gradeSection.section
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFormData({});
    setValidationErrors({});
  };

  const updateEditField = (field, value) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const n = { ...prev };
        delete n[field];
        return n;
      });
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!editFormData.grade || editFormData.grade === '') errors.grade = 'Grade is required';
    if (!editFormData.section || editFormData.section.trim() === '') errors.section = 'Section name is required';
    else if (editFormData.section.length > 50) errors.section = 'Section name must be 50 characters or less';
    return errors;
  };

  const handleSaveEdit = async (gradeSectionId, e) => {
    if (e) e.stopPropagation();
    try {
      setSaving(true);
      const errors = validateForm();
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        toastError('Please fix the validation errors');
        return { success: false };
      }
      
      const selectedGrade = grades.find(g => g.grade_level.toString() === editFormData.grade);
      if (!selectedGrade) throw new Error(`Grade ${editFormData.grade} not found`);
      
      const sectionBeforeEdit = allGradeSections.find(s => s.id === gradeSectionId);
      const gradeChanged = sectionBeforeEdit?.grade !== editFormData.grade;
      const sectionNameChanged = sectionBeforeEdit?.section !== editFormData.section.trim();
      
      const updateData = {
        grade_id: selectedGrade.id,
        section_name: editFormData.section.trim(),
        updated_at: new Date().toISOString()
      };
      
      const { data: updatedSection, error: updateError } = await supabase
        .from('sections').update(updateData).eq('id', gradeSectionId).select().single();
      
      if (updateError) {
        if (updateError.code === '23505' && updateError.message.includes('sections_grade_id_section_name_key')) {
          throw new Error(`Section "${editFormData.section}" already exists in Grade ${editFormData.grade}`);
        }
        throw new Error(updateError.message || 'Failed to update grade section');
      }
      
      if ((gradeChanged || sectionNameChanged) && sectionBeforeEdit) {
        try {
          setUpdatingStudents(true);
          const result = await updateStudentsForSectionChange(
            sectionBeforeEdit.section,
            editFormData.grade,
            editFormData.section.trim(),
            gradeSectionId
          );
          if (!result.success) toastError('Updated section but had issues with some students');
        } catch (err) {
          toastError('Updated section but failed to update some student records');
        } finally {
          setUpdatingStudents(false);
        }
      }
      
      await fetchGradeSections();
      success(`Grade section updated successfully${gradeChanged || sectionNameChanged ? ' (students updated)' : ''}`);
      cancelEdit();
      return { success: true };
    } catch (err) {
      toastError(`Failed to update: ${err.message}`);
      return { success: false, error: err.message };
    } finally {
      setSaving(false);
    }
  };

  // Selection handlers
  const handleGradeSectionSelect = (gradeSectionId, e) => {
    e.stopPropagation();

    if (isAllPagesSelected && selectedGradeSections.includes(gradeSectionId)) {
      if (onClearAllPages) onClearAllPages();
      return;
    }

    const newSelected = selectedGradeSections.includes(gradeSectionId)
      ? selectedGradeSections.filter(id => id !== gradeSectionId)
      : [...selectedGradeSections, gradeSectionId];

    if (onSelectedGradeSectionsUpdate) onSelectedGradeSectionsUpdate(newSelected);
  };

  const handleSelectAll = () => {
    const allVisibleIds = propGradeSections.map(gs => gs.id);
    const allSelected = allVisibleIds.every(id => selectedGradeSections.includes(id));

    if (allSelected) {
      const newSelected = selectedGradeSections.filter(id => !allVisibleIds.includes(id));
      if (onSelectedGradeSectionsUpdate) onSelectedGradeSectionsUpdate(newSelected);
      if (newSelected.length === 0 && onClearAllPages) onClearAllPages();
    } else {
      const newSelected = [...new Set([...selectedGradeSections, ...allVisibleIds])];
      if (onSelectedGradeSectionsUpdate) onSelectedGradeSectionsUpdate(newSelected);
    }
  };

  const allVisibleSelected = propGradeSections.length > 0 && 
    propGradeSections.every(gs => selectedGradeSections.includes(gs.id));

  // ===== UPDATED: Hide infoText when all pages are selected =====
  const computedInfoText = (() => {
    const allPagesSelected = selectedGradeSections.length === totalFilteredCount && totalFilteredCount > 0;
    
    // Don't show any info text if all pages are selected (banner handles it)
    if (allPagesSelected) return '';
    
    if (selectedGradeSections.length > 0) return `${selectedGradeSections.length} grade section/s selected`;
    return '';
  })();

  // ===== selectAllBanner with snapshot-based logic =====
  const selectAllBanner = (() => {
    const hasAnyPageFullySelected = hasTriggeredSelectAll;
    const allPagesSelected = selectedGradeSections.length === totalFilteredCount && totalFilteredCount > 0;
    const hasMorePages = totalFilteredCount > propGradeSections.length;

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
          Select all {totalFilteredCount} grade sections
        </button>
      );
    }

    return null;
  })();

  const handleDeleteClick = (gradeSection, e) => {
    e.stopPropagation();
    if (onSingleDeleteClick) {
      onSingleDeleteClick(gradeSection, 'gradeSection');
    } else {
      setSelectedGradeSection(gradeSection);
      setIsDeleteModalOpen(true);
    }
  };

  const handleConfirmDelete = async (id) => {
    setIsDeleting(true);
    try {
      if (editingId === id) cancelEdit();
      await sectionService.delete(id);
      success('Grade section deleted successfully');
      await fetchGradeSections();
      const newSelected = selectedGradeSections.filter(selectedId => selectedId !== id);
      if (onSelectedGradeSectionsUpdate) onSelectedGradeSectionsUpdate(newSelected);
    } catch (err) {
      toastError(`Failed to delete: ${err.message}`);
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      setSelectedGradeSection(null);
    }
  };

  const handleEditClick = (gradeSection, e) => {
    e.stopPropagation();
    startEdit(gradeSection);
  };

  const renderExpandedRow = (gradeSection) => {
    const addedAt = formatDateTimeLocal(gradeSection.created_at);
    const updatedAt = gradeSection.updated_at ? formatDateTimeLocal(gradeSection.updated_at) : 'Never updated';
    return (
      <div 
        className={`${styles.gradeSectionCard} ${styles.expandableCard}`} 
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

        <div className={styles.gradeSectionHeader}>
          Grade {gradeSection.grade} - Section {gradeSection.section}
        </div>
        <div className={styles.details}>
          <div>
            <div className={styles.gradeSectionInfo}><strong>Grade Section Details</strong></div>
            <div className={styles.gradeSectionInfo}>Grade Level: {gradeSection.grade}</div>
            <div className={styles.gradeSectionInfo}>Section: {gradeSection.section}</div>
          </div>
          <div>
            <div className={styles.gradeSectionInfo}><strong>Record Information</strong></div>
            <div className={styles.gradeSectionInfo}>Added: {addedAt}</div>
            <div className={styles.gradeSectionInfo}>Last Updated: {updatedAt}</div>
          </div>
        </div>
      </div>
    );
  };

  const withColumnWidth = (width, minWidth) => ({ width, minWidth: `${minWidth}px` });

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
        const isSelected = selectedGradeSections.includes(row.id);
        return (
          <div className={styles.checkboxWrapper}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={isSelected}
              onChange={(e) => handleGradeSectionSelect(row.id, e)}
            />
          </div>
        );
      }
    },
    {
      key: 'grade',
      label: 'GRADE LEVEL',
      headerStyle: withColumnWidth('35%', 100),
      cellStyle: withColumnWidth('35%', 100),
      renderCell: ({ row }) => {
        const isEditing = editingId === row.id;
        if (!isEditing) return `Grade ${row.grade}`;
        return (
          <select 
            value={editFormData.grade || ''} 
            onChange={(e) => updateEditField('grade', e.target.value)}
            className={`${styles.editSelect} ${validationErrors.grade ? styles.errorInput : ''}`} 
            onClick={(e) => e.stopPropagation()}
          >
            <option value="">Select Grade</option>
            {grades.map(grade => (
              <option key={grade.id} value={grade.grade_level}>Grade {grade.grade_level}</option>
            ))}
          </select>
        );
      }
    },
    {
      key: 'section',
      label: 'SECTION',
      headerStyle: withColumnWidth('50%', 150),
      cellStyle: withColumnWidth('50%', 150),
      renderCell: ({ row }) => {
        const isEditing = editingId === row.id;
        if (!isEditing) return row.section;
        return (
          <input 
            type="text" 
            value={editFormData.section || ''} 
            onChange={(e) => updateEditField('section', e.target.value)}
            className={`${styles.editInput} ${validationErrors.section ? styles.errorInput : ''}`} 
            onClick={(e) => e.stopPropagation()} 
            placeholder="Section name" 
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
                onClick={(e) => {
                  e.stopPropagation();
                  cancelEdit();
                }}
                disabled={saving || updatingStudents}
                label="Cancel"
                color="ghost"
                height="xs"
                width="auto"
                pill={false}
              />
              <Button 
                onClick={(e) => handleSaveEdit(row.id, e)}
                disabled={saving || updatingStudents}
                label={saving || updatingStudents ? (updatingStudents ? 'Updating...' : 'Saving...') : 'Save'}
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
    <div className={styles.gradeSectionTableContainer} ref={tableRef}>
      <Table
        columns={columns}
        rows={propGradeSections}
        getRowId={(row) => row.id}
        loading={loading}
        error={error ? `Error: ${error}` : ''}
        emptyMessage={searchTerm 
          ? `Found 0 grade section/s matching "${searchTerm}"` 
          : 'No grade sections found'
        }
        containerRef={tableRef}
        tableLabel="Grade and section records"
        onRowClick={({ row }) => toggleRow(row.id)}
        isRowSelected={({ row }) => selectedGradeSections.includes(row.id)}
        rowClassName={({ row }) => {
          const isEditing = editingId === row.id;
          return `${styles.gradeSectionRow} ${isEditing ? styles.editingRow : ''}`;
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
        visibleSelectedCount={selectedGradeSections.length}
        totalRowsOnPage={propGradeSections.length}
        className={styles.tableContainer}
        wrapperClassName={styles.tableWrapper}
      />

      {(updatingStudents || Object.keys(validationErrors).length > 0) && (
        <div className={styles.tableInfo}>
          {updatingStudents && <p className={styles.syncNote}>Updating student records...</p>}
          {Object.keys(validationErrors).length > 0 && (
            <p className={styles.errorMessage}>{Object.values(validationErrors)[0]}</p>
          )}
        </div>
      )}

      <DeleteEntityModal
        isOpen={isDeleteModalOpen}
        onClose={() => { 
          if (!isDeleting) { 
            setIsDeleteModalOpen(false); 
            setSelectedGradeSection(null); 
          } 
        }}
        entity={selectedGradeSection}
        entityType="grade section"
        onConfirm={handleConfirmDelete}
        currentFilter={searchTerm}
      />
    </div>
  );
};

export default GradeSectionTable;