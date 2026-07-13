import React, { useState, useEffect, useMemo } from 'react';
import styles from './GradeSchedulesTable.module.css';
import { EntityService } from '../../../Utils/EntityService';
import { useRowExpansion } from '../../Hooks/useRowExpansion'; 
import DeleteEntityModal from '../../Modals/DeleteEntityModal/DeleteEntityModal';
import { useToast } from '../../Toast/ToastContext/ToastContext';
import { supabase } from '../../../lib/supabase';
import Table from '../Table/Table';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare, faTrashCan, faPlus } from "@fortawesome/free-solid-svg-icons";
import ActionsMenu from '../../UI/Menus/ActionsMenu/ActionsMenu';
import Button from '../../UI/Buttons/Button/Button.jsx';

const formatTimeAMPM = (timeString) => {
  if (!timeString) return 'N/A';
  
  try {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const minute = parseInt(minutes);
    
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  } catch (error) {
    console.error('Error formatting time:', timeString, error);
    return timeString;
  }
};

const formatDuration = (minutes) => {
  if (!minutes && minutes !== 0) return 'N/A';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins} minute${mins !== 1 ? 's' : ''}`;
  } else if (mins === 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  } else {
    return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''}`;
  }
};

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

const sortSchedules = (schedules) => {
  return [...schedules].sort((a, b) => {
    const gradeA = parseInt(a.grade_level) || 0;
    const gradeB = parseInt(b.grade_level) || 0;
    
    return gradeA - gradeB;
  });
};

const calculateClassDuration = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  
  try {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    
    let startTotal = startHours * 60 + startMinutes;
    let endTotal = endHours * 60 + endMinutes;
    
    if (endTotal < startTotal) {
      endTotal += 24 * 60; 
    }
    
    return endTotal - startTotal;
  } catch (error) {
    return 0;
  }
};

const validateScheduleData = (data) => {
  const errors = {};
  
  if (!data.grade_level || data.grade_level === '') {
    errors.grade_level = 'Grade level is required';
  }
  
  if (!data.class_start) {
    errors.class_start = 'Start time is required';
  }
  
  if (!data.class_end) {
    errors.class_end = 'End time is required';
  }
  
  if (data.class_start && data.class_end) {
    const startTime = data.class_start;
    const endTime = data.class_end;
    
    if (startTime >= endTime) {
      errors.class_end = 'End time must be after start time';
    }
  }
  
  const graceMinutes = parseInt(data.grace_period_minutes) || 15;
  if (graceMinutes < 0 || graceMinutes > 120) {
    errors.grace_period_minutes = 'Grace period must be between 0 and 120 minutes';
  }
  
  return errors;
};

