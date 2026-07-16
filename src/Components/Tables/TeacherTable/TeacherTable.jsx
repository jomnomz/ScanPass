// src/components/TeacherTable/TeacherTable.jsx
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useTeachers } from '../../Hooks/useEntities'; 
import { useEntityEdit } from '../../Hooks/useEntityEdit'; 
import { useRowExpansion } from '../../Hooks/useRowExpansion'; 
import { sortTeachers } from '../../../Utils/CompareHelpers';
import { formatTeacherName, formatDateTime, formatNA } from '../../../Utils/Formatters';
import { getProfileColor, getProfileInitial } from '../../../Utils/ProfileHelpers';
import { shouldHandleRowClick } from '../../../Utils/TableHelpers';
import { supabase } from '../../../lib/supabase';
import styles from './TeacherTable.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPenToSquare, 
  faTrashCan, 
  faPlus,
  faPaperPlane,
  faUserSlash,
  faUserCheck,
  faEnvelope,
  faPhone
} from "@fortawesome/free-solid-svg-icons";
import { useToast } from '../../Toast/ToastContext/ToastContext';
import { useAuth } from '../../Authentication/AuthProvider/AuthProvider';
import Table from '../Table/Table';
import EntityDropdown from '../../UI/Buttons/EntityDropdown/EntityDropdown';
import Pagination from '../../../Components/UI/Buttons/Pagination/Pagination.jsx';
import ActionsMenu from '../../UI/Menus/ActionsMenu/ActionsMenu';
import EditEntityFormModal from '../../Modals/EditEntityFormModal/EditEntityFormModal.jsx';
import EditTeacherForm from '../../Forms/EditTeacherForm/EditTeacherForm.jsx';
import { apiClient } from '../../../config/api.js';

console.log('🔄 TeacherTable.jsx LOADED - Updated with edit modal');

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

// ===== SHARED PROFILE CIRCLE RENDERER =====
const renderProfileCircle = (teacher, sizeClassName) => {
  const { bg, text } = getProfileColor(teacher.id ?? `${teacher.first_name}${teacher.last_name}`);

  if (teacher.photo_url) {
    return (
      <img
        src={teacher.photo_url}
        alt={formatTeacherName(teacher)}
        className={sizeClassName}
        style={{ objectFit: 'cover' }}
      />
    );
  }

  return (
    <div className={sizeClassName} style={{ backgroundColor: bg, color: text }}>
      {getProfileInitial(teacher.first_name)}
    </div>
  );
};

