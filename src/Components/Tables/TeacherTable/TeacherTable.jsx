import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useTeachers } from '../../Hooks/useEntities'; 
import { useEntityEdit } from '../../Hooks/useEntityEdit'; 
import { useRowExpansion } from '../../Hooks/useRowExpansion'; 
import { TeacherService } from '../../../Utils/EntityService'; 
import { sortTeachers } from '../../../Utils/SortEntities'; 
import { formatTeacherName, formatDateTime, formatNA } from '../../../Utils/Formatters';
import styles from './TeacherTable.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle as farCircle } from "@fortawesome/free-regular-svg-icons";
import { faPenToSquare, faTrashCan, faCircle as fasCircle, faPlus } from "@fortawesome/free-solid-svg-icons";
import ForwardToInboxIcon from '@mui/icons-material/ForwardToInbox';
import { useToast } from '../../Toast/ToastContext/ToastContext';
import { useAuth } from '../../Authentication/AuthProvider/AuthProvider';
import Table from '../Table/Table';
import EntityDropdown from '../../UI/Buttons/EntityDropdown/EntityDropdown';
import Pagination from '../../../Components/UI/Buttons/Pagination/Pagination.jsx';

console.log('🔄 TeacherTable.jsx LOADED - Updated with pagination');

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
  // NEW: Cross-page selection props
  isAllPagesSelected = false,
  onSelectAllPages = () => {},
  onClearAllPages = () => {},
  onFilteredTeachersUpdate = () => {},
}) => {

  const { entities: teachers, loading, error, setEntities } = useTeachers();
  const [teacherAssignments, setTeacherAssignments] = useState({});
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  const { editingId: editingTeacher, editFormData, saving, validationErrors, startEdit, cancelEdit, updateEditField, saveEdit } = useEntityEdit(
    teachers, 
    setEntities,
    'teacher',
    refreshTeachers
  );

  const { expandedRow, tableRef, toggleRow, isRowExpanded } = useRowExpansion();

  const { success, error: toastError } = useToast();
  const { user, profile } = useAuth();
  const [selectedTeachers, setSelectedTeachers] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');

  const teacherService = useMemo(() => new TeacherService(), []);

  // Reset page when internal filters change
  const filterRef = useRef({ selectedGrade, selectedSubjectFilter, selectedSectionFilter, selectedStatusFilter });

  useEffect(() => {
    const current = { selectedGrade, selectedSubjectFilter, selectedSectionFilter, selectedStatusFilter };
    const prev = filterRef.current;

    const changed = prev.selectedGrade !== current.selectedGrade ||
      prev.selectedSubjectFilter !== current.selectedSubjectFilter ||
      prev.selectedSectionFilter !== current.selectedSectionFilter ||
      prev.selectedStatusFilter !== current.selectedStatusFilter;

    if (changed) {
      onPageChange(1);
      onClearAllPages(); // Clear cross-page selection when filters change
      filterRef.current = current;
    }
  }, [selectedGrade, selectedSubjectFilter, selectedSectionFilter, selectedStatusFilter, onPageChange, onClearAllPages]);

  useEffect(() => {
    if (teachers.length > 0) {
      fetchTeacherAssignments();
    }
  }, [teachers]);

  const fetchTeacherAssignments = async () => {
    setLoadingAssignments(true);
    try {
      const assignments = {};

      for (const teacher of teachers) {
        console.log(`📊 Fetching assignments for teacher ${teacher.id}: ${teacher.first_name} ${teacher.last_name}`);
        const result = await teacherService.getTeacherAssignments(teacher.id);

        assignments[teacher.id] = {
          subjects: result.subjects || [],
          sections: result.sections || [],
          teachingAssignments: result.assignments || []
        };
      }

      setTeacherAssignments(assignments);
      console.log('📊 All teacher assignments loaded:', assignments);
    } catch (error) {
      console.error('Error fetching teacher assignments:', error);
    } finally {
      setLoadingAssignments(false);
    }
  };

  useEffect(() => {
    if (onTeacherDataUpdate) {
      onTeacherDataUpdate(teachers);
    }
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
      .flatMap((assignment) => (assignment.sections || []).map((sectionEntry) => sectionEntry?.section?.grade?.grade_level))
      .filter((gradeLevel) => gradeLevel !== null && gradeLevel !== undefined && gradeLevel !== '');

    return [...new Set(allGrades.map((gradeLevel) => String(gradeLevel)))].sort((a, b) => Number(a) - Number(b));
  }, [teacherAssignments]);

  const teacherSubjectOptions = useMemo(() => {
    const allSubjects = Object.values(teacherAssignments)
      .flatMap((assignment) => (assignment.subjects || []).map((subjectEntry) => subjectEntry?.subject?.subject_code || ''))
      .filter(Boolean);

    return [...new Set(allSubjects)].sort((a, b) => a.localeCompare(b));
  }, [teacherAssignments]);

  const teacherSectionOptions = useMemo(() => {
    const allSections = Object.values(teacherAssignments)
      .flatMap((assignment) => (assignment.sections || []).map((sectionEntry) => sectionEntry?.section?.section_name))
      .filter(Boolean);

    return [...new Set(allSections)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [teacherAssignments]);

  const teacherStatusOptions = useMemo(() => {
    const statusesFromData = teachers
      .map((teacher) => String(teacher.status || '').trim())
      .filter(Boolean);

    const schemaStatuses = ['pending', 'active', 'inactive'];
    const statuses = [...schemaStatuses, ...statusesFromData];

    return [...new Set(statuses)]
      .sort((a, b) => a.localeCompare(b))
      .map((status) => ({
        label: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase(),
        value: status.toLowerCase(),
      }));
  }, [teachers]);

  const filteredTeachers = useMemo(() => {
    return searchFilteredTeachers.filter((teacher) => {
      const assignments = teacherAssignments[teacher.id] || {};
      const gradeLevels = (assignments.sections || [])
        .map((sectionEntry) => String(sectionEntry?.section?.grade?.grade_level || ''))
        .filter(Boolean);
      const sectionNames = (assignments.sections || [])
        .map((sectionEntry) => sectionEntry?.section?.section_name || '')
        .filter(Boolean);
      const subjectNames = (assignments.subjects || [])
        .map((subjectEntry) => String(subjectEntry?.subject?.subject_code || '').trim())
        .filter(Boolean);

      if (selectedGrade !== 'all' && !gradeLevels.includes(String(selectedGrade))) {
        return false;
      }

      if (selectedSectionFilter && !sectionNames.includes(selectedSectionFilter)) {
        return false;
      }

      if (selectedSubjectFilter && !subjectNames.includes(selectedSubjectFilter)) {
        return false;
      }

      if (selectedStatusFilter && String(teacher.status || '').toLowerCase() !== selectedStatusFilter.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [searchFilteredTeachers, teacherAssignments, selectedGrade, selectedSectionFilter, selectedSubjectFilter, selectedStatusFilter]);

  const sortedTeachers = useMemo(() => sortTeachers(filteredTeachers), [filteredTeachers]);

  // Notify parent of full filtered list (for "Select all pages")
  useEffect(() => {
    if (onFilteredTeachersUpdate) {
      onFilteredTeachersUpdate(sortedTeachers);
    }
  }, [sortedTeachers, onFilteredTeachersUpdate]);

  // PAGINATION
  const totalPages = Math.ceil(sortedTeachers.length / rowsPerPage);

  const paginatedTeachers = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedTeachers.slice(start, start + rowsPerPage);
  }, [sortedTeachers, currentPage, rowsPerPage]);

  const paginationContent = sortedTeachers.length > 0 ? (
    <Pagination
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
    />
  ) : null;

  const recordCountMessage = useMemo(() => {
    const count = sortedTeachers.length;
    const phrases = [];

    if (selectedSectionFilter) {
      phrases.push(`in Section ${selectedSectionFilter}`);
    }

    if (selectedSubjectFilter) {
      phrases.push(`teaching ${selectedSubjectFilter}`);
    }

    if (selectedStatusFilter) {
      const prettyStatus = selectedStatusFilter.charAt(0).toUpperCase() + selectedStatusFilter.slice(1).toLowerCase();
      phrases.push(`with ${prettyStatus} status`);
    }

    if (selectedGrade !== 'all') {
      phrases.push(`in Grade ${selectedGrade}`);
    } else {
      phrases.push('across all grades');
    }

    return `Showing ${count} teacher/s ${phrases.join(' ')}`;
  }, [sortedTeachers.length, selectedSectionFilter, selectedSubjectFilter, selectedStatusFilter, selectedGrade]);

  // Selection based on paginated (visible) rows
  const visibleSelectedTeachers = useMemo(() => {
    const visibleTeacherIds = new Set(paginatedTeachers.map(teacher => teacher.id));
    return selectedTeachers.filter(id => visibleTeacherIds.has(id));
  }, [selectedTeachers, paginatedTeachers]);

  useEffect(() => {
    if (onSelectedTeachersUpdate) {
      onSelectedTeachersUpdate(visibleSelectedTeachers);
    }
  }, [visibleSelectedTeachers, onSelectedTeachersUpdate]);

  // ===== NEW: Computed info text (matches StudentTable) =====
  const allOnPageSelected = paginatedTeachers.length > 0 &&
    paginatedTeachers.every(teacher => selectedTeachers.includes(teacher.id));

  const computedInfoText = (() => {
    if (isAllPagesSelected) return `All ${sortedTeachers.length} teachers selected`;
    if (allOnPageSelected) return `Selected all ${paginatedTeachers.length} teacher/s • Page ${currentPage}`;
    if (visibleSelectedTeachers.length > 0) return `${visibleSelectedTeachers.length} selected • Page ${currentPage}`;
    return '';
  })();

  // ===== NEW: Select-all banner buttons (matches StudentTable) =====
  const selectAllBanner = (() => {
    if (isAllPagesSelected) {
      return (
        <button
          onClick={onClearAllPages}
          onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
          onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}
          style={{ 
            background: '#2563eb', 
            border: '1px solid #2563eb', 
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
    if (allOnPageSelected && sortedTeachers.length > paginatedTeachers.length) {
      return (
        <button
          onClick={onSelectAllPages}
          onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
          onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}
          style={{ 
            background: '#0EA5E9', 
            border: '1px solid #0EA5E9', 
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

  const shouldHandleRowClick = (editingId, target) => {
    return !editingId || 
           target.closest('.action-button') || 
           target.closest('input') || 
           target.closest('select') ||
           target.closest('button');
  };

  const handleRowClick = (teacherId, e) => {
    if (shouldHandleRowClick(editingTeacher, e.target)) {
      toggleRow(teacherId);
    }
  };

  const handleEditClick = (teacher, e) => {
    e.stopPropagation();
    startEdit(teacher);
    toggleRow(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    updateEditField(name, value);
  };

  const handleInputClick = (e) => {
    e.stopPropagation();
  };

  const handleSaveEdit = async (teacherId, e) => {
    if (e) e.stopPropagation();

    const result = await saveEdit(
      teacherId, 
      null,
      (id, data) => teacherService.update(id, {
        ...data,
        updated_by: user?.id,
        updated_at: new Date().toISOString()
      })
    );

    if (result.success) {
      success('Teacher information updated successfully');
      if (refreshTeachers) {
        refreshTeachers();
      }
    } else {
      console.error(result.error);
    }
  };

  const handleTeacherSelect = (teacherId, e) => {
    e.stopPropagation();
    setSelectedTeachers(prev => {
      if (prev.includes(teacherId)) {
        return prev.filter(id => id !== teacherId);
      } else {
        return [...prev, teacherId];
      }
    });
  };

  const handleSelectAll = () => {
    const allVisibleTeacherIds = paginatedTeachers.map(teacher => teacher.id);

    if (allVisibleTeacherIds.every(id => selectedTeachers.includes(id))) {
      setSelectedTeachers(prev => prev.filter(id => !allVisibleTeacherIds.includes(id)));
      if (onClearAllPages) onClearAllPages();
    } else {
      setSelectedTeachers(prev => {
        const newSelection = new Set([...prev, ...allVisibleTeacherIds]);
        return Array.from(newSelection);
      });
    }
  };

  const getTeacherAssignments = (teacherId) => {
    const assignments = teacherAssignments[teacherId] || {};

    const subjects = assignments.subjects?.map(s => 
      String(s.subject?.subject_name || '').trim()
    ).filter(name => name && name !== 'Unknown').join(', ') || 'None';

    const teachingSections = assignments.teachingAssignments?.map(assignment => {
      const section = assignments.sections?.find(s => s.section_id === assignment.section_id);
      if (section && section.section) {
        return `Grade ${section.section.grade?.grade_level || '?'}-${section.section.section_name || '?'}`;
      }
      return '';
    }).filter(s => s).join(', ') || 'None';

    const adviserSection = assignments.sections?.find(s => s.is_adviser);
    const adviserDisplay = adviserSection && adviserSection.section ? 
      `Grade ${adviserSection.section.grade?.grade_level || '?'}-${adviserSection.section.section_name || '?'}` : 
      'None';

    return { subjects, teachingSections, adviserDisplay };
  };

  const getTeacherFilterData = (teacher) => {
    const assignments = teacherAssignments[teacher.id] || {};

    const sections = (assignments.sections || [])
      .map((sectionEntry) => ({
        sectionName: sectionEntry?.section?.section_name || '',
        gradeLevel: String(sectionEntry?.section?.grade?.grade_level || ''),
        isAdviser: Boolean(sectionEntry?.is_adviser)
      }))
      .filter((item) => item.sectionName);

    const gradeLevels = [...new Set(sections
      .map((item) => item.gradeLevel)
      .filter(Boolean))]
      .sort((a, b) => Number(a) - Number(b));

    const subjects = [...new Set((assignments.subjects || [])
      .map((subjectEntry) => String(subjectEntry?.subject?.subject_code || '').trim())
      .filter(Boolean))];

    const primarySection = sections.find((section) => section.isAdviser) || sections[0] || null;

    return {
      sections,
      gradeLevels,
      subjects,
      primarySection
    };
  };

  const handleDeactivateClick = async (teacher) => {
    if (!window.confirm(`Deactivate ${teacher.first_name}'s account? They won't be able to login.`)) {
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/teacher-invite/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          teacherId: teacher.id, 
          deactivatedBy: user?.id 
        }),
      });

      const data = await response.json();

      if (data.success) {
        setEntities(prev => prev.map(t => 
          t.id === teacher.id ? { ...t, status: 'inactive' } : t
        ));

        success(`Account deactivated: ${teacher.first_name} ${teacher.last_name}`);
        cancelEdit();
      } else {
        toastError(data.error || 'Failed to deactivate account');
      }
    } catch (err) {
      toastError('Error: ' + err.message);
    }
  };

  const handleResendInvitation = async (teacher) => {
    if (!window.confirm(`Resend invitation to ${teacher.first_name}? Old account will be deleted and new invitation sent.`)) {
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/teacher-invite/resend-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          teacherId: teacher.id, 
          invitedBy: user?.id 
        }),
      });

      const data = await response.json();

      if (data.success) {
        setEntities(prev => prev.map(t => 
          t.id === teacher.id ? { ...t, status: 'pending' } : t
        ));

        success(`Invitation resent to: ${teacher.email_address}`);

        alert(
          `✅ NEW INVITATION SENT!\n\n` +
          `Teacher: ${data.teacherName}\n` +
          `Email: ${data.email}\n` +
          `New Password: ${data.tempPassword}\n` +
          `Login: ${data.loginUrl}`
        );
        cancelEdit();
      } else {
        toastError(data.error || 'Failed to resend invitation');
      }
    } catch (err) {
      toastError('Error: ' + err.message);
    }
  };

  const handleReactivateClick = async (teacher) => {
    if (!window.confirm(`Reactivate ${teacher.first_name}'s account? They will be able to login again.`)) {
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/teacher-invite/reactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          teacherId: teacher.id, 
          reactivatedBy: user?.id 
        }),
      });

      const data = await response.json();

      if (data.success) {
        setEntities(prev => prev.map(t => 
          t.id === teacher.id ? { ...t, status: 'active' } : t
        ));

        success(`Account reactivated: ${teacher.first_name} ${teacher.last_name}`);
        cancelEdit();
      } else {
        toastError(data.error || 'Failed to reactivate account');
      }
    } catch (err) {
      toastError('Error: ' + err.message);
    }
  };

  const handleInviteClick = (teacher, e) => {
    e.stopPropagation();

    if (onSingleInviteClick) {
      onSingleInviteClick(teacher);
    } else {
      if (!teacher.email_address) {
        toastError('Teacher does not have an email address');
        return;
      }

      if (teacher.status === 'active') {
        toastError('Teacher already has an active account');
        return;
      }

      if (teacher.status === 'pending') {
        toastError('Teacher already has a pending invitation');
        return;
      }

      if (teacher.status === 'inactive') {
        toastError('Teacher account is suspended');
        return;
      }
    }
  };

  const handleDeleteClick = (teacher, e) => {
    if (e) e.stopPropagation();

    if (onSingleDeleteClick) {
      onSingleDeleteClick(teacher);
    }
  };

  const renderEditInput = (fieldName, type = 'text') => (
    <input
      type={type}
      name={fieldName}
      value={editFormData[fieldName] || ''}
      onChange={handleInputChange}
      onClick={handleInputClick}
      className={`${styles.editInput} ${validationErrors[fieldName] ? styles.errorInput : ''} edit-input`}
    />
  );

  const renderStatusField = (teacher) => {
    if (editingTeacher !== teacher.id) {
      return renderStatusBadge(teacher.status);
    }

    const currentStatus = editFormData.status || teacher.status;

    if (currentStatus === 'active') {
      return (
        <button 
          className={styles.deactivateButton}
          onClick={(e) => {
            e.stopPropagation();
            handleDeactivateClick(teacher);
          }}
          title="Deactivate account"
        >
          Deactivate
        </button>
      );
    }

    if (currentStatus === 'pending') {
      return (
        <button 
          className={styles.resendButton}
          onClick={(e) => {
            e.stopPropagation();
            handleResendInvitation(teacher);
          }}
          title="Resend invitation"
        >
          Resend
        </button>
      );
    }

    if (currentStatus === 'inactive') {
      return (
        <button 
          className={styles.reactivateButton}
          onClick={(e) => {
            e.stopPropagation();
            handleReactivateClick(teacher);
          }}
          title="Reactivate account"
        >
          Reactivate
        </button>
      );
    }

    return renderStatusBadge(currentStatus);
  };

  const renderField = (teacher, fieldName, isEditable = true) => {
    if (fieldName === 'status') {
      return renderStatusField(teacher);
    }

    if (editingTeacher === teacher.id && isEditable) {
      return renderEditInput(fieldName, fieldName === 'email_address' ? 'email' : 'text');
    }

    return fieldName === 'email_address' || fieldName === 'phone_no'
      ? formatNA(teacher[fieldName])
      : teacher[fieldName];
  };

  const renderStatusBadge = (status) => {
    if (!status || status.trim() === '') {
      return (
        <span className={styles.statusBadge} style={{ backgroundColor: '#6c757d' }}>
          No Status
        </span>
      );
    }

    const statusConfig = {
      'pending': { color: '#f59e0b', label: 'Pending' },
      'active': { color: '#10b981', label: 'Active' },
      'inactive': { color: '#ef4444', label: 'Inactive' },
      'invited': { color: '#8b5cf6', label: 'Invited' }
    };

    const config = statusConfig[status.toLowerCase()] || { color: '#6c757d', label: status };

    return (
      <span 
        className={styles.statusBadge}
        style={{ backgroundColor: config.color }}
      >
        {config.label}
      </span>
    );
  };

  const renderEditCell = (teacher) => (
    <div className={styles.editCell}>
      {editingTeacher === teacher.id ? (
        <div className={`${styles.editActions} action-button`}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleSaveEdit(teacher.id, e);
            }}
            disabled={saving}
            className={styles.saveBtn}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              cancelEdit();
            }}
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
            onClick={(e) => handleEditClick(teacher, e)}
            className="action-button"
          />
        </div>
      )}
    </div>
  );

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
            teacher.updated_by_user.username || 
            teacher.updated_by_user.email || 
            'User'
          : (currentUserId && teacher.updated_by === currentUserId ? currentUserName : 'User')
        )
      : 'Not yet updated';

    const assignments = getTeacherAssignments(teacher.id);

    const formatStatusText = (status) => {
      if (!status) return 'No Status';
      const statusMap = {
        'pending': 'Pending',
        'active': 'Active',
        'inactive': 'Inactive',
        'invited': 'Invited'
      };
      return statusMap[status.toLowerCase()] || status.charAt(0).toUpperCase() + status.slice(1);
    };

    return (
      <div 
        className={`${styles.studentCard} ${styles.expandableCard}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.studentHeader}>
          {formatTeacherName(teacher)}
        </div>

        <div className={styles.details}>
          <div>
            <div className={styles.studentInfo}>
              <strong>Teacher Details</strong>
            </div>
            <div className={styles.studentInfo}>Employee ID: {teacher.employee_id}</div>
            <div className={styles.studentInfo}>Full Name: {formatTeacherName(teacher)}</div>
            <div className={styles.studentInfo}>Email: {formatNA(teacher.email_address)}</div>
            <div className={styles.studentInfo}>Phone: {formatNA(teacher.phone_no)}</div>
            <div className={styles.studentInfo}>Status: {formatStatusText(teacher.status)}</div>
          </div>

          <div>
            <div className={styles.studentInfo}>
              <strong>Teaching Assignments</strong>
            </div>
            <div className={styles.studentInfo}>Subjects: {assignments.subjects}</div>
            <div className={styles.studentInfo}>Teaching Sections: {assignments.teachingSections}</div>
            <div className={styles.studentInfo}>Adviser Section: {assignments.adviserDisplay}</div>
          </div>

          <div>
            <div className={styles.studentInfo}>
              <strong>Record Information</strong>
            </div>
            {teacher.status === 'pending' && (
              <div className={styles.studentInfo}>
                Invitation Sent: {invitedAt}
              </div>
            )}
            <div className={styles.studentInfo}>
              Added: {addedAt}
            </div>
            <div className={styles.studentInfo}>
              Last Updated: {updatedAt}
            </div>
            <div className={styles.studentInfo}>
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
            icon={allOnPageSelected ? fasCircle : farCircle} 
            style={{ 
              cursor: 'pointer',
              color: allOnPageSelected ? '#0f6b58' : ''
            }}
          />
        </div>
      ),
      renderCell: ({ row }) => {
        const isSelected = selectedTeachers.includes(row.id);
        return (
          <div className={styles.icon} onClick={(e) => handleTeacherSelect(row.id, e)}>
            <FontAwesomeIcon 
              icon={isSelected ? fasCircle : farCircle} 
              style={{ 
                cursor: 'pointer', 
                color: isSelected ? '#0f6b58' : ''
              }}
            />
          </div>
        );
      }
    },
    {
      key: 'employee_id',
      label: 'EMPLOYEE ID',
      headerStyle: withColumnWidth('10%', 100),
      cellStyle: withColumnWidth('10%', 100),
      renderCell: ({ row }) => renderField(row, 'employee_id')
    },
    {
      key: 'first_name',
      label: 'FIRST NAME',
      headerStyle: withColumnWidth('10%', 100),
      cellStyle: withColumnWidth('10%', 100),
      renderCell: ({ row }) => renderField(row, 'first_name')
    },
    {
      key: 'last_name',
      label: 'LAST NAME',
      headerStyle: withColumnWidth('10%', 100),
      cellStyle: withColumnWidth('10%', 100),
      renderCell: ({ row }) => renderField(row, 'last_name')
    },
    {
      key: 'email_address',
      label: 'EMAIL ADDRESS',
      headerStyle: withColumnWidth('10%', 100),
      cellStyle: withColumnWidth('10%', 100),
      renderCell: ({ row }) => renderField(row, 'email_address')
    },
    {
      key: 'grade',
      label: 'GRADE',
      headerStyle: withColumnWidth('8%', 90),
      cellStyle: withColumnWidth('8%', 90),
      renderCell: ({ row }) => {
        const teacherData = getTeacherFilterData(row);
        return teacherData.gradeLevels.length > 0 ? teacherData.gradeLevels.join(' | ') : 'N/A';
      }
    },
    {
      key: 'subject',
      label: 'SUBJECT',
      headerStyle: withColumnWidth('12%', 130),
      cellStyle: withColumnWidth('12%', 130),
      renderHeader: () => (
        <div className={styles.headerWithFilter}>
          <span>SUBJECT</span>
          <EntityDropdown
            options={teacherSubjectOptions}
            selectedValue={selectedSubjectFilter}
            onSelect={(value) => {
              setSelectedSubjectFilter(value);
              onPageChange(1);
            }}
            allLabel="All Subjects"
            buttonTitle="Filter by subject"
          />
        </div>
      ),
      renderCell: ({ row }) => {
        const teacherData = getTeacherFilterData(row);
        const subjects = teacherData.subjects;

        if (subjects.length === 0) {
          return 'N/A';
        }

        const displaySubject = selectedSubjectFilter && subjects.includes(selectedSubjectFilter)
          ? selectedSubjectFilter
          : subjects[0];

        const remainingCount = Math.max(subjects.length - 1, 0);

        return (
          <div className={styles.entityCellWithBadge}>
            <span>{displaySubject}</span>
            {remainingCount > 0 && (
              <span className={styles.entityCountBadge} title="Click row to see all subjects">
                +{remainingCount}
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'section',
      label: 'SECTION',
      headerStyle: withColumnWidth('12%', 130),
      cellStyle: withColumnWidth('12%', 130),
      renderHeader: () => (
        <div className={styles.headerWithFilter}>
          <span>SECTION</span>
          <EntityDropdown
            options={teacherSectionOptions}
            selectedValue={selectedSectionFilter}
            onSelect={(value) => {
              setSelectedSectionFilter(value);
              onPageChange(1);
            }}
            allLabel="All Sections"
            buttonTitle="Filter by section"
          />
        </div>
      ),
      renderCell: ({ row }) => {
        const teacherData = getTeacherFilterData(row);
        const uniqueSections = [...new Set(teacherData.sections.map((item) => item.sectionName).filter(Boolean))];

        if (uniqueSections.length === 0) {
          return 'N/A';
        }

        const defaultSection = teacherData.primarySection?.sectionName || uniqueSections[0];
        const displaySection = selectedSectionFilter && uniqueSections.includes(selectedSectionFilter)
          ? selectedSectionFilter
          : defaultSection;

        const remainingCount = Math.max(uniqueSections.length - 1, 0);

        return (
          <div className={styles.entityCellWithBadge}>
            <span>{displaySection}</span>
            {remainingCount > 0 && (
              <span className={styles.entityCountBadge} title="Click row to see all sections">
                +{remainingCount} 
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'status',
      label: 'STATUS',
      headerStyle: withColumnWidth('12%', 120),
      cellStyle: withColumnWidth('12%', 120),
      renderHeader: () => (
        <div className={styles.headerWithFilter}>
          <span>STATUS</span>
          <EntityDropdown
            options={teacherStatusOptions}
            selectedValue={selectedStatusFilter}
            onSelect={(value) => {
              setSelectedStatusFilter(value);
              onPageChange(1);
            }}
            allLabel="All Statuses"
            buttonTitle="Filter by status"
            getOptionLabel={(option) => option.label}
            getOptionValue={(option) => option.value}
          />
        </div>
      ),
      renderCell: ({ row }) => renderField(row, 'status', false)
    },
    {
      key: 'invite',
      label: 'INVITE',
      headerStyle: withColumnWidth('10%', 100),
      cellStyle: withColumnWidth('10%', 100),
      renderCell: ({ row }) => {
        const isInviteDisabled = !row.email_address || 
          row.status === 'active' || 
          row.status === 'pending' || 
          row.status === 'inactive';

        return (
          <div className={styles.icon}>
            <ForwardToInboxIcon sx={{ fontSize: 37, mb: -0.7 }}
              className="action-button"
              style={{ 
                cursor: isInviteDisabled ? 'default' : 'pointer',
                color: row.status === 'pending' ? '#f59e0b' : 
                       row.status === 'active' ? '#10b981' : 
                       row.status === 'inactive' ? '#ef4444' : 
                       '',
                opacity: isInviteDisabled ? 0.6 : 1
              }}
              title={row.status === 'pending' ? 'Invitation sent - pending account creation' : 
                     row.status === 'active' ? 'Account active' : 
                     row.status === 'inactive' ? 'Account suspended' : 
                     !row.email_address ? 'No email address' :
                     'Send account invitation'}
              onClick={(e) => handleInviteClick(row, e)}
            />
          </div>
        );
      }
    },
    {
      key: 'edit',
      label: 'EDIT',
      headerStyle: withColumnWidth('10%', 100),
      cellStyle: withColumnWidth('10%', 100),
      renderCell: ({ row }) => renderEditCell(row)
    },
    {
      key: 'delete',
      label: 'DELETE',
      headerStyle: withColumnWidth('8%', 88),
      cellStyle: withColumnWidth('8%', 88),
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
          return `${styles.teacherRow} ${editingTeacher === row.id ? styles.editingRow : ''}`;
        }}
        isRowSelected={({ row }) => selectedTeachers.includes(row.id)}
        expandedRowId={expandedRow}
        renderExpandedRow={({ row }) => renderExpandedRow(row)}
        persistExpandedRows
        hideMainRowWhenExpanded
        getExpandedRowClassName={({ isExpanded }) => `${styles.expandRow} ${isExpanded ? styles.expandRowActive : ''}`}
        striped={true}
        stickyHeader
        wrapperClassName={styles.tableWrapper}
        // CHANGED: Use computedInfoText + selectAllBanner (matches StudentTable)
        infoText={computedInfoText}
        selectedInfoText=""
        headerContent={selectAllBanner}
        paginationContent={paginationContent}
        isAllPagesSelected={isAllPagesSelected}
        visibleSelectedCount={visibleSelectedTeachers.length}
        totalRowsOnPage={paginatedTeachers.length}
        gradeTabs={{
          options: teacherGradeOptions,
          currentValue: selectedGrade,
          onChange: (grade) => {
            setSelectedGrade(grade);
            onPageChange(1);
          },
          showAll: true,
          allLabel: 'All',
          renderLabel: (gradeLevel) => `Grade ${gradeLevel}`,
          getOptionValue: (gradeLevel) => String(gradeLevel),
        }}
      />
    </div>
  );
};

export default TeacherTable;
