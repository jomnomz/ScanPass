import { useState, useCallback, useEffect, useMemo } from 'react';
import styles from './AdminStudents.module.css';
import PageLabel from "../../../Components/UI/Labels/PageLabel/PageLabel.jsx";
import SectionLabel from "../../../Components/UI/Labels/SectionLabel/SectionLabel.jsx";
import FileUploadModal from "../../../Components/Modals/FileUploadModal/FileUploadModal.jsx";
import Button from "../../../Components/UI/Buttons/Button/Button.jsx";
import StudentTable from '../../../Components/Tables/StudentTable/StudentTable.jsx';
import Input from '../../../Components/UI/Input/Input.jsx';
import DeleteEntityModal from '../../../Components/Modals/DeleteEntityModal/DeleteEntityModal.jsx';
import DownloadQRModal from '../../../Components/Modals/DownloadQRModal/DownloadQRModal.jsx';
import Pagination from '../../../Components/UI/Buttons/Pagination/Pagination.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faTrash, faQrcode } from "@fortawesome/free-solid-svg-icons";
import { useToast } from '../../../Components/Toast/ToastContext/ToastContext.jsx';
import { StudentService } from '../../../Utils/EntityService.js';
import { supabase } from '../../../lib/supabase';
import { exportEntity } from '../../../Utils/exportEntity.js';
import UploadIcon from '@mui/icons-material/Upload';
import DownloadIcon from '@mui/icons-material/Download';
import { sortStudents } from '../../../Utils/SortEntities';

