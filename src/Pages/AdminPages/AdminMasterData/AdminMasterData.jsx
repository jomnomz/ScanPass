import { useState, useCallback, useEffect, useMemo } from 'react';
import styles from './AdminMasterData.module.css';
import SectionLabel from "../../../Components/UI/Labels/SectionLabel/SectionLabel.jsx";
import FileUploadModal from '../../../Components/Modals/FileUploadModal/FileUploadModal.jsx';
import Button from '../../../Components/UI/Buttons/Button/Button.jsx';
import Input from '../../../Components/UI/Input/Input.jsx';
import DeleteEntityModal from '../../../Components/Modals/DeleteEntityModal/DeleteEntityModal.jsx';
import Pagination from '../../../Components/UI/Buttons/Pagination/Pagination.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faPlus } from "@fortawesome/free-solid-svg-icons";
import GradeSectionTable from '../../../Components/Tables/GradeSectionTable/GradeSectionTable.jsx';
import SubjectTable from '../../../Components/Tables/SubjectTable/SubjectTable.jsx';
import GradeSchedulesTable from '../../../Components/Tables/GradeSchedulesTable/GradeSchedulesTable.jsx';
import { useToast } from '../../../Components/Toast/ToastContext/ToastContext.jsx';
import { exportEntity } from '../../../Utils/exportEntity.js';
import UploadIcon from '@mui/icons-material/Upload';
import DownloadIcon from '@mui/icons-material/Download';

const ROWS_PER_PAGE = 20;

// Local sort function for grade sections
const sortGradeSections = (sections) => {
  return [...sections].sort((a, b) => {
    const gradeA = parseInt(a.grade) || 0;
    const gradeB = parseInt(b.grade) || 0;
    if (gradeA !== gradeB) return gradeA - gradeB;
    return (a.section || '').localeCompare(b.section || '');
  });
};