const TeacherTable = ({ 
  searchTerm = '', 
  onSelectedTeachersUpdate,
  onTeacherDataUpdate,
  onSingleDeleteClick,
  onSingleInviteClick,
  refreshTeachers,
  currentPage = 1,
  onPageChange = () => {},
  rowsPerPage = 20,
  isAllPagesSelected = false,
  onSelectAllPages = () => {},
  onClearAllPages = () => {},
  onFilteredTeachersUpdate = () => {},
  selectedTeachers = [],
  gradesData = [],
  sectionsData = [],
}) => {

  // ===== USE TEACHERS HOOK (single source of truth) =====
  const {
    entities: teachers,
    teacherAssignments,
    loadingAssignments,
    loading,
    error,
    setEntities,
    fetchTeacherAssignmentsFresh,
    updateTeacherAssignments: updateTeacherAssignmentsViaHook,
  } = useTeachers();

  // ===== MODAL STATE MACHINE =====
  const [editModalState, setEditModalState] = useState('closed');
  const [editingEntity, setEditingEntity] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [editLoadingId, setEditLoadingId] = useState(null); // disable Edit while fetching
  const [gradeSectionsMap, setGradeSectionsMap] = useState({});
  const [allSubjects, setAllSubjects] = useState([]);
  const [sectionIdMap, setSectionIdMap] = useState({}); // key: `${gradeLevel}|${sectionName}` -> section.id

  const { editingId: editingTeacher, editFormData, saving, validationErrors, startEdit, cancelEdit, updateEditField, saveEdit, validateForm } = useEntityEdit(
  teachers, setEntities, 'teacher', refreshTeachers
);

  const { expandedRow, tableRef, toggleRow, isRowExpanded } = useRowExpansion();
  const { success, error: toastError } = useToast();
  const { user, profile } = useAuth();

  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');

  const filterRef = useRef({ selectedGrade, selectedSubjectFilter, selectedSectionFilter, selectedStatusFilter });

  // ===== FETCH ALL SUBJECTS CATALOG DIRECTLY FROM SUPABASE (including IDs) =====
  useEffect(() => {
    const fetchAllSubjects = async () => {
      try {
        const { data, error } = await supabase
          .from('subjects')
          .select('id, subject_code, subject_name')
          .order('subject_name');

        if (error) throw error;

        const list = (data || []).map((s) => ({
          id: s.id,
          code: s.subject_code,
          name: s.subject_name,
        }));
        setAllSubjects(list);
        console.log('📚 Subject catalog loaded with IDs:', list);
      } catch (err) {
        console.error('Error fetching subject catalog:', err);
      }
    };
    fetchAllSubjects();
  }, []);

  // ===== BUILD GRADE-SECTIONS MAP AND SECTION ID MAP =====
  useEffect(() => {
    if (sectionsData.length > 0 && gradesData.length > 0) {
      console.log('📋 Building grade-sections map for teachers...');
      const map = {};
      const idMap = {};
      
      const gradeIdToLevel = {};
      gradesData.forEach(grade => {
        gradeIdToLevel[grade.id] = grade.grade_level;
      });
      
      sectionsData.forEach(section => {
        const gradeLevel = gradeIdToLevel[section.grade_id];
        if (gradeLevel) {
          // For the dropdown UI
          if (!map[gradeLevel]) {
            map[gradeLevel] = [];
          }
          map[gradeLevel].push(section.section_name);
          
          // For ID resolution
          const key = `${gradeLevel}|${section.section_name}`;
          idMap[key] = section.id;
        }
      });
      
      // Sort sections for each grade
      Object.keys(map).forEach(grade => {
        map[grade] = map[grade].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      });
      
      console.log('📋 Teacher grade-sections map:', map);
      console.log('🗺️ Section ID map:', idMap);
      setGradeSectionsMap(map);
      setSectionIdMap(idMap);
    }
  }, [gradesData, sectionsData]);

  // ===== SNAPSHOT-BASED BANNER PERSISTENCE =====
  const [fullySelectedSnapshots, setFullySelectedSnapshots] = useState(new Map());

  // Reset page when filters change
  useEffect(() => {
    const current = { selectedGrade, selectedSubjectFilter, selectedSectionFilter, selectedStatusFilter };
    const prev = filterRef.current;
    const changed = prev.selectedGrade !== current.selectedGrade ||
      prev.selectedSubjectFilter !== current.selectedSubjectFilter ||
      prev.selectedSectionFilter !== current.selectedSectionFilter ||
      prev.selectedStatusFilter !== current.selectedStatusFilter;

    if (changed) {
      onPageChange(1);
      onClearAllPages();
      setFullySelectedSnapshots(new Map());
      filterRef.current = current;
    }
  }, [selectedGrade, selectedSubjectFilter, selectedSectionFilter, selectedStatusFilter, onPageChange, onClearAllPages]);

  useEffect(() => {
    if (onTeacherDataUpdate) onTeacherDataUpdate(teachers);
  }, [teachers, onTeacherDataUpdate]);

  const searchFilteredTeachers = useMemo(() => {
    if (!searchTerm.trim()) return teachers;
    const searchLower = searchTerm.toLowerCase().trim();
    return teachers.filter(teacher => 
      teacher.employee_id?.toLowerCase().includes(searchLower) ||
      teacher.first_name?.toLowerCase().includes(searchLower) ||
      teacher.middle_name?.toLowerCase().includes(searchLower) ||
      teacher.last_name?.toLowerCase().includes(searchLower) ||
      teacher.email_address?.toLowerCase().includes(searchLower) ||
      teacher.phone_no?.toLowerCase().includes(searchLower) ||
      teacher.status?.toLowerCase().includes(searchLower) ||
      teacherAssignments[teacher.id]?.subjects?.some(subject => 
        subject.subject?.subject_name?.toLowerCase().includes(searchLower) ||
        subject.subject?.subject_code?.toLowerCase().includes(searchLower)
      )
    );
  }, [teachers, searchTerm, teacherAssignments]);

  const teacherGradeOptions = useMemo(() => {
    const allGrades = Object.values(teacherAssignments)
      .flatMap(a => (a.sections || []).map(s => s?.section?.grade?.grade_level))
      .filter(g => g !== null && g !== undefined && g !== '');
    return [...new Set(allGrades.map(String))].sort((a, b) => Number(a) - Number(b));
  }, [teacherAssignments]);

  const teacherSubjectOptions = useMemo(() => {
    const allSubjects = Object.values(teacherAssignments)
      .flatMap(a => (a.subjects || []).map(s => s?.subject?.subject_code || ''))
      .filter(Boolean);
    return [...new Set(allSubjects)].sort((a, b) => a.localeCompare(b));
  }, [teacherAssignments]);

  const teacherSectionOptions = useMemo(() => {
    const allSections = Object.values(teacherAssignments)
      .flatMap(a => (a.sections || []).map(s => s?.section?.section_name))
      .filter(Boolean);
    return [...new Set(allSections)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [teacherAssignments]);

  const teacherStatusOptions = useMemo(() => {
    const statusesFromData = teachers.map(t => String(t.status || '').trim()).filter(Boolean);
    const schemaStatuses = ['pending', 'active', 'inactive'];
    return [...new Set([...schemaStatuses, ...statusesFromData])]
      .sort((a, b) => a.localeCompare(b))
      .map(status => ({ label: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase(), value: status.toLowerCase() }));
  }, [teachers]);

  const filteredTeachers = useMemo(() => {
    return searchFilteredTeachers.filter((teacher) => {
      const assignments = teacherAssignments[teacher.id] || {};
      const gradeLevels = (assignments.sections || []).map(s => String(s?.section?.grade?.grade_level || '')).filter(Boolean);
      const sectionNames = (assignments.sections || []).map(s => s?.section?.section_name || '').filter(Boolean);
      const subjectNames = (assignments.subjects || []).map(s => String(s?.subject?.subject_code || '').trim()).filter(Boolean);

      if (selectedGrade !== 'all' && !gradeLevels.includes(String(selectedGrade))) return false;
      if (selectedSectionFilter && !sectionNames.includes(selectedSectionFilter)) return false;
      if (selectedSubjectFilter && !subjectNames.includes(selectedSubjectFilter)) return false;
      if (selectedStatusFilter && String(teacher.status || '').toLowerCase() !== selectedStatusFilter.toLowerCase()) return false;
      return true;
    });
  }, [searchFilteredTeachers, teacherAssignments, selectedGrade, selectedSectionFilter, selectedSubjectFilter, selectedStatusFilter]);

  const sortedTeachers = useMemo(() => sortTeachers(filteredTeachers, teacherAssignments), [filteredTeachers, teacherAssignments]);

  useEffect(() => {
    if (onFilteredTeachersUpdate) onFilteredTeachersUpdate(sortedTeachers);
  }, [sortedTeachers, onFilteredTeachersUpdate]);

  const totalPages = Math.ceil(sortedTeachers.length / rowsPerPage);
  const paginatedTeachers = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedTeachers.slice(start, start + rowsPerPage);
  }, [sortedTeachers, currentPage, rowsPerPage]);

  const paginationContent = sortedTeachers.length > 0 ? (
    <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
  ) : null;

  const allOnPageSelected = paginatedTeachers.length > 0 &&
    paginatedTeachers.every(teacher => selectedTeachers.includes(teacher.id));

  // ===== SNAPSHOT-BASED BANNER PERSISTENCE =====
  useEffect(() => {
    const allVisibleSelectedNow = paginatedTeachers.length > 0 &&
      paginatedTeachers.every(teacher => selectedTeachers.includes(teacher.id));

    if (!allVisibleSelectedNow) return;

    const currentIds = paginatedTeachers.map(t => t.id);

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
  }, [paginatedTeachers, selectedTeachers, currentPage]);

  useEffect(() => {
    const selectedSet = new Set(selectedTeachers);

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
  }, [selectedTeachers]);

  const hasTriggeredSelectAll = useMemo(() => {
    return fullySelectedSnapshots.size > 0;
  }, [fullySelectedSnapshots]);

  const computedInfoText = (() => {
    if (selectedTeachers.length === sortedTeachers.length && sortedTeachers.length > 0)
      return `All ${sortedTeachers.length} teachers selected`;
    if (selectedTeachers.length > 0) return `${selectedTeachers.length} teacher/s selected`;
    return '';
  })();

  const selectAllBanner = (() => {
    const hasAnyPageFullySelected = hasTriggeredSelectAll;
    const allPagesSelected = selectedTeachers.length === sortedTeachers.length && sortedTeachers.length > 0;
    const hasMorePages = sortedTeachers.length > paginatedTeachers.length;

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
          Select all {sortedTeachers.length} teachers
        </button>
      );
    }

    return null;
  })();

  const handleRowClick = (teacherId, e) => {
    if (shouldHandleRowClick(editingTeacher, e.target)) toggleRow(teacherId);
  };

  // ===== HELPER: Build teacher edit data with assignments/subjects =====
  const buildTeacherEditData = (teacher, assignmentsDataOverride) => {
    const assignmentsData = assignmentsDataOverride || teacherAssignments[teacher.id] || {};

    const assignments = (assignmentsData.sections || [])
      .map((s) => ({
        id: `existing-${s.section_id ?? s.section?.id ?? Math.random()}`,
        grade: String(s.section?.grade?.grade_level ?? ''),
        section: s.section?.section_name || '',
        isAdviser: Boolean(s.is_adviser),
      }))
      .filter((row) => row.grade && row.section);

    const subjects = (assignmentsData.subjects || [])
      .map((s) => ({
        id: `existing-${s.subject_id ?? Math.random()}`,
        code: s.subject?.subject_code || '',
      }))
      .filter((row) => row.code);

    return { ...teacher, assignments, subjects };
  };

  // ===== UPDATED: Open modal with fresh data =====
  const handleEditClick = async (teacher, e) => {
    e.stopPropagation();
    if (editLoadingId) return; // guard against double-clicks

    setEditLoadingId(teacher.id);
    try {
      console.log('✏️ Fetching fresh assignments before opening edit modal for teacher:', teacher.id);
      const fresh = await fetchTeacherAssignmentsFresh(teacher.id);

      const teacherForEdit = buildTeacherEditData(teacher, fresh);

      startEdit(teacherForEdit);
      setEditingEntity(teacher);
      setEditModalState('editing');
      setSaveError('');
      toggleRow(null);
    } catch (err) {
      console.error('Failed to load teacher assignments for edit:', err);
      toastError('Failed to load teacher assignments. Please try again.');
    } finally {
      setEditLoadingId(null);
    }
  };

  // ===== CLOSE MODAL =====
  const handleCloseModal = () => {
    setEditModalState('closed');
    setEditingEntity(null);
    cancelEdit();
    setSaveError('');
  };

  // ===== HANDLE SAVE FROM MODAL =====
  const handleEditFormSave = () => {
  const teacher = editingEntity;
  if (!teacher) return;

  setSaveError('');

  const errors = validateForm();
  if (Object.keys(errors).length > 0) {
    // Don't proceed — validateForm() already populated validationErrors,
    // and EditTeacherForm renders each one under its corresponding field.
    return;
  }

  performTeacherUpdate(teacher.id);
};

  // ===== FIXED: performTeacherUpdate now saves assignments too =====
  const performTeacherUpdate = async (teacherId) => {
    // CRITICAL: Capture form data BEFORE saveEdit can reset it
    const capturedAssignments = [...(editFormData.assignments || [])];
    const capturedSubjects = [...(editFormData.subjects || [])];
    
    console.log('📝 Captured assignments for save:', capturedAssignments);
    console.log('📝 Captured subjects for save:', capturedSubjects);
    
    try {
      // 1. Update basic teacher info
      const result = await saveEdit(
        teacherId, 
        null, 
        async (id, data) => {
          const updateData = {
            employee_id: data.employee_id,
            first_name: data.first_name,
            middle_name: data.middle_name,
            last_name: data.last_name,
            email_address: data.email_address,
            phone_no: data.phone_no,
            updated_by: user?.id,
            updated_at: new Date().toISOString()
          };
          
          console.log('💾 Updating teacher basic info:', updateData);
          
          // Use the teacherService from the hook's internal state
          // We need to use the hook's update method or create a new service instance
          const { TeacherService } = await import('../../../Utils/EntityService');
          const teacherService = new TeacherService();
          const result = await teacherService.update(id, updateData);
          return result;
        }
      );
      
      if (!result.success) {
        setSaveError(result.error || 'Failed to update teacher');
        setEditModalState('editing');
        return;
      }
      
      // 2. Now handle assignments using captured data
      console.log('📋 Processing assignments:', { capturedAssignments, capturedSubjects });
      
      const subjectIds = capturedSubjects
        .map(row => {
          const subject = allSubjects.find(s => s.code === row.code);
          return subject?.id;
        })
        .filter(Boolean);
      
      console.log('📚 Resolved subject IDs:', subjectIds);
      
      const sectionIds = capturedAssignments
        .map(row => {
          const key = `${row.grade}|${row.section}`;
          return sectionIdMap[key];
        })
        .filter(Boolean);
      
      console.log('🏫 Resolved section IDs:', sectionIds);
      
      const adviserRow = capturedAssignments.find(row => row.isAdviser);
      const adviserSectionId = adviserRow
        ? sectionIdMap[`${adviserRow.grade}|${adviserRow.section}`]
        : null;
      
      console.log('👨‍🏫 Adviser section ID:', adviserSectionId);
      
      // 3. Update teacher assignments using the hook's method
      const assignResult = await updateTeacherAssignmentsViaHook(teacherId, {
        subjectIds,
        sectionIds,
        adviserSectionId
      });
      
      if (!assignResult.success) {
        toastError(assignResult.error || 'Teacher info saved, but assignments failed to update');
        setSaveError(assignResult.error || 'Failed to update assignments');
        setEditModalState('editing');
        return;
      }
      
      // 4. Success!
      success('Teacher updated successfully with assignments');
      
      // 5. Refresh data
      if (refreshTeachers) {
        await refreshTeachers();
      }
      
      // 6. Close modal
      setEditModalState('closed');
      setEditingEntity(null);
      
    } catch (error) {
      console.error('Update error:', error);
      setSaveError(error.message || 'Failed to update teacher');
      setEditModalState('editing');
    }
  };

  const handleInputClick = (e) => e.stopPropagation();

  const handleTeacherSelect = (teacherId, e) => {
    e.stopPropagation();
    
    if (isAllPagesSelected && selectedTeachers.includes(teacherId)) {
      if (onClearAllPages) onClearAllPages();
      return;
    }
    
    const newSelected = selectedTeachers.includes(teacherId)
      ? selectedTeachers.filter(id => id !== teacherId)
      : [...selectedTeachers, teacherId];
    
    if (onSelectedTeachersUpdate) onSelectedTeachersUpdate(newSelected);
  };

  const handleSelectAll = () => {
    const allVisibleTeacherIds = paginatedTeachers.map(t => t.id);
    const allSelected = allVisibleTeacherIds.every(id => selectedTeachers.includes(id));
    
    if (allSelected) {
      const newSelected = selectedTeachers.filter(id => !allVisibleTeacherIds.includes(id));
      if (onSelectedTeachersUpdate) onSelectedTeachersUpdate(newSelected);
      if (newSelected.length === 0 && onClearAllPages) onClearAllPages();
    } else {
      const newSelected = [...new Set([...selectedTeachers, ...allVisibleTeacherIds])];
      if (onSelectedTeachersUpdate) onSelectedTeachersUpdate(newSelected);
    }
  };

  const getTeacherAssignments = (teacherId) => {
    const assignments = teacherAssignments[teacherId] || {};
    const subjects = assignments.subjects?.map(s => String(s.subject?.subject_name || '').trim())
      .filter(name => name && name !== 'Unknown').join(', ') || 'None';

    // Get teaching sections as an array for wrapped display
    const teachingSectionsArray = assignments.teachingAssignments?.map(assignment => {
      const section = assignments.sections?.find(s => s.section_id === assignment.section_id);
      if (section?.section) {
        return `Grade ${section.section.grade?.grade_level || '?'}-${section.section.section_name || '?'}`;
      }
      return '';
    }).filter(Boolean) || [];

    const adviserSection = assignments.sections?.find(s => s.is_adviser);
    const adviserDisplay = adviserSection?.section ? 
      `Grade ${adviserSection.section.grade?.grade_level || '?'}-${adviserSection.section.section_name || '?'}` : 
      'None';

    // Return the array separately so it can be rendered with wrapping
    return { subjects, teachingSectionsArray, teachingSections: teachingSectionsArray.join(', ') || 'None', adviserDisplay };
  };

  const getTeacherFilterData = (teacher) => {
    const assignments = teacherAssignments[teacher.id] || {};
    const sections = (assignments.sections || [])
      .map(s => ({ sectionName: s?.section?.section_name || '', gradeLevel: String(s?.section?.grade?.grade_level || ''), isAdviser: Boolean(s?.is_adviser) }))
      .filter(item => item.sectionName);

    const gradeLevels = [...new Set(sections.map(s => s.gradeLevel).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
    const subjects = [...new Set((assignments.subjects || []).map(s => String(s?.subject?.subject_code || '').trim()).filter(Boolean))];
    const primarySection = sections.find(s => s.isAdviser) || sections[0] || null;

    return { sections, gradeLevels, subjects, primarySection };
  };

  const handleDeactivateClick = async (teacher) => {
    if (!window.confirm(`Deactivate ${teacher.first_name}'s account? They won't be able to login.`)) return;
    try {
      const response = await apiClient.post('/api/teacher-invite/deactivate', {
        teacherId: teacher.id,
        deactivatedBy: user?.id
      });
      const data = response.data;
      if (data.success) {
        setEntities(prev => prev.map(t => t.id === teacher.id ? { ...t, status: 'inactive' } : t));
        success(`Account deactivated: ${teacher.first_name} ${teacher.last_name}`);
        cancelEdit();
      } else {
        toastError(data.error || 'Failed to deactivate account');
      }
    } catch (err) {
      toastError(err.response?.data?.error || 'Error: ' + err.message);
    }
  };

  const handleResendInvitation = async (teacher) => {
    if (!window.confirm(`Resend invitation to ${teacher.first_name}? Old account will be deleted and new invitation sent.`)) return;
    try {
      const response = await apiClient.post('/api/teacher-invite/resend-invitation', {
        teacherId: teacher.id,
        invitedBy: user?.id
      });
      const data = response.data;
      if (data.success) {
        setEntities(prev => prev.map(t => t.id === teacher.id ? { ...t, status: 'pending' } : t));
        success(`Invitation resent to: ${teacher.email_address}`);
        alert(`✅ NEW INVITATION SENT!\n\nTeacher: ${data.teacherName}\nEmail: ${data.email}\nNew Password: ${data.tempPassword}\nLogin: ${data.loginUrl}`);
        cancelEdit();
      } else {
        toastError(data.error || 'Failed to resend invitation');
      }
    } catch (err) {
      toastError(err.response?.data?.error || 'Error: ' + err.message);
    }
  };

  const handleReactivateClick = async (teacher) => {
    if (!window.confirm(`Reactivate ${teacher.first_name}'s account? They will be able to login again.`)) return;
    try {
      const response = await apiClient.post('/api/teacher-invite/reactivate', {
        teacherId: teacher.id,
        reactivatedBy: user?.id
      });
      const data = response.data;
      if (data.success) {
        setEntities(prev => prev.map(t => t.id === teacher.id ? { ...t, status: 'active' } : t));
        success(`Account reactivated: ${teacher.first_name} ${teacher.last_name}`);
        cancelEdit();
      } else {
        toastError(data.error || 'Failed to reactivate account');
      }
    } catch (err) {
      toastError(err.response?.data?.error || 'Error: ' + err.message);
    }
  };

  const handleInviteClick = (teacher, e) => {
    e.stopPropagation();
    if (onSingleInviteClick) {
      onSingleInviteClick(teacher);
    } else {
      if (!teacher.email_address) { toastError('Teacher does not have an email address'); return; }
      if (teacher.status === 'active') { toastError('Teacher already has an active account'); return; }
      if (teacher.status === 'pending') { toastError('Teacher already has a pending invitation'); return; }
      if (teacher.status === 'inactive') { toastError('Teacher account is suspended'); return; }
    }
  };

  const handleDeleteClick = (teacher, e) => {
    if (e) e.stopPropagation();
    if (onSingleDeleteClick) onSingleDeleteClick(teacher);
  };

  const getStatusAction = (teacher) => {
    const status = (teacher.status || '').toLowerCase();

    if (status === 'pending') {
      return {
        label: 'Resend Invite',
        icon: faPaperPlane,
        onClick: () => handleResendInvitation(teacher),
      };
    }

    if (status === 'active') {
      return {
        label: 'Deactivate',
        icon: faUserSlash,
        onClick: () => handleDeactivateClick(teacher),
        variant: 'danger',
      };
    }

    if (status === 'inactive') {
      return {
        label: 'Reactivate',
        icon: faUserCheck,
        onClick: () => handleReactivateClick(teacher),
      };
    }

    return {
      label: 'Invite',
      icon: faPaperPlane,
      onClick: (e) => handleInviteClick(teacher, e),
      disabled: !teacher.email_address,
    };
  };

  const renderStatusBadge = (status) => {
    if (!status || status.trim() === '') {
      return <span className={styles.statusBadge} style={{ backgroundColor: '#6c757d' }}>No Status</span>;
    }
    const statusConfig = {
      'pending': { color: '#f59e0b', label: 'Pending' },
      'active': { color: '#10b981', label: 'Active' },
      'inactive': { color: '#ef4444', label: 'Inactive' },
      'invited': { color: '#8b5cf6', label: 'Invited' }
    };
    const config = statusConfig[status.toLowerCase()] || { color: '#6c757d', label: status };
    return <span className={styles.statusBadge} style={{ backgroundColor: config.color }}>{config.label}</span>;
  };

  const renderField = (teacher, fieldName) => {
    if (fieldName === 'status') return renderStatusBadge(teacher.status);
    // email_address and phone_no now render in the dedicated CONTACT column
    if (fieldName === 'email_address' || fieldName === 'phone_no') {
      return formatNA(teacher[fieldName]);
    }
    return teacher[fieldName] || '';
  };

  const renderExpandedRow = (teacher) => {
    const addedAt = formatDateTimeLocal(teacher.created_at);
    const updatedAt = teacher.updated_at ? formatDateTimeLocal(teacher.updated_at) : 'Never updated';
    const invitedAt = teacher.invited_at ? formatDateTimeLocal(teacher.invited_at) : 'Not invited';

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

    const updatedByName = teacher.updated_by 
      ? (teacher.updated_by_user 
          ? `${teacher.updated_by_user.first_name || ''} ${teacher.updated_by_user.last_name || ''}`.trim() || 
            teacher.updated_by_user.username || teacher.updated_by_user.email || 'User'
          : (currentUserId && teacher.updated_by === currentUserId ? currentUserName : 'User')
        )
      : 'Not yet updated';

    const assignments = getTeacherAssignments(teacher.id);

    const formatStatusText = (status) => {
      if (!status) return 'No Status';
      const statusMap = { 'pending': 'Pending', 'active': 'Active', 'inactive': 'Inactive', 'invited': 'Invited' };
      return statusMap[status.toLowerCase()] || status.charAt(0).toUpperCase() + status.slice(1);
    };

    return (
      <div 
        className={`${styles.teacherCard} ${styles.expandableCard}`} 
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
          {renderProfileCircle(teacher, styles.profileLarge)}

          <div className={styles.cardBody}>
            <div className={styles.teacherHeader}>{formatTeacherName(teacher)}</div>
            <div className={styles.details}>
              <div>
                <div className={styles.teacherInfo}><strong>Teacher Details</strong></div>
                <div className={styles.teacherInfo}>Employee ID: {teacher.employee_id}</div>
                <div className={styles.teacherInfo}>Full Name: {formatTeacherName(teacher)}</div>
                <div className={styles.teacherInfo}>Email: {formatNA(teacher.email_address)}</div>
                <div className={styles.teacherInfo}>Phone: {formatNA(teacher.phone_no)}</div>
                <div className={styles.teacherInfo}>Status: {formatStatusText(teacher.status)}</div>
              </div>
              <div>
                <div className={styles.teacherInfo}><strong>Teaching Assignments</strong></div>
                <div className={styles.teacherInfo}>Subjects: {assignments.subjects}</div>
                <div className={styles.teacherInfo}>
                  Teaching Sections:{' '}
                  <span className={styles.teachingSectionsContainer}>
                    {assignments.teachingSectionsArray.length > 0 ? (
                      assignments.teachingSectionsArray.map((section, index) => (
                        <React.Fragment key={index}>
                          {index > 0 && ', '}
                          <span className={styles.sectionItem}>{section}</span>
                          {/* Add line break after every 3 sections for visual grouping */}
                          {(index + 1) % 3 === 0 && index < assignments.teachingSectionsArray.length - 1 && (
                            <br />
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      'None'
                    )}
                  </span>
                </div>
                <div className={styles.teacherInfo}>Adviser Section: {assignments.adviserDisplay}</div>
              </div>
              <div>
                <div className={styles.teacherInfo}><strong>Record Information</strong></div>
                {teacher.status === 'pending' && <div className={styles.teacherInfo}>Invitation Sent: {invitedAt}</div>}
                <div className={styles.teacherInfo}>Added: {addedAt}</div>
                <div className={styles.teacherInfo}>Last Updated: {updatedAt}</div>
                <div className={styles.teacherInfo}>
                  Last Updated By: {updatedByName}
                  {teacher.updated_by && teacher.updated_by_user && (
                    <span style={{ color: '#666', fontSize: '0.9em', marginLeft: '8px' }}>
                      ({teacher.updated_by_user.username || teacher.updated_by_user.email})
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

  const withColumnWidth = (width, minWidth) => ({ width, minWidth: `${minWidth}px` });

  // ===== UPDATED COLUMNS: Replaced profile/employee_id/first_name/last_name/email_address with teacher + contact =====
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
            checked={allOnPageSelected}
            onChange={handleSelectAll}
          />
        </div>
      ),
      renderCell: ({ row }) => {
        const isSelected = selectedTeachers.includes(row.id);
        return (
          <div className={styles.checkboxWrapper}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={isSelected}
              onChange={(e) => handleTeacherSelect(row.id, e)}
            />
          </div>
        );
      }
    },
    {
      key: 'teacher',
      label: 'TEACHER',
      headerStyle: withColumnWidth('26%', 200),
      cellStyle: withColumnWidth('26%', 200),
      renderCell: ({ row }) => (
        <div className={styles.teacherCell}>
          {renderProfileCircle(row, styles.profileSmall)}
          <div className={styles.teacherCellText}>
            <div className={styles.teacherCellName}>
              {formatTeacherName(row)}
            </div>
            <div className={styles.teacherCellId}>
              ID: {row.employee_id}
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'contact',
      label: 'CONTACT',
      headerStyle: { ...withColumnWidth('18%', 160), textAlign: 'left' },
      cellStyle: { ...withColumnWidth('18%', 160), textAlign: 'left' },
      renderCell: ({ row }) => (
        <div className={styles.contactCell}>
          <div className={styles.contactRow}>
            <FontAwesomeIcon icon={faEnvelope} className={styles.contactIcon} />
            <span className={styles.contactText}>{formatNA(row.email_address)}</span>
          </div>
          <div className={styles.contactRow}>
            <FontAwesomeIcon icon={faPhone} className={styles.contactIcon} />
            <span className={styles.contactText}>{formatNA(row.phone_no)}</span>
          </div>
        </div>
      )
    },
    {
      key: 'grade', 
      label: 'GRADE', 
      headerStyle: { ...withColumnWidth('8%', 80), textAlign: 'left' },
      cellStyle: { ...withColumnWidth('8%', 80), textAlign: 'left' },
      renderCell: ({ row }) => {
        const teacherData = getTeacherFilterData(row);
        return teacherData.gradeLevels.length > 0 ? teacherData.gradeLevels.join(' | ') : 'N/A';
      }
    },
    {
      key: 'subject', 
      label: 'SUBJECT', 
      headerStyle: { ...withColumnWidth('12%', 130), textAlign: 'left' },
      cellStyle: { ...withColumnWidth('12%', 130), textAlign: 'left' },
      renderHeader: () => (
        <div className={styles.headerWithFilter} style={{ justifyContent: 'flex-start' }}>
          <span>SUBJECT</span>
          <EntityDropdown options={teacherSubjectOptions} selectedValue={selectedSubjectFilter}
            onSelect={(value) => { setSelectedSubjectFilter(value); onPageChange(1); }}
            allLabel="All Subjects" buttonTitle="Filter by subject" />
        </div>
      ),
      renderCell: ({ row }) => {
        const teacherData = getTeacherFilterData(row);
        const subjects = teacherData.subjects;
        if (subjects.length === 0) return 'N/A';
        const displaySubject = selectedSubjectFilter && subjects.includes(selectedSubjectFilter) ? selectedSubjectFilter : subjects[0];
        const remainingCount = Math.max(subjects.length - 1, 0);
        return (
          <div className={styles.entityCellWithBadge} style={{ justifyContent: 'flex-start' }}>
            <span>{displaySubject}</span>
            {remainingCount > 0 && <span className={styles.entityCountBadge} title="Click row to see all subjects">+{remainingCount}</span>}
          </div>
        );
      }
    },
    {
      key: 'section', 
      label: 'SECTION', 
      headerStyle: { ...withColumnWidth('12%', 130), textAlign: 'left' },
      cellStyle: { ...withColumnWidth('12%', 130), textAlign: 'left' },
      renderHeader: () => (
        <div className={styles.headerWithFilter} style={{ justifyContent: 'flex-start' }}>
          <span>SECTION</span>
          <EntityDropdown options={teacherSectionOptions} selectedValue={selectedSectionFilter}
            onSelect={(value) => { setSelectedSectionFilter(value); onPageChange(1); }}
            allLabel="All Sections" buttonTitle="Filter by section" />
        </div>
      ),
      renderCell: ({ row }) => {
        const teacherData = getTeacherFilterData(row);
        const uniqueSections = [...new Set(teacherData.sections.map(item => item.sectionName).filter(Boolean))];
        if (uniqueSections.length === 0) return 'N/A';
        const defaultSection = teacherData.primarySection?.sectionName || uniqueSections[0];
        const displaySection = selectedSectionFilter && uniqueSections.includes(selectedSectionFilter) ? selectedSectionFilter : defaultSection;
        const remainingCount = Math.max(uniqueSections.length - 1, 0);
        return (
          <div className={styles.entityCellWithBadge} style={{ justifyContent: 'flex-start' }}>
            <span>{displaySection}</span>
            {remainingCount > 0 && <span className={styles.entityCountBadge} title="Click row to see all sections">+{remainingCount}</span>}
          </div>
        );
      }
    },
    {
      key: 'status', 
      label: 'STATUS', 
      headerStyle: { ...withColumnWidth('12%', 120), textAlign: 'left' },
      cellStyle: { ...withColumnWidth('12%', 120), textAlign: 'left' },
      renderHeader: () => (
        <div className={styles.headerWithFilter} style={{ justifyContent: 'flex-start' }}>
          <span>STATUS</span>
          <EntityDropdown options={teacherStatusOptions} selectedValue={selectedStatusFilter}
            onSelect={(value) => { setSelectedStatusFilter(value); onPageChange(1); }}
            allLabel="All Statuses" buttonTitle="Filter by status"
            getOptionLabel={(option) => option.label} getOptionValue={(option) => option.value} />
        </div>
      ),
      renderCell: ({ row }) => renderField(row, 'status')
    },
    {
      key: 'actions',
      label: 'ACTIONS',
      headerStyle: { ...withColumnWidth('8%', 100), textAlign: 'left' },
      cellStyle: { ...withColumnWidth('8%', 100), textAlign: 'left' },
      renderCell: ({ row }) => {
        const statusAction = getStatusAction(row);

        return (
          <ActionsMenu
            actions={[
              statusAction,
              {
                label: 'Edit',
                icon: faPenToSquare,
                onClick: (e) => handleEditClick(row, e),
                disabled: editLoadingId === row.id,
              },
              {
                label: 'Delete',
                icon: faTrashCan,
                onClick: (e) => handleDeleteClick(row, e),
                variant: 'danger',
              },
            ]}
          />
        );
      }
    }
  ];

  return (
    <div className={styles.teacherTableContainer} ref={tableRef}>
      <Table
        columns={columns}
        rows={paginatedTeachers}
        getRowId={(row) => row.id}
        loading={loading || loadingAssignments}
        error={error ? `Error: ${error}` : ''}
        emptyMessage={searchTerm ? `No teachers found matching "${searchTerm}"` : 'No teachers found'}
        containerRef={tableRef}
        tableLabel="Teacher records"
        onRowClick={({ row, event }) => handleRowClick(row.id, event)}
        rowClassName={({ row }) => {
          return `${styles.teacherRow}`;
        }}
        isRowSelected={({ row }) => selectedTeachers.includes(row.id)}
        expandedRowId={expandedRow}
        renderExpandedRow={({ row }) => renderExpandedRow(row)}
        persistExpandedRows={true}
        hideMainRowWhenExpanded={true}
        getExpandedRowClassName={({ isExpanded }) => `${styles.expandRow} ${isExpanded ? styles.expandRowActive : ''}`}
        wrapperClassName={styles.tableWrapper}
        infoText={computedInfoText}
        selectedInfoText=""
        headerContent={selectAllBanner}
        paginationContent={paginationContent}
        isAllPagesSelected={isAllPagesSelected}
        visibleSelectedCount={selectedTeachers.length}
        totalRowsOnPage={paginatedTeachers.length}
        gradeTabs={{
          options: teacherGradeOptions,
          currentValue: selectedGrade,
          onChange: (grade) => { setSelectedGrade(grade); onPageChange(1); },
          showAll: true,
          allLabel: 'All',
          renderLabel: (gradeLevel) => `Grade ${gradeLevel}`,
          getOptionValue: (gradeLevel) => String(gradeLevel),
        }}
      />

      {/* ===== EDIT MODAL ===== */}
      <EditEntityFormModal
        isOpen={editModalState === 'editing'}
        onClose={handleCloseModal}
        title="Edit Teacher"
        onSave={handleEditFormSave}
        saving={saving}
        errorMessage={saveError}
      >
        <EditTeacherForm
          formData={editFormData}
          onFieldChange={updateEditField}
          validationErrors={validationErrors}
          gradeSectionsMap={gradeSectionsMap}
          availableSubjects={allSubjects}
          disabled={saving}
        />
      </EditEntityFormModal>
    </div>
  );
};

export default TeacherTable;