function AdminStudents() {
  const { success, error: toastError } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [availableSections, setAvailableSections] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [currentGrade, setCurrentGrade] = useState('all');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteModalMode, setDeleteModalMode] = useState('single');
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [allStudents, setAllStudents] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  
  const [gradesData, setGradesData] = useState([]);
  const [sectionsData, setSectionsData] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const ROWS_PER_PAGE = 20;
  const [isAllPagesSelected, setIsAllPagesSelected] = useState(false);

  const studentService = new StudentService();

  const fetchGrades = useCallback(async () => {
    try {
      console.log('🔄 Fetching grades data...');
      const { data, error } = await supabase
        .from('grades')
        .select('*')
        .order('id');
      
      if (error) throw error;
      setGradesData(data || []);
      console.log('✅ Grades loaded:', data?.length || 0);
    } catch (err) {
      console.error('❌ Error loading grades:', err);
      toastError('Failed to load grades data');
    }
  }, [toastError]);

  const fetchSections = useCallback(async () => {
    try {
      console.log('🔄 Fetching sections data...');
      const { data, error } = await supabase
        .from('sections')
        .select(`
          *,
          grade:grades(grade_level)
        `)
        .order('id');
      
      if (error) throw error;
      setSectionsData(data || []);
      console.log('✅ Sections loaded:', data?.length || 0);
    } catch (err) {
      console.error('❌ Error loading sections:', err);
      toastError('Failed to load sections data');
    }
  }, [toastError]);

  const fetchAllStudents = useCallback(async () => {
    try {
      console.log('🔄 Fetching ALL students from database...');
      const allStudentsData = await studentService.fetchAll();
      
      setAllStudents(allStudentsData);
      console.log('✅ All students loaded:', allStudentsData.length);
      
      if (allStudentsData.length > 0) {
        console.log('📊 First student sample:', {
          id: allStudentsData[0].id,
          name: `${allStudentsData[0].first_name} ${allStudentsData[0].last_name}`,
          grade: allStudentsData[0].grade,
          section: allStudentsData[0].section,
          grade_id: allStudentsData[0].grade_id,
          section_id: allStudentsData[0].section_id
        });
      }
    } catch (err) {
      console.error('❌ Error loading all students:', err);
      toastError('Failed to load student data');
      setAllStudents([]);
    }
  }, [toastError]);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoadingData(true);
      try {
        console.log('🚀 Starting data fetch sequence...');
        await fetchGrades();
        await fetchSections();
        await fetchAllStudents();
        console.log('✅ All data loaded successfully');
      } catch (err) {
        console.error('❌ Error fetching initial data:', err);
        toastError('Failed to load application data');
      } finally {
        setLoadingData(false);
      }
    };
    
    fetchInitialData();
  }, [fetchGrades, fetchSections, fetchAllStudents]);

  useEffect(() => {
    setCurrentPage(1);
    setIsAllPagesSelected(false);
  }, [searchTerm, selectedSection, currentGrade]);

  // STEP 1: Filter students based on grade, section, and search
  const filteredStudents = useMemo(() => {
    let filtered = allStudents;

    if (currentGrade !== 'all') {
      filtered = filtered.filter(s => s.grade === currentGrade);
    }

    if (selectedSection) {
      filtered = filtered.filter(s => s.section === selectedSection);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(s =>
        s.lrn?.toLowerCase().includes(q) ||
        s.first_name?.toLowerCase().includes(q) ||
        s.last_name?.toLowerCase().includes(q) ||
        s.grade?.toString().toLowerCase().includes(q) ||
        s.section?.toString().toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.phone_number?.toLowerCase().includes(q) ||
        s.guardian_first_name?.toLowerCase().includes(q) ||
        s.guardian_last_name?.toLowerCase().includes(q) ||
        s.guardian_phone_number?.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [allStudents, currentGrade, selectedSection, searchTerm]);

  // STEP 2: Sort the FULL filtered result set before pagination
  const sortedStudents = useMemo(() => {
    return sortStudents(filteredStudents);
  }, [filteredStudents]);

  // STEP 3: Calculate total pages based on sorted count
  const totalPages = Math.ceil(sortedStudents.length / ROWS_PER_PAGE);

  // STEP 4: Paginate the sorted students
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return sortedStudents.slice(start, start + ROWS_PER_PAGE);
  }, [sortedStudents, currentPage]);

  const refreshStudents = useCallback(() => {
    console.log('🔄 Manual refresh triggered');
    fetchAllStudents();
    setRefreshTrigger(prev => prev + 1);
  }, [fetchAllStudents]);

  const handleUploadSuccess = useCallback(() => {
    console.log('🆕 Students uploaded, refreshing...');
    fetchAllStudents();
    setRefreshTrigger(prev => prev + 1);
  }, [fetchAllStudents]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleSectionSelect = (section) => {
    setSelectedSection(section);
  };

  const handleClearSectionFilter = () => {
    setSelectedSection('');
  };

  const handleSectionsUpdate = (sections) => {
    setAvailableSections(sections);
  };

  // FIX: Guard against overwriting when all pages are selected
  const handleSelectedStudentsUpdate = (selected) => {
    if (isAllPagesSelected) return; // ← Don't let the table clobber the full selection
    setSelectedStudents(selected);
    if (selected.length === 0) {
      setIsAllPagesSelected(false);
    }
  };

  const handleStudentDataUpdate = () => {
    // This callback can be used for additional logic when student data updates
  };

  const handleGradeUpdate = (grade) => {
    setCurrentGrade(grade);
  };

  const handleBulkDeleteClick = () => {
    if (selectedStudents.length > 0) {
      setDeleteModalMode('bulk');
      setIsDeleteModalOpen(true);
    }
  };

  const handleBulkQRClick = () => {
    if (selectedStudents.length > 0) {
      setIsQRModalOpen(true);
    }
  };

  const handleSingleDeleteClick = (student) => {
    setDeleteModalMode('single');
    setStudentToDelete(student);
    setIsDeleteModalOpen(true);
  };

  const handleExportStudents = () => {
    try {
      exportEntity({
        entity: 'student',
        data: allStudents,
        filename: 'student-export',
      });
      success('Successfully downloaded student data table');
    } catch (err) {
      toastError(`Failed to export student data: ${err.message}`);
    }
  };

  const handleSelectAllPages = () => {
    setIsAllPagesSelected(true);
    const allFilteredIds = sortedStudents.map(s => s.id);
    setSelectedStudents(allFilteredIds);
  };

  const handleClearAllPages = () => {
    setIsAllPagesSelected(false);
    setSelectedStudents([]);
  };

  const deleteSingleStudentAPI = async (studentId) => {
    try {
      console.log('🔄 Deleting student ID:', studentId);
      await studentService.delete(studentId);
      return { success: true };
    } catch (err) {
      console.error('❌ Error deleting student:', err);
      throw new Error(`Failed to delete student: ${err.message}`);
    }
  };

  const deleteMultipleStudentsAPI = async (studentIds) => {
    try {
      console.log('🔄 Deleting multiple students:', studentIds);
      
      for (const studentId of studentIds) {
        await studentService.delete(studentId);
      }
      
      return { success: true };
    } catch (err) {
      console.error('❌ Error bulk deleting students:', err);
      throw new Error(`Failed to delete students: ${err.message}`);
    }
  };

  const handleConfirmDelete = async (studentIdOrIds) => {
    console.log('DELETE FUNCTION CALLED! Mode:', deleteModalMode, 'IDs:', studentIdOrIds);
    setIsDeleting(true);
    
    try {
      if (deleteModalMode === 'single') {
        await deleteSingleStudentAPI(studentIdOrIds);
        success('Student deleted successfully');
      } else {
        await deleteMultipleStudentsAPI(studentIdOrIds);
        success(`${studentIdOrIds.length} students deleted successfully`);
      }
      
      await fetchAllStudents();
      setRefreshTrigger(prev => prev + 1);
      
      console.log('✅ Delete successful, all data refreshed');
      
    } catch (err) {
      console.error('❌ Delete error:', err);
      toastError(`Failed to delete: ${err.message}`);
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      setStudentToDelete(null);
      
      if (deleteModalMode === 'bulk') {
        setSelectedStudents([]);
        setIsAllPagesSelected(false);
      }
    }
  };

  const paginationContent = sortedStudents.length > 0 ? (
    <Pagination
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={setCurrentPage}
    />
  ) : null;

  return (
    <main className={styles.main}>
      <SectionLabel label="Student Records"></SectionLabel>
      
      <div className={styles.top}>
        <div className={styles.topLeft}>
          <Button 
            color="teaGreen" 
            height="sm" 
            icon={<DownloadIcon/>}
            width="auto" 
            label="Export" 
            onClick={handleExportStudents}
            disabled={loadingData || allStudents.length === 0}
          />
          <Button 
            color="teaGreen" 
            height="sm" 
            width="auto" 
            icon={<UploadIcon/>}
            label="Import" 
            onClick={() => setIsUploadModalOpen(true)}
            disabled={loadingData}
          />
          
          {selectedStudents.length > 0 && (
            <div className={styles.bulkActions}>
              <Button
                color="warmStone"
                height="sm"
                width="auto"
                icon={<FontAwesomeIcon icon={faQrcode} />}
                onClick={handleBulkQRClick}
                disabled={loadingData}
              />
              <Button
                color="danger"
                height="sm"
                width="auto"
                icon={<FontAwesomeIcon icon={faTrash} />}
                onClick={handleBulkDeleteClick}
                disabled={isDeleting || loadingData}
              />
            </div>
          )}
        </div>
        
        <div className={styles.topRight}>
          <Input 
            placeholder="Search Student Records" 
            value={searchTerm}
            onChange={handleSearchChange}
            search="true"
          />  

          <Button 
            color="ocean" 
            height="sm" 
            width="md" 
            label="+ New Students" 
            onClick={() => setIsUploadModalOpen(true)}
            style={{ marginRight: '10px' }}
            disabled={loadingData}
          />
        </div>
      </div>
      
      {loadingData ? (
        <div className={styles.loadingContainer}>
          <p>Loading student data...</p>
        </div>
      ) : (
        <>
          <FileUploadModal
            isOpen={isUploadModalOpen}
            onClose={() => setIsUploadModalOpen(false)}
            entityType="student"
            onUploadSuccess={handleUploadSuccess}
          />
          
          <StudentTable 
            key={`student-table-${refreshTrigger}`}
            searchTerm={searchTerm} 
            selectedSection={selectedSection}
            onSectionsUpdate={handleSectionsUpdate}
            onSelectedStudentsUpdate={handleSelectedStudentsUpdate}
            onStudentDataUpdate={handleStudentDataUpdate}
            onGradeUpdate={handleGradeUpdate}
            onClearSectionFilter={handleClearSectionFilter}
            onSingleDeleteClick={handleSingleDeleteClick}
            refreshStudents={refreshStudents}
            refreshAllStudents={fetchAllStudents}
            onSectionSelect={handleSectionSelect}
            availableSections={availableSections}
            students={paginatedStudents}
            gradesData={gradesData}
            sectionsData={sectionsData}
            loading={loadingData}
            paginationContent={paginationContent}
            totalStudentCount={sortedStudents.length}
            isAllPagesSelected={isAllPagesSelected}
            onSelectAllPages={handleSelectAllPages}
            onClearAllPages={handleClearAllPages}
            currentPage={currentPage}
          />
        </>
      )}
      
      <DeleteEntityModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!isDeleting) {
            setIsDeleteModalOpen(false);
            setStudentToDelete(null);
          }
        }}
        entity={deleteModalMode === 'single' ? studentToDelete : null}
        selectedEntities={deleteModalMode === 'bulk' ? selectedStudents : []}
        entityData={allStudents}
        entityType="student"
        onConfirm={deleteModalMode === 'single' ? handleConfirmDelete : undefined}
        onConfirmBulk={deleteModalMode === 'bulk' ? handleConfirmDelete : undefined}
        currentFilter={searchTerm}
        currentSection={selectedSection}
        currentGrade={currentGrade}
      />

      <DownloadQRModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        selectedStudents={selectedStudents}
        studentData={allStudents}
        currentFilter={searchTerm}
        currentSection={selectedSection}
        currentGrade={currentGrade}
        gradesData={gradesData}
        sectionsData={sectionsData}
      />
    </main>
  );
}

export default AdminStudents;