function AdminMasterData() {
  const { success, error: toastError } = useToast();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const [activeTab, setActiveTab] = useState('gradeSections');
  
  // Search per tab
  const [gradeSectionSearch, setGradeSectionSearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [scheduleSearch, setScheduleSearch] = useState('');
  
  // Selection per tab
  const [selectedGradeSections, setSelectedGradeSections] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [selectedSchedules, setSelectedSchedules] = useState([]);
  
  // Raw data from tables (full datasets)
  const [gradeSectionData, setGradeSectionData] = useState([]);
  const [subjectData, setSubjectData] = useState([]);
  const [scheduleData, setScheduleData] = useState([]);
  
  // Pagination per tab
  const [gradeSectionPage, setGradeSectionPage] = useState(1);
  const [subjectPage, setSubjectPage] = useState(1);
  const [schedulePage, setSchedulePage] = useState(1);
  
  // "Select all pages" per tab
  const [isAllGradeSectionsSelected, setIsAllGradeSectionsSelected] = useState(false);
  const [isAllSubjectsSelected, setIsAllSubjectsSelected] = useState(false);
  const [isAllSchedulesSelected, setIsAllSchedulesSelected] = useState(false);
  
  // Delete modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteModalMode, setDeleteModalMode] = useState('single');
  const [entityToDelete, setEntityToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteEntityType, setDeleteEntityType] = useState('');

  // Stable callbacks for data updates - wrap in useCallback
  const handleGradeSectionDataUpdate = useCallback((data) => {
    setGradeSectionData(data);
  }, []);

  const handleSubjectDataUpdate = useCallback((data) => {
    setSubjectData(data);
  }, []);

  const handleScheduleDataUpdate = useCallback((data) => {
    setScheduleData(data);
  }, []);

  // Reset page & selections when tab or search changes
  useEffect(() => {
    setGradeSectionPage(1);
    setIsAllGradeSectionsSelected(false);
  }, [gradeSectionSearch]);

  useEffect(() => {
    setSubjectPage(1);
    setIsAllSubjectsSelected(false);
  }, [subjectSearch]);

  useEffect(() => {
    setSchedulePage(1);
    setIsAllSchedulesSelected(false);
  }, [scheduleSearch]);

  useEffect(() => {
    // Also reset when switching tabs
    setGradeSectionPage(1);
    setSubjectPage(1);
    setSchedulePage(1);
    setIsAllGradeSectionsSelected(false);
    setIsAllSubjectsSelected(false);
    setIsAllSchedulesSelected(false);
  }, [activeTab]);

  const handleOpenUploadModal = () => setIsUploadModalOpen(true);
  const handleCloseUploadModal = () => setIsUploadModalOpen(false);

  const handleUploadSuccess = () => {
    setRefreshKey(prev => prev + 1);
    setSelectedGradeSections([]);
    setSelectedSubjects([]);
    setSelectedSchedules([]);
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    if (activeTab === 'gradeSections') setGradeSectionSearch(value);
    else if (activeTab === 'subjects') setSubjectSearch(value);
    else if (activeTab === 'schedules') setScheduleSearch(value);
  };

  const getCurrentSearch = () => {
    switch (activeTab) {
      case 'gradeSections': return gradeSectionSearch;
      case 'subjects': return subjectSearch;
      case 'schedules': return scheduleSearch;
      default: return '';
    }
  };

  // ==================== GRADE SECTIONS PAGINATION ====================

  const filteredGradeSections = useMemo(() => {
    if (!gradeSectionSearch.trim()) return gradeSectionData;
    const q = gradeSectionSearch.toLowerCase().trim();
    return gradeSectionData.filter(item => 
      (item.grade?.toString() || '').toLowerCase().includes(q) ||
      (item.section?.toString() || '').toLowerCase().includes(q)
    );
  }, [gradeSectionData, gradeSectionSearch]);

  const sortedGradeSections = useMemo(() => {
    return sortGradeSections(filteredGradeSections);
  }, [filteredGradeSections]);

  const gradeSectionTotalPages = Math.ceil(sortedGradeSections.length / ROWS_PER_PAGE);

  const paginatedGradeSections = useMemo(() => {
    const start = (gradeSectionPage - 1) * ROWS_PER_PAGE;
    return sortedGradeSections.slice(start, start + ROWS_PER_PAGE);
  }, [sortedGradeSections, gradeSectionPage]);

  const visibleSelectedGradeSections = useMemo(() => {
    const visibleIds = new Set(paginatedGradeSections.map(gs => gs.id));
    return selectedGradeSections.filter(id => visibleIds.has(id));
  }, [selectedGradeSections, paginatedGradeSections]);

  const allGradeSectionsOnPageSelected = paginatedGradeSections.length > 0 && 
    paginatedGradeSections.every(gs => selectedGradeSections.includes(gs.id));

  const gradeSectionInfoText = (() => {
    if (isAllGradeSectionsSelected) return `All ${sortedGradeSections.length} grade sections selected`;
    if (allGradeSectionsOnPageSelected) return `Selected all ${paginatedGradeSections.length} Grade & Section/s • Page ${gradeSectionPage}`;
    if (visibleSelectedGradeSections.length > 0) return `${visibleSelectedGradeSections.length} selected • Page ${gradeSectionPage}`;
    return '';
  })();

  const gradeSectionSelectAllBanner = (() => {
    if (isAllGradeSectionsSelected) {
      return (
        <button
          onClick={() => { setIsAllGradeSectionsSelected(false); setSelectedGradeSections([]); }}
          onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
          onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}
          style={{
            background: '#2563eb', border: '1px solid #2563eb', borderRadius: '999px',
            cursor: 'pointer', color: 'white', fontSize: '0.85rem', fontWeight: 600,
            padding: '6px 12px', textDecoration: 'none', transition: 'background 0.2s ease'
          }}
        >
          Clear all
        </button>
      );
    }
    if (allGradeSectionsOnPageSelected && sortedGradeSections.length > paginatedGradeSections.length) {
      return (
        <button
          onClick={() => { 
            setIsAllGradeSectionsSelected(true); 
            setSelectedGradeSections(sortedGradeSections.map(gs => gs.id)); 
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
          onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}
          style={{
            background: '#0EA5E9', border: '1px solid #0EA5E9', borderRadius: '999px',
            cursor: 'pointer', color: 'white', fontSize: '0.85rem', fontWeight: 600,
            padding: '6px 12px', textDecoration: 'none', transition: 'background 0.2s ease'
          }}
        >
          <FontAwesomeIcon icon={faPlus} style={{ marginRight: '6px', fontSize: '0.75rem' }} />
          Select all {sortedGradeSections.length} grade sections
        </button>
      );
    }
    return null;
  })();

  // ==================== SUBJECTS PAGINATION (placeholder) ====================

  const filteredSubjects = useMemo(() => {
    if (!subjectSearch.trim()) return subjectData;
    const q = subjectSearch.toLowerCase().trim();
    return subjectData.filter(item =>
      (item.subject_code || '').toLowerCase().includes(q) ||
      (item.subject_name || '').toLowerCase().includes(q)
    );
  }, [subjectData, subjectSearch]);

  const sortedSubjects = useMemo(() => {
    return [...filteredSubjects].sort((a, b) => (a.subject_name || '').localeCompare(b.subject_name || ''));
  }, [filteredSubjects]);

  const subjectTotalPages = Math.ceil(sortedSubjects.length / ROWS_PER_PAGE);

  const paginatedSubjects = useMemo(() => {
    const start = (subjectPage - 1) * ROWS_PER_PAGE;
    return sortedSubjects.slice(start, start + ROWS_PER_PAGE);
  }, [sortedSubjects, subjectPage]);

  // ==================== SCHEDULES PAGINATION (placeholder) ====================

  const filteredSchedules = useMemo(() => {
    if (!scheduleSearch.trim()) return scheduleData;
    const q = scheduleSearch.toLowerCase().trim();
    return scheduleData.filter(item =>
      (item.grade_level?.toString() || '').toLowerCase().includes(q)
    );
  }, [scheduleData, scheduleSearch]);

  const sortedSchedules = useMemo(() => {
    return [...filteredSchedules].sort((a, b) => (parseInt(a.grade_level) || 0) - (parseInt(b.grade_level) || 0));
  }, [filteredSchedules]);

  const scheduleTotalPages = Math.ceil(sortedSchedules.length / ROWS_PER_PAGE);

  const paginatedSchedules = useMemo(() => {
    const start = (schedulePage - 1) * ROWS_PER_PAGE;
    return sortedSchedules.slice(start, start + ROWS_PER_PAGE);
  }, [sortedSchedules, schedulePage]);

  // ==================== SELECTION HANDLERS WITH GUARDS ====================

  // FIX: Guard against overwriting when all pages are selected
  const handleGradeSectionsSelectedUpdate = (selected) => {
    if (isAllGradeSectionsSelected) return; // ← Don't let the table clobber the full selection
    setSelectedGradeSections(selected);
    if (selected.length === 0) {
      setIsAllGradeSectionsSelected(false);
    }
  };

  // FIX: Guard against overwriting when all pages are selected
  const handleSubjectsSelectedUpdate = (selected) => {
    if (isAllSubjectsSelected) return; // ← Don't let the table clobber the full selection
    setSelectedSubjects(selected);
    if (selected.length === 0) {
      setIsAllSubjectsSelected(false);
    }
  };

  // FIX: Guard against overwriting when all pages are selected
  const handleSchedulesSelectedUpdate = (selected) => {
    if (isAllSchedulesSelected) return; // ← Don't let the table clobber the full selection
    setSelectedSchedules(selected);
    if (selected.length === 0) {
      setIsAllSchedulesSelected(false);
    }
  };

  // ==================== DELETE HANDLERS ====================

  const getSelectedCount = () => {
    switch (activeTab) {
      case 'gradeSections': return selectedGradeSections.length;
      case 'subjects': return selectedSubjects.length;
      case 'schedules': return selectedSchedules.length;
      default: return 0;
    }
  };

  const handleBulkDeleteClick = () => {
    setDeleteEntityType(normalizeDeleteEntityType(activeTab));
    setDeleteModalMode('bulk');
    setIsDeleteModalOpen(true);
  };

  const handleSingleDeleteClick = (entity, entityType) => {
    setDeleteEntityType(normalizeDeleteEntityType(entityType));
    setDeleteModalMode('single');
    setEntityToDelete(entity);
    setIsDeleteModalOpen(true);
  };

  const normalizeDeleteEntityType = (type) => {
    if (type === 'gradeSections' || type === 'gradeSection' || type === 'grade section') return 'gradeSections';
    if (type === 'subjects' || type === 'subject') return 'subjects';
    if (type === 'schedules' || type === 'schedule' || type === 'grade schedule' || type === 'gradeSchedule') return 'schedules';
    return type;
  };

  const getModalEntityType = () => {
    if (deleteEntityType === 'gradeSections') return 'grade section';
    if (deleteEntityType === 'subjects') return 'subject';
    if (deleteEntityType === 'schedules') return 'grade schedule';
    return 'entity';
  };

  const getModalEntityData = () => {
    if (deleteEntityType === 'gradeSections') return gradeSectionData;
    if (deleteEntityType === 'subjects') return subjectData;
    if (deleteEntityType === 'schedules') return scheduleData;
    return [];
  };

  const getSelectedEntitiesForModal = () => {
    const data = getModalEntityData();
    const selectedIds = deleteEntityType === 'gradeSections' ? selectedGradeSections
      : deleteEntityType === 'subjects' ? selectedSubjects
      : selectedSchedules;
    return selectedIds.map(id => data.find(item => String(item.id) === String(id))).filter(Boolean);
  };

  const handleConfirmDelete = async (idOrIds) => {
    setIsDeleting(true);
    try {
      // Import services dynamically or use EntityService
      const { EntityService } = await import('../../../Utils/EntityService.js');
      
      if (deleteModalMode === 'single') {
        const service = new EntityService(
          deleteEntityType === 'gradeSections' ? 'sections' 
          : deleteEntityType === 'subjects' ? 'subjects' 
          : 'grade_schedules'
        );
        await service.delete(idOrIds);
        success(`${getModalEntityType()} deleted successfully`);
      } else {
        const service = new EntityService(
          deleteEntityType === 'gradeSections' ? 'sections' 
          : deleteEntityType === 'subjects' ? 'subjects' 
          : 'grade_schedules'
        );
        for (const id of idOrIds) {
          await service.delete(id);
        }
        success(`${idOrIds.length} ${getModalEntityType()}s deleted successfully`);
        if (deleteEntityType === 'gradeSections') setSelectedGradeSections([]);
        else if (deleteEntityType === 'subjects') setSelectedSubjects([]);
        else if (deleteEntityType === 'schedules') setSelectedSchedules([]);
      }
      
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error('Delete error:', err);
      toastError(`Failed to delete: ${err.message}`);
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      setEntityToDelete(null);
      setDeleteEntityType('');
    }
  };

  // ==================== EXPORT ====================

  const getAllMasterData = () => ({
    gradeSections: gradeSectionData,
    subjects: subjectData,
    schedules: scheduleData,
  });

  const hasAnyMasterData = () => {
    return gradeSectionData.length > 0 || subjectData.length > 0 || scheduleData.length > 0;
  };

  const handleExportMasterData = () => {
    try {
      exportEntity({
        entity: 'masterData',
        data: getAllMasterData(),
        filename: 'master-data-export',
      });
      success('Successfully downloaded full master data file (all sheets)');
    } catch (err) {
      toastError(`Failed to export master data: ${err.message}`);
    }
  };

  // ==================== RENDER HELPERS ====================

  const getSearchPlaceholder = () => {
    switch (activeTab) {
      case 'gradeSections': return "Search Grade and Section Records...";
      case 'subjects': return "Search Subject Records...";
      case 'schedules': return "Search Grade Schedules Records...";
      default: return "Search...";
    }
  };

  const getNewEntityButtonLabel = () => {
    switch (activeTab) {
      case 'gradeSections': return '+ New Sections';
      case 'subjects': return '+ New Subject';
      case 'schedules': return '+ New Schedules';
      default: return '+ New Entity';
    }
  };

  const getTableInfoMessage = () => {
    switch (activeTab) {
      case 'gradeSections':
        if (gradeSectionSearch) return `Found ${sortedGradeSections.length} grade section/s matching "${gradeSectionSearch}"`;
        return `Showing ${sortedGradeSections.length} grade section/s`;
      case 'subjects':
        if (subjectSearch) return `Found ${sortedSubjects.length} subject/s matching "${subjectSearch}"`;
        return `Showing ${sortedSubjects.length} subject/s`;
      case 'schedules':
        if (scheduleSearch) return `Found ${sortedSchedules.length} schedule/s matching "${scheduleSearch}"`;
        return `Showing ${sortedSchedules.length} grade schedule/s`;
      default: return '';
    }
  };

  return (
    <main className={styles.main}>
      <SectionLabel label="Master Data Records" />
      
      <div className={styles.top}>
        <div className={styles.topLeft}>
          <Button
            height="sm" 
            width="auto"
            icon={<DownloadIcon/>}
            label="Export"
            color="teaGreen"
            onClick={handleExportMasterData}
            disabled={!hasAnyMasterData()}
          />
          <Button
            height="sm" 
            width="auto"
            icon={<UploadIcon/>}
            label="Import"
            color="teaGreen"
            onClick={handleOpenUploadModal}
          />
          
          {getSelectedCount() > 0 && (
            <div className={styles.bulkActions}>
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
            placeholder={getSearchPlaceholder()} 
            value={getCurrentSearch()}
            onChange={handleSearchChange}
            search="true"
          />
          <Button
            height="sm" 
            width="lg"
            label={getNewEntityButtonLabel()}
            color="ocean"
            onClick={handleOpenUploadModal}
          />
        </div>
      </div>

      {/* Tab Navigation with Pagination */}
      <div className={styles.tabContainer}>
        <div className={styles.tabsContainer}>
          <div className={styles.tabs}>
            <Button
              label="Grade & Section"
              line={true}
              height="xs"
              width="auto"
              active={activeTab === 'gradeSections'}
              onClick={() => setActiveTab('gradeSections')}
            />
            <Button
              label="Subjects"
              line={true}
              height="xs"
              width="auto"
              active={activeTab === 'subjects'}
              onClick={() => setActiveTab('subjects')}
            />
            <Button
              label="Grade & Schedules"
              line={true}
              height="xs"
              width="auto"
              active={activeTab === 'schedules'}
              onClick={() => setActiveTab('schedules')}
            />
          </div>
          
          <div className={styles.tabActions}>
            {/* Info text */}
            <span className={styles.tableInfoText}></span>
            
            {/* Selection info + banners + pagination for active tab */}
            {activeTab === 'gradeSections' && (
              <>
                {gradeSectionInfoText && (
                  <span className={styles.selectedInfoText}>{gradeSectionInfoText}</span>
                )}
                {gradeSectionSelectAllBanner}
                {gradeSectionTotalPages > 1 && (
                  <Pagination 
                    currentPage={gradeSectionPage} 
                    totalPages={gradeSectionTotalPages} 
                    onPageChange={setGradeSectionPage} 
                  />
                )}
              </>
            )}
            
            {activeTab === 'subjects' && (
              <>
                {subjectTotalPages > 1 && (
                  <Pagination 
                    currentPage={subjectPage} 
                    totalPages={subjectTotalPages} 
                    onPageChange={setSubjectPage} 
                  />
                )}
              </>
            )}
            
            {activeTab === 'schedules' && (
              <>
                {scheduleTotalPages > 1 && (
                  <Pagination 
                    currentPage={schedulePage} 
                    totalPages={scheduleTotalPages} 
                    onPageChange={setSchedulePage} 
                  />
                )}
              </>
            )}
          </div>
        </div>
        
        <div className={styles.tabContent}>
          {/* Render all tables always so data is fetched for export, hide via CSS */}
          <div style={{ display: activeTab === 'gradeSections' ? 'block' : 'none' }}>
            <GradeSectionTable 
              searchTerm={gradeSectionSearch}
              gradeSections={paginatedGradeSections}
              totalFilteredCount={sortedGradeSections.length}
              selectedGradeSections={selectedGradeSections}
              onSelectedGradeSectionsUpdate={handleGradeSectionsSelectedUpdate}
              onSingleDeleteClick={handleSingleDeleteClick}
              onEntityDataUpdate={handleGradeSectionDataUpdate}
              isAllPagesSelected={isAllGradeSectionsSelected}
              onSelectAllPages={() => {
                setIsAllGradeSectionsSelected(true);
                setSelectedGradeSections(sortedGradeSections.map(gs => gs.id));
              }}
              onClearAllPages={() => {
                setIsAllGradeSectionsSelected(false);
                setSelectedGradeSections([]);
              }}
              currentPage={gradeSectionPage}
              refreshTrigger={refreshKey}
            />
          </div>

          <div style={{ display: activeTab === 'subjects' ? 'block' : 'none' }}>
            <SubjectTable 
              key={`subject-${refreshKey}`}
              searchTerm={subjectSearch}
              subjects={paginatedSubjects}
              totalFilteredCount={sortedSubjects.length}
              selectedSubjects={selectedSubjects}
              onSelectedSubjectsUpdate={handleSubjectsSelectedUpdate}
              onSingleDeleteClick={handleSingleDeleteClick}
              onEntityDataUpdate={handleSubjectDataUpdate}
              currentPage={subjectPage}
            />
          </div>

          <div style={{ display: activeTab === 'schedules' ? 'block' : 'none' }}>
            <GradeSchedulesTable 
              key={`schedule-${refreshKey}`}
              searchTerm={scheduleSearch}
              schedules={paginatedSchedules}
              totalFilteredCount={sortedSchedules.length}
              selectedSchedules={selectedSchedules}
              onSelectedSchedulesUpdate={handleSchedulesSelectedUpdate}
              onSingleDeleteClick={handleSingleDeleteClick}
              onEntityDataUpdate={handleScheduleDataUpdate}
              currentPage={schedulePage}
            />
          </div>
        </div>
      </div>

      <FileUploadModal
        isOpen={isUploadModalOpen}
        onClose={handleCloseUploadModal}
        entityType="master-data"
        onUploadSuccess={handleUploadSuccess}
      />
      
      <DeleteEntityModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!isDeleting) {
            setIsDeleteModalOpen(false);
            setEntityToDelete(null);
            setDeleteEntityType('');
          }
        }}
        entity={deleteModalMode === 'single' ? entityToDelete : null}
        selectedEntities={deleteModalMode === 'bulk' ? getSelectedEntitiesForModal() : []}
        entityType={getModalEntityType()}
        entityData={getModalEntityData()}
        onConfirm={deleteModalMode === 'single' ? handleConfirmDelete : undefined}
        onConfirmBulk={deleteModalMode === 'bulk' ? handleConfirmDelete : undefined}
        currentFilter={getCurrentSearch()}
      />
    </main>
  );
}

export default AdminMasterData;