// src/components/TeacherTable/TeacherTable.jsx
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useTeachers } from '../../Hooks/useEntities'; 
import { useEntityEdit } from '../../Hooks/useEntityEdit'; 
import { useRowExpansion } from '../../Hooks/useRowExpansion'; 
import { TeacherService } from '../../../Utils/EntityService'; 
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
  faUserCheck
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

  const { entities: teachers, loading, error, setEntities } = useTeachers();
  const [teacherAssignments, setTeacherAssignments] = useState({});
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const fetchAbortRef = useRef(null);
  const fetchTimeoutRef = useRef(null);

  // ===== MODAL STATE MACHINE =====
  // 'closed' | 'editing' | 'confirming'
  const [editModalState, setEditModalState] = useState('closed');
  const [editingEntity, setEditingEntity] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [gradeSectionsMap, setGradeSectionsMap] = useState({});
  const [allSubjects, setAllSubjects] = useState([]);

  const { editingId: editingTeacher, editFormData, saving, validationErrors, startEdit, cancelEdit, updateEditField, saveEdit } = useEntityEdit(
    teachers, setEntities, 'teacher', refreshTeachers
  );

  const { expandedRow, tableRef, toggleRow, isRowExpanded } = useRowExpansion();
  const { success, error: toastError } = useToast();
  const { user, profile } = useAuth();

  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');

  const teacherService = useMemo(() => new TeacherService(), []);
  const filterRef = useRef({ selectedGrade, selectedSubjectFilter, selectedSectionFilter, selectedStatusFilter });

  // ===== FETCH ALL SUBJECTS CATALOG DIRECTLY FROM SUPABASE =====
  useEffect(() => {
    const fetchAllSubjects = async () => {
      try {
        const { data, error } = await supabase
          .from('subjects')
          .select('subject_code, subject_name')
          .order('subject_name');

        if (error) throw error;

        const list = (data || []).map((s) => ({
          code: s.subject_code,
          name: s.subject_name,
        }));
        setAllSubjects(list);
      } catch (err) {
        console.error('Error fetching subject catalog:', err);
      }
    };
    fetchAllSubjects();
  }, []);

  // ===== BUILD GRADE-SECTIONS MAP =====
  useEffect(() => {
    if (sectionsData.length > 0 && gradesData.length > 0) {
      console.log('📋 Building grade-sections map for teachers...');
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
      
      // Sort sections for each grade
      Object.keys(map).forEach(grade => {
        map[grade] = map[grade].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      });
      
      console.log('📋 Teacher grade-sections map:', map);
      setGradeSectionsMap(map);
    }
  }, [gradesData, sectionsData]);

  useEffect(() => {
  console.log('🔍 DEBUG - gradesData:', gradesData);
  console.log('🔍 DEBUG - sectionsData:', sectionsData);
  console.log('🔍 DEBUG - gradeSectionsMap:', gradeSectionsMap);
}, [gradesData, sectionsData, gradeSectionsMap]);

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
      // Clear snapshots when filters change
      setFullySelectedSnapshots(new Map());
      filterRef.current = current;
    }
  }, [selectedGrade, selectedSubjectFilter, selectedSectionFilter, selectedStatusFilter, onPageChange, onClearAllPages]);

  // Debounced fetch assignments
  useEffect(() => {
    if (teachers.length > 0) {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = setTimeout(() => fetchTeacherAssignments(), 300);
    }
    return () => { if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current); };
  }, [teachers]);

  const fetchTeacherAssignments = async () => {
    const currentRun = {};
    fetchAbortRef.current = currentRun;
    setLoadingAssignments(true);

    try {
      const assignments = {};
      for (const teacher of teachers) {
        if (fetchAbortRef.current !== currentRun) return;
        const result = await teacherService.getTeacherAssignments(teacher.id);
        assignments[teacher.id] = {
          subjects: result.subjects || [],
          sections: result.sections || [],
          teachingAssignments: result.assignments || []
        };
      }
      if (fetchAbortRef.current === currentRun) {
        setTeacherAssignments(assignments);
      }
    } catch (error) {
      console.error('Error fetching teacher assignments:', error);
    } finally {
      if (fetchAbortRef.current === currentRun) setLoadingAssignments(false);
    }
  };

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

  const recordCountMessage = useMemo(() => {
    const count = sortedTeachers.length;
    const phrases = [];
    if (selectedSectionFilter) phrases.push(`in Section ${selectedSectionFilter}`);
    if (selectedSubjectFilter) phrases.push(`teaching ${selectedSubjectFilter}`);
    if (selectedStatusFilter) phrases.push(`with ${selectedStatusFilter.charAt(0).toUpperCase() + selectedStatusFilter.slice(1).toLowerCase()} status`);
    if (selectedGrade !== 'all') phrases.push(`in Grade ${selectedGrade}`);
    else phrases.push('across all grades');
    return `Showing ${count} teacher/s ${phrases.join(' ')}`;
  }, [sortedTeachers.length, selectedSectionFilter, selectedSubjectFilter, selectedStatusFilter, selectedGrade]);

  const allOnPageSelected = paginatedTeachers.length > 0 &&
    paginatedTeachers.every(teacher => selectedTeachers.includes(teacher.id));

  // ===== SNAPSHOT-BASED BANNER PERSISTENCE (mirroring StudentTable) =====
  // Effect 1: capture a snapshot whenever the CURRENT page becomes fully selected.
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

  // Effect 2: prune any snapshot that's no longer fully selected.
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

  // Pure derived value: is any page's snapshot still fully intact?
  const hasTriggeredSelectAll = useMemo(() => {
    return fullySelectedSnapshots.size > 0;
  }, [fullySelectedSnapshots]);

  const computedInfoText = (() => {
    if (selectedTeachers.length === sortedTeachers.length && sortedTeachers.length > 0)
      return `All ${sortedTeachers.length} teachers selected`;
    if (selectedTeachers.length > 0) return `${selectedTeachers.length} teacher/s selected`;
    return '';
  })();

  // ===== UPDATED: selectAllBanner with snapshot-based logic (mirroring StudentTable) =====
  const selectAllBanner = (() => {
    const hasAnyPageFullySelected = hasTriggeredSelectAll;
    const allPagesSelected = selectedTeachers.length === sortedTeachers.length && sortedTeachers.length > 0;
    const hasMorePages = sortedTeachers.length > paginatedTeachers.length;

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
  const buildTeacherEditData = (teacher) => {
    const assignmentsData = teacherAssignments[teacher.id] || {};

    const assignments = (assignmentsData.sections || [])
      .map((s) => ({
        id: `existing-${s.section_id ?? s.section?.id ?? Math.random()}`,
        grade: String(s.section?.grade?.grade_level ?? ''),
        section: s.section?.section_name || '',
        isAdviser: Boolean(s.is_adviser),
      }))
      .filter((row) => row.grade && row.section);

    // Subjects are now row objects (matching assignment rows), not plain code strings.
    const subjects = (assignmentsData.subjects || [])
      .map((s) => ({
        id: `existing-${s.subject_id ?? Math.random()}`,
        code: s.subject?.subject_code || '',
      }))
      .filter((row) => row.code);

    return { ...teacher, assignments, subjects };
  };

  // ===== UPDATED: Open modal instead of inline edit =====
  const handleEditClick = (teacher, e) => {
    e.stopPropagation();
    
    console.log('✏️ Opening edit modal for teacher:', {
      id: teacher.id,
      name: `${teacher.first_name} ${teacher.last_name}`
    });
    
    const teacherForEdit = buildTeacherEditData(teacher);
    
    startEdit(teacherForEdit);
    setEditingEntity(teacher);
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

  // ===== HANDLE SAVE FROM MODAL =====
  const handleEditFormSave = () => {
    const teacher = editingEntity;
    if (!teacher) return;
    
    setSaveError('');
    
    // Validate required fields
    if (!editFormData.first_name || !editFormData.last_name) {
      setSaveError('First name and last name are required');
      return;
    }

    // For teachers, we don't have the same critical fields check as students
    // But we still want to update the teacher
    performTeacherUpdate(teacher.id);
  };

  const performTeacherUpdate = async (teacherId) => {
    try {
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
          
          console.log('💾 Updating teacher:', updateData);
          
          const result = await teacherService.update(id, updateData);
          return result;
        }
      );
      
      if (result.success) {
        success('Teacher updated successfully');
        if (refreshTeachers) {
          await refreshTeachers();
        }
        // Close everything on success
        setEditModalState('closed');
        setEditingEntity(null);
      }
      
    } catch (error) {
      console.error('Update error:', error);
      setSaveError(error.message || 'Failed to update teacher');
      // Stay in editing state so user can fix and retry
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

    const teachingSections = assignments.teachingAssignments?.map(assignment => {
      const section = assignments.sections?.find(s => s.section_id === assignment.section_id);
      if (section?.section) {
        return `Grade ${section.section.grade?.grade_level || '?'}-${section.section.section_name || '?'}`;
      }
      return '';
    }).filter(Boolean).join(', ') || 'None';

    const adviserSection = assignments.sections?.find(s => s.is_adviser);
    const adviserDisplay = adviserSection?.section ? 
      `Grade ${adviserSection.section.grade?.grade_level || '?'}-${adviserSection.section.section_name || '?'}` : 
      'None';

    return { subjects, teachingSections, adviserDisplay };
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

  // ===== HELPER: Get status-based action for ActionsMenu =====
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

    // No status / anything else -> plain Invite
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

  // ===== UPDATED: renderField now only shows display values (no inline editing) =====
  const renderField = (teacher, fieldName) => {
    if (fieldName === 'status') return renderStatusBadge(teacher.status);
    if (fieldName === 'email_address' || fieldName === 'phone_no') {
      return formatNA(teacher[fieldName]);
    }
    return teacher[fieldName] || '';
  };

  // ===== RENDER EXPANDED ROW WITH PROFILE =====
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
                <div className={styles.teacherInfo}>Teaching Sections: {assignments.teachingSections}</div>
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
    { key: 'employee_id', label: 'EMPLOYEE ID', headerStyle: withColumnWidth('10%', 100), cellStyle: withColumnWidth('10%', 100), renderCell: ({ row }) => renderField(row, 'employee_id') },
    { key: 'first_name', label: 'FIRST NAME', headerStyle: withColumnWidth('10%', 100), cellStyle: withColumnWidth('10%', 100), renderCell: ({ row }) => renderField(row, 'first_name') },
    { key: 'last_name', label: 'LAST NAME', headerStyle: withColumnWidth('10%', 100), cellStyle: withColumnWidth('10%', 100), renderCell: ({ row }) => renderField(row, 'last_name') },
    { key: 'email_address', label: 'EMAIL ADDRESS', headerStyle: withColumnWidth('10%', 100), cellStyle: withColumnWidth('10%', 100), renderCell: ({ row }) => renderField(row, 'email_address') },
    {
      key: 'grade', label: 'GRADE', headerStyle: withColumnWidth('8%', 90), cellStyle: withColumnWidth('8%', 90),
      renderCell: ({ row }) => {
        const teacherData = getTeacherFilterData(row);
        return teacherData.gradeLevels.length > 0 ? teacherData.gradeLevels.join(' | ') : 'N/A';
      }
    },
    {
      key: 'subject', label: 'SUBJECT', headerStyle: withColumnWidth('12%', 130), cellStyle: withColumnWidth('12%', 130),
      renderHeader: () => (
        <div className={styles.headerWithFilter}>
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
          <div className={styles.entityCellWithBadge}>
            <span>{displaySubject}</span>
            {remainingCount > 0 && <span className={styles.entityCountBadge} title="Click row to see all subjects">+{remainingCount}</span>}
          </div>
        );
      }
    },
    {
      key: 'section', label: 'SECTION', headerStyle: withColumnWidth('12%', 130), cellStyle: withColumnWidth('12%', 130),
      renderHeader: () => (
        <div className={styles.headerWithFilter}>
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
          <div className={styles.entityCellWithBadge}>
            <span>{displaySection}</span>
            {remainingCount > 0 && <span className={styles.entityCountBadge} title="Click row to see all sections">+{remainingCount}</span>}
          </div>
        );
      }
    },
    {
      key: 'status', label: 'STATUS', headerStyle: withColumnWidth('12%', 120), cellStyle: withColumnWidth('12%', 120),
      renderHeader: () => (
        <div className={styles.headerWithFilter}>
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
      headerStyle: withColumnWidth('10%', 100),
      cellStyle: withColumnWidth('10%', 100),
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

      {/* ===== EDIT MODAL - only open when in 'editing' state ===== */}
      <EditEntityFormModal
        isOpen={editModalState === 'editing'}
        onClose={handleCloseModal}
        title="Edit Teacher"
        onSave={handleEditFormSave}
        saving={saving}
        errorMessage={saveError}
      >
        <EditTeacherForm
          teacher={editingEntity}
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