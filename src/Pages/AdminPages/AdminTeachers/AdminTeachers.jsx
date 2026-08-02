// src/pages/Admin/AdminTeachers/AdminTeachers.jsx
import { useState, useCallback, useEffect } from 'react';
import styles from './AdminTeachers.module.css';
import TeacherTable from '../../../Components/Tables/TeacherTable/TeacherTable.jsx';
import SectionLabel from "../../../Components/UI/Labels/SectionLabel/SectionLabel.jsx";
import Input from '../../../Components/UI/Inputs/Input/Input.jsx';
import Button from '../../../Components/UI/Buttons/Button/Button.jsx';
import FileUploadModal from '../../../Components/Modals/FileUploadModal/FileUploadModal.jsx';
import DeleteEntityModal from '../../../Components/Modals/DeleteEntityModal/DeleteEntityModal.jsx';
import InviteModal from '../../../Components/Modals/InviteModal/InviteModal.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import ForwardToInboxIcon from '@mui/icons-material/ForwardToInbox';
import { useTeachers } from '../../../Components/Hooks/useEntities.js'; 
import { useToast } from '../../../Components/Toast/ToastContext/ToastContext.jsx'; 
import { useAuth } from '../../../Components/Authentication/AuthProvider/AuthProvider';
import { exportEntity } from '../../../Utils/exportEntity.js';
import UploadIcon from '@mui/icons-material/Upload';
import DownloadIcon from '@mui/icons-material/Download';
import { apiClient } from '../../../config/api.js';
import { supabase } from '../../../lib/supabase';
import useSearchFilter from '../../../Components/Hooks/useSearchFilter.js';