const GradeSchedulesTable = ({ 
  searchTerm = '',
  schedules: propSchedules = [],        // ← paginated from parent
  totalFilteredCount = 0,
  onSelectedSchedulesUpdate,
  selectedSchedules = [],
  onSingleDeleteClick,
  onEntityDataUpdate,
  isAllPagesSelected = false,
  onSelectAllPages,
  onClearAllPages,
  currentPage = 1,
}) => {
  const [allSchedules, setAllSchedules] = useState([]); // full dataset for export/edit
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { expandedRow, toggleRow, isRowExpanded, tableRef } = useRowExpansion();
  const { success, error: toastError } = useToast();
  
  const scheduleService = new EntityService('grade_schedules');
  const gradeService = new EntityService('grades');

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: allGrades, error: gradesError } = await supabase
        .from('grades')
        .select('id, grade_level')
        .order('grade_level');
      
      if (gradesError) throw gradesError;
      
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('grade_schedules')
        .select(`
          *,
          grades (
            id,
            grade_level
          )
        `);
      
      if (schedulesError) throw schedulesError;
      
      setGrades(allGrades || []);
      
      const transformedSchedules = (schedulesData || []).map(schedule => ({
        ...schedule,
        grade_level: schedule.grades?.grade_level || 'Unknown',
        grade_id: schedule.grades?.id || null
      }));
      
      const sortedData = sortSchedules(transformedSchedules);
      
      setAllSchedules(sortedData);
      if (onEntityDataUpdate) onEntityDataUpdate(sortedData);
      
    } catch (err) {
      console.error('Error fetching grade schedules:', err);
      setError(err.message);
      setAllSchedules([]);
      setGrades([]);
    } finally {
      setLoading(false);
    }
  };
  
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const startEdit = (schedule) => {
    setEditingId(schedule.id);
    setValidationErrors({});
    
    setEditFormData({
      grade_level: schedule.grade_level.toString(),
      class_start: schedule.class_start,
      class_end: schedule.class_end,
      grace_period_minutes: schedule.grace_period_minutes?.toString() || '15'
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFormData({});
    setValidationErrors({});
  };

  const updateEditField = (field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const saveEdit = async (scheduleId) => {
    try {
      setSaving(true);
      
      const errors = validateScheduleData(editFormData);
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        throw new Error('Please fix the validation errors');
      }
      
      const selectedGrade = grades.find(g => 
        g.grade_level.toString() === editFormData.grade_level
      );
      
      if (!selectedGrade) {
        throw new Error(`Grade ${editFormData.grade_level} not found`);
      }
      
      // Check if grade already has a schedule (using allSchedules for conflict check)
      const existingSchedule = allSchedules.find(s => 
        s.grade_id === selectedGrade.id && s.id !== scheduleId
      );
      
      if (existingSchedule) {
        throw new Error(`Grade ${editFormData.grade_level} already has a schedule. Each grade can only have one schedule.`);
      }
      
      const updateData = {
        grade_id: selectedGrade.id,
        class_start: editFormData.class_start,
        class_end: editFormData.class_end,
        grace_period_minutes: parseInt(editFormData.grace_period_minutes) || 15,
        updated_at: new Date().toISOString()
      };
      
      const updatedSchedule = await scheduleService.update(scheduleId, updateData);
      
      setAllSchedules(prevSchedules => {
        return prevSchedules.map(schedule => {
          if (schedule.id === scheduleId) {
            return {
              ...schedule,
              ...updateData,
              grade_level: editFormData.grade_level,
              grade_id: selectedGrade.id
            };
          }
          return schedule;
        });
      });
      
      success('Schedule updated successfully');
      cancelEdit();
      await fetchSchedules(); // Refresh to sync with database
      
      return { success: true };
      
    } catch (err) {
      console.error('Error updating schedule:', err);
      
      if (err.message !== 'Please fix the validation errors') {
        toastError(`Failed to update schedule: ${err.message}`);
      }
      
      return { 
        success: false, 
        error: err.message
      };
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
    
    const scheduleSubscription = supabase
      .channel('grade-schedules-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'grade_schedules'
        },
        () => {
          fetchSchedules();
        }
      )
      .subscribe();
    
    const gradeSubscription = supabase
      .channel('grades-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'grades'
        },
        () => {
          fetchSchedules();
        }
      )
      .subscribe();

    return () => {
      scheduleSubscription.unsubscribe();
      gradeSubscription.unsubscribe();
    };
  }, []);

  // Use propSchedules for display (already paginated+filtered by parent)
  const displaySchedules = propSchedules;

  // ===== SNAPSHOT-BASED BANNER PERSISTENCE (same pattern as other tables) =====
  const [fullySelectedSnapshots, setFullySelectedSnapshots] = useState(new Map());

  useEffect(() => {
    const allVisibleSelectedNow = displaySchedules.length > 0 &&
      displaySchedules.every(schedule => selectedSchedules.includes(schedule.id));

    if (!allVisibleSelectedNow) return;

    const currentIds = displaySchedules.map(s => s.id);

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
  }, [displaySchedules, selectedSchedules, currentPage]);

  useEffect(() => {
    const selectedSet = new Set(selectedSchedules);

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
  }, [selectedSchedules]);

  const hasTriggeredSelectAll = useMemo(() => {
    return fullySelectedSnapshots.size > 0;
  }, [fullySelectedSnapshots]);

  useEffect(() => {
    setFullySelectedSnapshots(new Map());
  }, [searchTerm]);

  // ===== END SNAPSHOT LOGIC =====

  const handleScheduleSelect = (scheduleId, e) => {
    e.stopPropagation();
    
    // If all pages are selected and we're unselecting one, clear the "all" state
    if (isAllPagesSelected && selectedSchedules.includes(scheduleId)) {
      if (onClearAllPages) onClearAllPages();
      return;
    }
    
    const newSelected = selectedSchedules.includes(scheduleId)
      ? selectedSchedules.filter(id => id !== scheduleId)
      : [...selectedSchedules, scheduleId];
    
    if (onSelectedSchedulesUpdate) {
      onSelectedSchedulesUpdate(newSelected);
    }
  };

  const handleSelectAll = () => {
    const allVisibleIds = displaySchedules.map(schedule => schedule.id);
    const allSelected = allVisibleIds.every(id => selectedSchedules.includes(id));
    
    if (allSelected) {
      const newSelected = selectedSchedules.filter(id => !allVisibleIds.includes(id));
      if (onSelectedSchedulesUpdate) onSelectedSchedulesUpdate(newSelected);
      if (newSelected.length === 0 && onClearAllPages) onClearAllPages();
    } else {
      const newSelected = [...new Set([...selectedSchedules, ...allVisibleIds])];
      if (onSelectedSchedulesUpdate) onSelectedSchedulesUpdate(newSelected);
    }
  };

  const allVisibleSelected = displaySchedules.length > 0 && 
    displaySchedules.every(schedule => selectedSchedules.includes(schedule.id));

  // ===== Hide infoText when all pages are selected =====
  const computedInfoText = (() => {
    const allPagesSelected = selectedSchedules.length === totalFilteredCount && totalFilteredCount > 0;

    if (allPagesSelected) return '';

    if (selectedSchedules.length > 0) return `${selectedSchedules.length} schedule/s selected`;
    return '';
  })();

  // ===== selectAllBanner with snapshot-based logic =====
  const selectAllBanner = (() => {
    const hasAnyPageFullySelected = hasTriggeredSelectAll;
    const allPagesSelected = selectedSchedules.length === totalFilteredCount && totalFilteredCount > 0;
    const hasMorePages = totalFilteredCount > displaySchedules.length;

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
          Select all {totalFilteredCount} schedules
        </button>
      );
    }

    return null;
  })();
  // ===== END select-all banner =====

  const handleDeleteClick = (schedule, e) => {
    e.stopPropagation();
    if (onSingleDeleteClick) {
      onSingleDeleteClick(schedule, 'schedule');
    } else {
      setSelectedSchedule(schedule);
      setIsDeleteModalOpen(true);
    }
  };

  const handleConfirmDelete = async (id) => {
    setIsDeleting(true);
    try {
      if (editingId === id) cancelEdit();
      await scheduleService.delete(id);
      success('Schedule deleted successfully');
      await fetchSchedules();
      const newSelected = selectedSchedules.filter(selectedId => selectedId !== id);
      if (onSelectedSchedulesUpdate) {
        onSelectedSchedulesUpdate(newSelected);
      }
    } catch (err) {
      toastError(`Failed to delete: ${err.message}`);
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      setSelectedSchedule(null);
    }
  };

  const handleEditClick = (schedule, e) => {
    e.stopPropagation();
    startEdit(schedule);
  };

  const handleSaveEdit = async (id, e) => {
    if (e) e.stopPropagation();
    await saveEdit(id);
  };

  const handleCancelEdit = (e) => {
    if (e) e.stopPropagation();
    cancelEdit();
  };

