import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styles from './GradeSectionTable.module.css';
import { EntityService } from '../../../Utils/EntityService';
import { useRowExpansion } from '../../Hooks/useRowExpansion';
import DeleteEntityModal from '../../Modals/DeleteEntityModal/DeleteEntityModal';
import { useToast } from '../../Toast/ToastContext/ToastContext';
import { supabase } from '../../../lib/supabase';
import Table from '../Table/Table';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPenToSquare, 
  faTrashCan,
  faCircle as fasCircle,
} from "@fortawesome/free-solid-svg-icons";
import { faCircle as farCircleRegular } from "@fortawesome/free-regular-svg-icons";
import { compareSections } from '../../../Utils/CompareHelpers';

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
  refreshTrigger = 0, // Add this prop
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
      
      // Pass full raw data up to parent
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
  }, [fetchGradeSections, refreshTrigger]); // Add refreshTrigger to dependencies

  // Sync prop gradeSections to local state for rendering
  useEffect(() => {
    // propGradeSections is already paginated from parent
    // We don't store it in state, we use it directly in columns/render
  }, [propGradeSections]);

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
      
      // Refresh data
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
    const newSelected = selectedGradeSections.includes(gradeSectionId)
      ? selectedGradeSections.filter(id => id !== gradeSectionId)
      : [...selectedGradeSections, gradeSectionId];
    
    if (isAllPagesSelected && !newSelected.includes(gradeSectionId)) {
      if (onClearAllPages) onClearAllPages();
    }
    if (onSelectedGradeSectionsUpdate) {
      onSelectedGradeSectionsUpdate(newSelected);
    }
  };

  const handleSelectAll = () => {
    const allVisibleIds = propGradeSections.map(gs => gs.id);
    const allSelected = allVisibleIds.every(id => selectedGradeSections.includes(id));
    
    if (allSelected) {
      if (onClearAllPages) onClearAllPages();
      else if (onSelectedGradeSectionsUpdate) {
        onSelectedGradeSectionsUpdate(selectedGradeSections.filter(id => !allVisibleIds.includes(id)));
      }
    } else {
      const newSelected = [...new Set([...selectedGradeSections, ...allVisibleIds])];
      if (onSelectedGradeSectionsUpdate) {
        onSelectedGradeSectionsUpdate(newSelected);
      }
    }
  };

  const allVisibleSelected = propGradeSections.length > 0 && 
    propGradeSections.every(gs => selectedGradeSections.includes(gs.id));

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

  const renderEditCell = (gradeSection) => (
    <div className={styles.editCell}>
      {editingId === gradeSection.id ? (
        <div className={styles.editActions}>
          <button 
            onClick={(e) => handleSaveEdit(gradeSection.id, e)} 
            disabled={saving || updatingStudents} 
            className={styles.saveBtn}
          >
            {saving || updatingStudents ? (updatingStudents ? 'Updating Students...' : 'Saving...') : 'Save'}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); cancelEdit(); }} 
            disabled={saving || updatingStudents} 
            className={styles.cancelBtn}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className={styles.icon}>
          <FontAwesomeIcon 
            icon={faPenToSquare} 
            onClick={(e) => handleEditClick(gradeSection, e)} 
            className="action-button" 
          />
        </div>
      )}
    </div>
  );

  const renderExpandedRow = (gradeSection) => {
  const addedAt = formatDateTimeLocal(gradeSection.created_at);
  const updatedAt = gradeSection.updated_at ? formatDateTimeLocal(gradeSection.updated_at) : 'Never updated';
  return (
    <div 
      className={`${styles.gradeSectionCard} ${styles.expandableCard}`} 
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
        <div className={styles.icon} onClick={handleSelectAll}>
          <FontAwesomeIcon 
            icon={allVisibleSelected ? fasCircle : farCircleRegular} 
            style={{ cursor: 'pointer', color: allVisibleSelected ? '#0f6b58' : '' }} 
          />
        </div>
      ),
      renderCell: ({ row }) => {
        const isSelected = selectedGradeSections.includes(row.id);
        return (
          <div className={styles.icon} onClick={(e) => handleGradeSectionSelect(row.id, e)}>
            <FontAwesomeIcon 
              icon={isSelected ? fasCircle : farCircleRegular} 
              style={{ cursor: 'pointer', color: isSelected ? '#0f6b58' : '' }} 
            />
          </div>
        );
      }
    },
    {
      key: 'grade',
      label: 'GRADE LEVEL',
      headerStyle: withColumnWidth('25%', 100),
      cellStyle: withColumnWidth('25%', 100),
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
      key: 'edit',
      label: 'EDIT',
      headerStyle: withColumnWidth('10%', 80),
      cellStyle: withColumnWidth('10%', 80),
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