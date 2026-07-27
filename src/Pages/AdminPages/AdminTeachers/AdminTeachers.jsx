// src/pages/Admin/AdminTeachers/AdminTeachers.jsx
import { useState, useCallback, useEffect, useMemo } from 'react';
import styles from './AdminTeachers.module.css';
import TeacherTable from '../../../Components/Tables/TeacherTable/TeacherTable.jsx';
import SectionLabel from "../../../Components/UI/Labels/SectionLabel/SectionLabel.jsx";
import Input from '../../../Components/UI/Inputs/Input/Input.jsx';
import Button from '../../../Components/UI/Buttons/Button/Button.jsx';
import FileUploadModal from '../../../Components/Modals/FileUploadModal/FileUploadModal.jsx';
import DeleteEntityModal from '../../../Components/Modals/DeleteEntityModal/DeleteEntityModal.jsx';
import InviteModal from '../../../Components/Modals/InviteModal/InviteModal.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChalkboardUser, faTrash } from "@fortawesome/free-solid-svg-icons";
import ForwardToInboxIcon from '@mui/icons-material/ForwardToInbox';
import { useTeachers } from '../../../Components/Hooks/useEntities.js'; 
import { TeacherService } from '../../../Utils/EntityService.js'; 
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
  const { entities: teachers, refetch: refreshTeachers } = useTeachers();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTeachers, setSelectedTeachers] = useState([]);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [teacherToInvite, setTeacherToInvite] = useState(null);
  const [inviteModalMode, setInviteModalMode] = useState('single');
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteModalMode, setDeleteModalMode] = useState('single');
  const [teacherToDelete, setTeacherToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // ===== GRADES & SECTIONS DATA =====
  const [gradesData, setGradesData] = useState([]);
  const [sectionsData, setSectionsData] = useState([]);

  const fetchGrades = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('grades')
        .select('*')
        .order('id');

      if (error) throw error;
      setGradesData(data || []);
    } catch (err) {
      console.error('❌ Error loading grades:', err);
      toastError('Failed to load grades data');
    }
  }, [toastError]);

  const fetchSections = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sections')
        .select(`
          *,
          grade:grades(grade_level)
        `)
        .order('id');

      if (error) throw error;
      setSectionsData(data || []);
    } catch (err) {
      console.error('❌ Error loading sections:', err);
      toastError('Failed to load sections data');
    }
  }, [toastError]);

  useEffect(() => {
    fetchGrades();
    fetchSections();
  }, [fetchGrades, fetchSections]);

  // PAGINATION STATE
  const [currentPage, setCurrentPage] = useState(1);
  const ROWS_PER_PAGE = 20;

  // ALL-PAGES SELECTION STATE
  const [isAllPagesSelected, setIsAllPagesSelected] = useState(false);
  const [filteredTeachers, setFilteredTeachers] = useState([]);

  const teacherService = new TeacherService();

  const { searchTerm, setSearchTerm, filteredRows: searchFilteredRows } = useSearchFilter(teachers, [
    (row) => [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' '),
    'email',
    'phone_number',
    'employee_id',
    'subjects',
    'grade_sections_teaching',
    'adviser_grade_section'
  ]);

  // Reset page + all-pages flag when search changes
  useEffect(() => {
    setCurrentPage(1);
    setIsAllPagesSelected(false);
  }, [searchTerm]);

  // FIX: Guard against overwriting when all pages are selected
  const handleSelectedTeachersUpdate = (selected) => {
    if (isAllPagesSelected) return;
    setSelectedTeachers(selected);
    if (selected.length === 0) {
      setIsAllPagesSelected(false);
    }
  };

  const handleTeacherDataUpdate = (teacherData) => {
    console.log('Teachers updated:', teacherData.length);
  };

  // Receive full filtered list from TeacherTable (for "Select all pages")
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

  const handleUploadSuccess = useCallback((newTeachers) => {
    console.log('🆕 Teachers uploaded:', newTeachers);
    refreshTeachers();
    setRefreshTrigger(prev => prev + 1);
  }, [refreshTeachers]);

  const handleSingleInviteClick = (teacher) => {
    setInviteModalMode('single');
    setTeacherToInvite(teacher);
    setIsInviteModalOpen(true);
  };

  const handleBulkInviteClick = () => {
    if (selectedTeachers.length > 0) {
      setInviteModalMode('bulk');
      setIsInviteModalOpen(true);
    }
  };

  const sendInvitationAPI = async (teacherId) => {
    try {
      const response = await apiClient.post('/api/teacher-invite/invite', {
        teacherId: teacherId,
        invitedBy: user?.id
      });

      const data = response.data;

      if (data.success) {
        if (data.emailTemplate) {
          const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <title>Email to ${data.teacherName}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .container { max-width: 800px; margin: 0 auto; }
                .header { background: #3B82F6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
                .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
                .actions { margin-top: 20px; display: flex; gap: 10px; }
                button { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
                .copy-btn { background: #3B82F6; color: white; }
                .email-btn { background: #10b981; color: white; }
                .close-btn { background: #6b7280; color: white; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h2>📧 Email for ${data.teacherName}</h2>
                  <p>Copy this email and send to the teacher</p>
                </div>
                <div class="content">
                  <h3>Subject: ${data.emailTemplate.subject}</h3>
                  <hr>
                  <div id="email-content">
                    ${data.emailTemplate.html}
                  </div>
                  <hr>
                  <div class="actions">
                    <button class="copy-btn" onclick="copyToClipboard()">📋 Copy Email HTML</button>
                    <button class="email-btn" onclick="openEmailClient()">📨 Open Email Client</button>
                    <button class="close-btn" onclick="window.close()">Close</button>
                  </div>
                </div>
              </div>
              <script>
                function copyToClipboard() {
                  const html = document.getElementById('email-content').innerHTML;
                  const subject = "${data.emailTemplate.subject}";
                  const text = "${data.emailTemplate.text.replace(/\n/g, '\\n')}";

                  navigator.clipboard.writeText(html)
                    .then(() => alert('✅ Email HTML copied to clipboard!'));
                }

                function openEmailClient() {
                  const subject = encodeURIComponent("${data.emailTemplate.subject}");
                  const body = encodeURIComponent(\`${data.emailTemplate.text}\`);
                  window.open('mailto:${data.email}?subject=' + subject + '&body=' + body);
                }
              </script>
            </body>
            </html>
          `;

          const win = window.open();
          win.document.write(htmlContent);
          win.document.close();
        }

        alert(
          `✅ TEACHER ACCOUNT CREATED!\n\n` +
          `Teacher: ${data.teacherName}\n` +
          `Email: ${data.email}\n` +
          `Password: ${data.tempPassword}\n` +
          `Login: ${data.loginUrl}\n\n` +
          `A new window opened with the email template.\n` +
          `Copy it and send to the teacher.`
        );

        return { success: true, data };
      } else {
        return { success: false, error: data.error || 'Failed to create account' };
      }
    } catch (err) {
      if (err.response) {
        return { success: false, error: err.response.data?.error || 'Failed to create account' };
      } else if (err.request) {
        return { success: false, error: 'Cannot connect to server. Please check your connection.' };
      } else {
        return { success: false, error: err.message };
      }
    }
  };

  const sendBulkInvitationsAPI = async (teacherIds) => {
    try {
      const response = await apiClient.post('/api/teacher-invite/invite/bulk', {
        teacherIds: teacherIds,
        invitedBy: user?.id
      });

      const data = response.data;

      if (data.success) {
        return { 
          success: true, 
          data,
          count: data.results?.success?.length || 0 
        };
      } else {
        return { success: false, error: data.error || 'Failed to send bulk invitations' };
      }
    } catch (err) {
      if (err.response) {
        return { success: false, error: err.response.data?.error || 'Failed to send bulk invitations' };
      } else if (err.request) {
        return { success: false, error: 'Cannot connect to server. Please check your connection.' };
      } else {
        return { success: false, error: err.message };
      }
    }
  };

  const handleConfirmInvite = async (teacherIdOrIds) => {
    setIsSendingInvite(true);

    try {
      if (inviteModalMode === 'single') {
        const result = await sendInvitationAPI(teacherIdOrIds);

        if (result.success) {
          success('Teacher invited successfully');
          await refreshTeachers();
          setRefreshTrigger(prev => prev + 1);
        } else {
          toastError(`Failed to invite: ${result.error}`);
        }
      } else {
        const result = await sendBulkInvitationsAPI(teacherIdOrIds);

        if (result.success) {
          success(`Sent ${result.count} invitation(s) successfully`);
          await refreshTeachers();
          setRefreshTrigger(prev => prev + 1);

          if (result.data.results?.failed?.length > 0) {
            toastError(`${result.data.results.failed.length} invitation(s) failed`);
          }
        } else {
          toastError(`Failed to send bulk invitations: ${result.error}`);
        }
      }
    } catch (err) {
      toastError(`Error: ${err.message}`);
    } finally {
      setIsSendingInvite(false);
      setIsInviteModalOpen(false);
      setTeacherToInvite(null);

      if (inviteModalMode === 'bulk') {
        requestAnimationFrame(() => {
          setSelectedTeachers([]);
          setIsAllPagesSelected(false);
        });
      }
    }
  };

  const handleSingleDeleteClick = (teacher) => {
    setDeleteModalMode('single');
    setTeacherToDelete(teacher);
    setIsDeleteModalOpen(true);
  };

  const handleBulkDeleteClick = () => {
    if (selectedTeachers.length > 0) {
      setDeleteModalMode('bulk');
      setIsDeleteModalOpen(true);
    }
  };

  const formatGradeSectionDisplay = (sectionEntry) => {
    if (!sectionEntry?.section) return "";

    const gradeLevel = sectionEntry.section.grade?.grade_level;
    const sectionName = sectionEntry.section.section_name;

    if (!gradeLevel || !sectionName) return "";

    return `${gradeLevel} - ${sectionName}`;
  };

  const handleExportTeachers = async () => {
    try {
      const teachersWithAssignments = await Promise.all(
        teachers.map(async (teacher) => {
          const assignments = await teacherService.getTeacherAssignments(teacher.id);

          const subjects = [...new Set((assignments.subjects || [])
            .map((entry) => String(entry?.subject?.subject_code || "").trim())
            .filter(Boolean))];

          const gradeSectionsTeaching = [...new Set((assignments.assignments || [])
            .map((entry) => {
              const gradeLevel = entry?.section?.grade?.grade_level;
              const sectionName = entry?.section?.section_name;

              if (!gradeLevel || !sectionName) return "";

              return `${gradeLevel} - ${sectionName}`;
            })
            .filter(Boolean))];

          const adviserGradeSection = formatGradeSectionDisplay(
            (assignments.sections || []).find((entry) => entry?.is_adviser)
          );

          return {
            ...teacher,
            subjects,
            grade_sections_teaching: gradeSectionsTeaching,
            adviser_grade_section: adviserGradeSection,
          };
        })
      );

      exportEntity({
        entity: "teacher",
        data: teachersWithAssignments,
        filename: "teacher-export",
      });
      success("Successfully downloaded teacher data table");
    } catch (err) {
      toastError("Failed to export teacher data: " + err.message);
    }
  };

  const deleteSingleTeacherAPI = async (teacherId) => {
    try {
      const response = await apiClient.post('/api/teacher-invite/delete-teacher', {
        teacherId: teacherId,
        deletedBy: user?.id
      });

      const data = response.data;

      if (data.success) {
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Failed to delete teacher' };
      }
    } catch (err) {
      if (err.response) {
        return { success: false, error: err.response.data?.error || 'Failed to delete teacher' };
      } else if (err.request) {
        return { success: false, error: 'Cannot connect to server. Please check your connection.' };
      } else {
        return { success: false, error: err.message };
      }
    }
  };

  const deleteMultipleTeachersAPI = async (teacherIds) => {
    try {
      const response = await apiClient.post('/api/teacher-invite/delete-teachers-bulk', {
        teacherIds: teacherIds,
        deletedBy: user?.id
      });

      const data = response.data;

      if (data.success) {
        return { 
          success: true,
          count: data.results?.success?.length || 0,
          data: data
        };
      } else {
        return { success: false, error: data.error || 'Failed to delete teachers' };
      }
    } catch (err) {
      if (err.response) {
        return { success: false, error: err.response.data?.error || 'Failed to delete teachers' };
      } else if (err.request) {
        return { success: false, error: 'Cannot connect to server. Please check your connection.' };
      } else {
        return { success: false, error: err.message };
      }
    }
  };

  const handleConfirmDelete = async (teacherIdOrIds) => {
    setIsDeleting(true);

    try {
      if (deleteModalMode === 'single') {
        const result = await deleteSingleTeacherAPI(teacherIdOrIds);

        if (result.success) {
          success('Teacher deleted successfully');
        } else {
          toastError(`Failed to delete: ${result.error}`);
        }
      } else {
        const result = await deleteMultipleTeachersAPI(teacherIdOrIds);

        if (result.success) {
          success(`${result.count} teacher(s) deleted successfully`);

          if (result.data?.results?.failed?.length > 0) {
            toastError(`${result.data.results.failed.length} deletion(s) failed`);
          }
        } else {
          toastError(`Failed to delete: ${result.error}`);
        }
      }

      await refreshTeachers();
      setRefreshTrigger(prev => prev + 1);

    } catch (err) {
      toastError(`Error: ${err.message}`);
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      setTeacherToDelete(null);

      if (deleteModalMode === 'bulk') {
        requestAnimationFrame(() => {
          setSelectedTeachers([]);
          setIsAllPagesSelected(false);
        });
      }
    }
  };

  return (
    <main className={styles.main}>
      <SectionLabel label="Teacher Records"></SectionLabel>

      <div className={styles.top}>
        <div className={styles.topLeft}>
          <Button 
            color="teaGreen" 
            height="sm"
            width="auto"
            label="Export" 
            icon={<DownloadIcon/>}
            onClick={handleExportTeachers}
            disabled={teachers.length === 0}
          />
          <Button 
            color="teaGreen" 
            height="sm"
            width="auto"
            label="Import" 
            icon={<UploadIcon/>}
            onClick={() => setIsUploadModalOpen(true)}
          />

          {selectedTeachers.length > 0 && (
            <div className={styles.bulkActions}>
              <Button
                color="warmStone"
                height="sm"
                width="auto"
                icon={<ForwardToInboxIcon/>}
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
            search="true"
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
          key={`teacher-table-${refreshTrigger}`}
          searchTerm={searchTerm}
          selectedTeachers={selectedTeachers}
          onSelectedTeachersUpdate={handleSelectedTeachersUpdate}
          onTeacherDataUpdate={handleTeacherDataUpdate}
          onSingleDeleteClick={handleSingleDeleteClick}
          onSingleInviteClick={handleSingleInviteClick}
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
      />

      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => {
          if (!isSendingInvite) {
            setIsInviteModalOpen(false);
            setTeacherToInvite(null);
          }
        }}
        teacher={inviteModalMode === 'single' ? teacherToInvite : null}
        selectedTeachers={inviteModalMode === 'bulk' ? selectedTeachers : []}
        teacherData={teachers}
        onConfirm={inviteModalMode === 'single' ? handleConfirmInvite : undefined}
        onConfirmBulk={inviteModalMode === 'bulk' ? handleConfirmInvite : undefined}
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
        entity={deleteModalMode === 'single' ? teacherToDelete : null}
        selectedEntities={deleteModalMode === 'bulk' ? selectedTeachers : []}
        entityData={teachers}
        entityType="teacher"
        onConfirm={deleteModalMode === 'single' ? handleConfirmDelete : undefined}
        onConfirmBulk={deleteModalMode === 'bulk' ? handleConfirmDelete : undefined}
        currentFilter={searchTerm}
      />
    </main>
  );
}

export default AdminTeachers;