const renderExpandedRow = (schedule) => {
  const addedAt = formatDateTimeLocal(schedule.created_at);
  const updatedAt = schedule.updated_at ? formatDateTimeLocal(schedule.updated_at) : 'Never updated';
  const classDuration = calculateClassDuration(schedule.class_start, schedule.class_end);
  
  return (
    <div 
      className={`${styles.scheduleCard} ${styles.expandableCard}`}
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

      <div className={styles.scheduleHeader}>
        Grade {schedule.grade_level} Schedule
      </div>
      <div className={styles.details}>
        <div>
          <div className={styles.scheduleInfo}>
            <strong>Schedule Details</strong>
          </div>
          <div className={styles.scheduleInfo}>Class Duration: {formatDuration(classDuration)}</div>
          <div className={styles.scheduleInfo}>Late Policy: Students are considered late {formatDuration(schedule.grace_period_minutes || 15)} after class starts</div>
          <div className={styles.scheduleInfo}>Time: {formatTimeAMPM(schedule.class_start)} - {formatTimeAMPM(schedule.class_end)}</div>
        </div>
        
        <div>
          <div className={styles.scheduleInfo}>
            <strong>Record Information</strong>
          </div>
          <div className={styles.scheduleInfo}>Added: {addedAt}</div>
          <div className={styles.scheduleInfo}>Last Updated: {updatedAt}</div>
        </div>
      </div>
    </div>
  );
};

  useEffect(() => {
    if (onEntityDataUpdate) {
      onEntityDataUpdate(allSchedules);
    }
  }, [allSchedules, onEntityDataUpdate]);

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
        const isSelected = selectedSchedules.includes(row.id);
        return (
          <div className={styles.checkboxWrapper}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={isSelected}
              onChange={(e) => handleScheduleSelect(row.id, e)}
            />
          </div>
        );
      }
    },
    {
      key: 'grade_level',
      label: 'GRADE LEVEL',
      headerStyle: withColumnWidth('20%', 100),
      cellStyle: withColumnWidth('20%', 100),
      renderCell: ({ row }) => {
        const isEditing = editingId === row.id;
        if (!isEditing) return `Grade ${row.grade_level}`;

        return (
          <select
            value={editFormData.grade_level || ''}
            onChange={(e) => updateEditField('grade_level', e.target.value)}
            className={`${styles.editSelect} ${validationErrors.grade_level ? styles.errorInput : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <option value="">Select Grade</option>
            {grades.map(grade => (
              <option key={grade.id} value={grade.grade_level}>
                Grade {grade.grade_level}
              </option>
            ))}
          </select>
        );
      }
    },
    {
      key: 'class_start',
      label: 'CLASS START',
      headerStyle: withColumnWidth('20%', 120),
      cellStyle: withColumnWidth('20%', 120),
      renderCell: ({ row }) => {
        const isEditing = editingId === row.id;
        if (!isEditing) return formatTimeAMPM(row.class_start);

        return (
          <input
            type="time"
            value={editFormData.class_start || ''}
            onChange={(e) => updateEditField('class_start', e.target.value)}
            className={`${styles.editInput} ${validationErrors.class_start ? styles.errorInput : ''}`}
            onClick={(e) => e.stopPropagation()}
          />
        );
      }
    },
    {
      key: 'class_end',
      label: 'CLASS END',
      headerStyle: withColumnWidth('20%', 120),
      cellStyle: withColumnWidth('20%', 120),
      renderCell: ({ row }) => {
        const isEditing = editingId === row.id;
        if (!isEditing) return formatTimeAMPM(row.class_end);

        return (
          <input
            type="time"
            value={editFormData.class_end || ''}
            onChange={(e) => updateEditField('class_end', e.target.value)}
            className={`${styles.editInput} ${validationErrors.class_end ? styles.errorInput : ''}`}
            onClick={(e) => e.stopPropagation()}
          />
        );
      }
    },
    {
      key: 'grace_period_minutes',
      label: 'GRACE PERIOD',
      headerStyle: withColumnWidth('25%', 140),
      cellStyle: withColumnWidth('25%', 140),
      renderCell: ({ row }) => {
        const isEditing = editingId === row.id;
        if (!isEditing) return formatDuration(row.grace_period_minutes || 15);

        return (
          <div className={styles.graceInputContainer}>
            <input
              type="number"
              min="0"
              max="120"
              step="5"
              value={editFormData.grace_period_minutes || '15'}
              onChange={(e) => updateEditField('grace_period_minutes', e.target.value)}
              className={`${styles.editInput} ${styles.graceInput} ${validationErrors.grace_period_minutes ? styles.errorInput : ''}`}
              onClick={(e) => e.stopPropagation()}
            />
            <span className={styles.graceUnit}>minutes</span>
          </div>
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
    <div className={styles.scheduleTableContainer} ref={tableRef}>
      <Table
        columns={columns}
        rows={displaySchedules}
        getRowId={(row) => row.id}
        loading={loading}
        error={error ? `Error: ${error}` : ''}
        emptyMessage={searchTerm ? `No schedules found matching "${searchTerm}"` : 'No schedules available'}
        containerRef={tableRef}
        tableLabel="Grade schedule records"
        onRowClick={({ row }) => toggleRow(row.id)}
        isRowSelected={({ row }) => selectedSchedules.includes(row.id)}
        rowClassName={({ row }) => {
          const isEditing = editingId === row.id;
          return `${styles.scheduleRow} ${isEditing ? styles.editingRow : ''}`;
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
        visibleSelectedCount={selectedSchedules.length}
        totalRowsOnPage={displaySchedules.length}
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
            setSelectedSchedule(null);
          }
        }}
        entity={selectedSchedule}
        entityType="grade schedule"
        onConfirm={handleConfirmDelete}
        currentFilter={searchTerm}
      />
    </div>
  );
};

export default GradeSchedulesTable;