function AdminTeachers() {
  const { success, error: toastError } = useToast();
  const {
    entities: teachers,
    teacherAssignments,
    loadingAssignments,
    loading: teachersLoading,
    error: teachersError,
    setEntities: setTeachers,
    refetch: refreshTeachers,
    fetchTeacherAssignmentsFresh,
    updateTeacherAssignments,
  } = useTeachers();
  const { user } = useAuth();
  
  const [selectedTeachers, setSelectedTeachers] = useState([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ROWS_PER_PAGE = 20;
  
  // All-pages selection
  const [isAllPagesSelected, setIsAllPagesSelected] = useState(false);
  const [filteredTeachers, setFilteredTeachers] = useState([]);

  // Grades & Sections data
  const [gradesData, setGradesData] = useState([]);
  const [sectionsData, setSectionsData] = useState([]);

  const { searchTerm, setSearchTerm, filteredRows: searchFilteredRows } = useSearchFilter(teachers, [
    (row) => [row.first_name, row.last_name].filter(Boolean).join(' '),
    'email_address',
    'phone_no',
    'employee_id'
  ]);

  // Fetch grades and sections
  useEffect(() => {
    const fetchGrades = async () => {
      const { data, error } = await supabase.from('grades').select('*').order('id');
      if (!error) setGradesData(data || []);
    };
    
    const fetchSections = async () => {
      const { data, error } = await supabase
        .from('sections')
        .select('*, grade:grades(grade_level)')
        .order('id');
      if (!error) setSectionsData(data || []);
    };

    fetchGrades();
    fetchSections();
  }, []);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
    setIsAllPagesSelected(false);
  }, [searchTerm]);

  // Selection handlers
  const handleSelectedTeachersUpdate = (selected) => {
    if (isAllPagesSelected) return;
    setSelectedTeachers(selected);
    if (selected.length === 0) setIsAllPagesSelected(false);
  };

  const handleFilteredTeachersUpdate = useCallback((teachers) => {
    setFilteredTeachers(teachers);
  }, []);

  const handleSelectAllPages = useCallback(() => {
    setIsAllPagesSelected(true);
    setSelectedTeachers(filteredTeachers.map(t => t.id));
  }, [filteredTeachers]);

  const handleClearAllPages = useCallback(() => {
    setIsAllPagesSelected(false);
    setSelectedTeachers([]);
  }, []);

  // Upload
  const handleUploadSuccess = useCallback(() => {
    refreshTeachers();
  }, [refreshTeachers]);

  // Export
  const handleExportTeachers = async () => {
    try {
      const exportData = teachers.map(teacher => ({
        employee_id: teacher.employee_id,
        first_name: teacher.first_name,
        last_name: teacher.last_name,
        email_address: teacher.email_address || '',
        phone_no: teacher.phone_no || '',
        status: teacher.status || ''
      }));

      exportEntity({
        entity: "teacher",
        data: exportData,
        filename: "teacher-export",
      });
      success("Successfully downloaded teacher data");
    } catch (err) {
      toastError("Failed to export: " + err.message);
    }
  };

  // Invite
  const handleInviteClick = (teacher) => {
    setTeacherToInvite(teacher);
    setIsInviteModalOpen(true);
  };

  const handleBulkInviteClick = () => {
    if (selectedTeachers.length > 0) setIsInviteModalOpen(true);
  };

  const handleConfirmInvite = async (teacherIdOrIds) => {
    setIsSendingInvite(true);
    try {
      const payload = Array.isArray(teacherIdOrIds) 
        ? { teacherIds: teacherIdOrIds, invitedBy: user?.id }
        : { teacherId: teacherIdOrIds, invitedBy: user?.id };
      
      const endpoint = Array.isArray(teacherIdOrIds) 
        ? '/api/teacher-invite/invite/bulk'
        : '/api/teacher-invite/invite';
      
      const response = await apiClient.post(endpoint, payload);
      
      if (response.data.success) {
        const count = Array.isArray(teacherIdOrIds) ? teacherIdOrIds.length : 1;
        success(`${count} invitation(s) sent successfully`);
        refreshTeachers();
      } else {
        toastError(response.data.error || 'Failed to send invitation');
      }
    } catch (err) {
      toastError(err.response?.data?.error || 'Failed to send invitation');
    } finally {
      setIsSendingInvite(false);
      setIsInviteModalOpen(false);
      setTeacherToInvite(null);
      if (Array.isArray(teacherIdOrIds)) {
        setSelectedTeachers([]);
        setIsAllPagesSelected(false);
      }
    }
  };

  // Delete
  const handleDeleteClick = (teacher) => {
    setTeacherToDelete(teacher);
    setIsDeleteModalOpen(true);
  };

  const handleBulkDeleteClick = () => {
    if (selectedTeachers.length > 0) setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (teacherIdOrIds) => {
    setIsDeleting(true);
    try {
      const payload = Array.isArray(teacherIdOrIds)
        ? { teacherIds: teacherIdOrIds, deletedBy: user?.id }
        : { teacherId: teacherIdOrIds, deletedBy: user?.id };
      
      const endpoint = Array.isArray(teacherIdOrIds)
        ? '/api/teacher-invite/delete-teachers-bulk'
        : '/api/teacher-invite/delete-teacher';
      
      const response = await apiClient.post(endpoint, payload);
      
      if (response.data.success) {
        const count = Array.isArray(teacherIdOrIds) ? teacherIdOrIds.length : 1;
        success(`${count} teacher(s) deleted successfully`);
        refreshTeachers();
      } else {
        toastError(response.data.error || 'Failed to delete teacher');
      }
    } catch (err) {
      toastError(err.response?.data?.error || 'Failed to delete teacher');
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      setTeacherToDelete(null);
      if (Array.isArray(teacherIdOrIds)) {
        setSelectedTeachers([]);
        setIsAllPagesSelected(false);
      }
    }
  };

  // Modals state
  const [teacherToInvite, setTeacherToInvite] = useState(null);
  const [teacherToDelete, setTeacherToDelete] = useState(null);

  const selectedCount = selectedTeachers.length;

  return (
    <main className={styles.main}>
      <SectionLabel label="Teacher Records" />

      <div className={styles.top}>
        <div className={styles.topLeft}>
          <Button 
            color="teaGreen" 
            height="sm"
            width="auto"
            label="Export" 
            icon={<DownloadIcon />}
            onClick={handleExportTeachers}
            disabled={teachers.length === 0}
          />
          <Button 
            color="teaGreen" 
            height="sm"
            width="auto"
            label="Import" 
            icon={<UploadIcon />}
            onClick={() => setIsUploadModalOpen(true)}
          />

          {selectedCount > 0 && (
            <div className={styles.bulkActions}>
              <Button
                color="warmStone"
                height="sm"
                width="auto"
                icon={<ForwardToInboxIcon />}
                onClick={handleBulkInviteClick}
                disabled={isSendingInvite}
              />
              <Button
                color="danger"
                height="sm"
                width="auto"
                icon={<FontAwesomeIcon icon={faTrash} />}
                onClick={handleBulkDeleteClick}
                disabled={isDeleting}
              />
            </div>
          )}
        </div>

        <div className={styles.topRight}>
          <Input 
            placeholder="Search Teachers..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            search={true}
          />
          <Button 
            color="ocean" 
            height="sm" 
            width="md" 
            label="+ New Teacher" 
            onClick={() => setIsUploadModalOpen(true)}
          />
        </div>
      </div>

      <FileUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        entityType="teacher"
        onUploadSuccess={handleUploadSuccess}
      />

      <TeacherTable 
        searchTerm={searchTerm}
        selectedTeachers={selectedTeachers}
        onSelectedTeachersUpdate={handleSelectedTeachersUpdate}
        onSingleDeleteClick={handleDeleteClick}
        onSingleInviteClick={handleInviteClick}
        refreshTeachers={refreshTeachers}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        rowsPerPage={ROWS_PER_PAGE}
        isAllPagesSelected={isAllPagesSelected}
        onSelectAllPages={handleSelectAllPages}
        onClearAllPages={handleClearAllPages}
        onFilteredTeachersUpdate={handleFilteredTeachersUpdate}
        gradesData={gradesData}
        sectionsData={sectionsData}
        // Props from the single useTeachers instance
        teachers={teachers}
        teacherAssignments={teacherAssignments}
        loadingAssignments={loadingAssignments}
        loading={teachersLoading}
        error={teachersError}
        setEntities={setTeachers}
        fetchTeacherAssignmentsFresh={fetchTeacherAssignmentsFresh}
        updateTeacherAssignments={updateTeacherAssignments}
      />

      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => {
          if (!isSendingInvite) {
            setIsInviteModalOpen(false);
            setTeacherToInvite(null);
          }
        }}
        teacher={teacherToInvite}
        selectedTeachers={selectedTeachers}
        teacherData={teachers}
        onConfirm={handleConfirmInvite}
        loading={isSendingInvite}
      />

      <DeleteEntityModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!isDeleting) {
            setIsDeleteModalOpen(false);
            setTeacherToDelete(null);
          }
        }}
        entity={teacherToDelete}
        selectedEntities={selectedTeachers}
        entityData={teachers}
        entityType="teacher"
        onConfirm={handleConfirmDelete}
        currentFilter={searchTerm}
      />
    </main>
  );
}

export default AdminTeachers;