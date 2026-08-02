// AdminMasterData.jsx
import { useState, useCallback, useEffect, useMemo } from 'react';
import styles from './AdminMasterData.module.css';
import SectionLabel from "../../../Components/UI/Labels/SectionLabel/SectionLabel.jsx";
import FileUploadModal from '../../../Components/Modals/FileUploadModal/FileUploadModal.jsx';
import Button from '../../../Components/UI/Buttons/Button/Button.jsx';
import Input from  "../../../Components/UI/Inputs/Input/Input.jsx";
import DeleteEntityModal from '../../../Components/Modals/DeleteEntityModal/DeleteEntityModal.jsx';
import Pagination from '../../../Components/UI/Buttons/Pagination/Pagination.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faPlus } from "@fortawesome/free-solid-svg-icons";
import GradeSectionTable from '../../../Components/Tables/GradeSectionTable/GradeSectionTable.jsx';
import GradeSchedulesTable from '../../../Components/Tables/GradeSchedulesTable/GradeSchedulesTable.jsx';
import { useToast } from '../../../Components/Toast/ToastContext/ToastContext.jsx';
import { exportEntity } from '../../../Utils/exportEntity.js';
import UploadIcon from '@mui/icons-material/Upload';
import DownloadIcon from '@mui/icons-material/Download';
import useSearchFilter from '../../../Components/Hooks/useSearchFilter.js';
import { deleteSectionsWithGradeCascade } from '../../../Utils/gradeSectionCascade.js';

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
  
  // Selection per tab
  const [selectedGradeSections, setSelectedGradeSections] = useState([]);
  const [selectedSchedules, setSelectedSchedules] = useState([]);
  
  // Raw data from tables (full datasets)
  const [gradeSectionData, setGradeSectionData] = useState([]);
  const [scheduleData, setScheduleData] = useState([]);
  
  // Pagination per tab
  const [gradeSectionPage, setGradeSectionPage] = useState(1);
  const [schedulePage, setSchedulePage] = useState(1);
  
  // "Select all pages" per tab
  const [isAllGradeSectionsSelected, setIsAllGradeSectionsSelected] = useState(false);
  const [isAllSchedulesSelected, setIsAllSchedulesSelected] = useState(false);
  
  // Delete modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteModalMode, setDeleteModalMode] = useState('single');
  const [entityToDelete, setEntityToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteEntityType, setDeleteEntityType] = useState('');

  // Apply search filter to grade sections
  const { 
    searchTerm: gradeSectionSearch, 
    setSearchTerm: setGradeSectionSearch, 
    filteredRows: gradeSectionFilteredRows 
  } = useSearchFilter(gradeSectionData, [
    'grade',
    'section'
  ]);

  // Apply search filter to schedules
  const { 
    searchTerm: scheduleSearch, 
    setSearchTerm: setScheduleSearch, 
    filteredRows: scheduleFilteredRows 
  } = useSearchFilter(scheduleData, [
    'grade_level',
    'subject_code',
    'teacher_name'
  ]);

  // Stable callbacks for data updates - wrap in useCallback
  const handleGradeSectionDataUpdate = useCallback((data) => {
    setGradeSectionData(data);
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
    setSchedulePage(1);
    setIsAllSchedulesSelected(false);
  }, [scheduleSearch]);

  useEffect(() => {
    // Also reset when switching tabs
    setGradeSectionPage(1);
    setSchedulePage(1);
    setIsAllGradeSectionsSelected(false);
    setIsAllSchedulesSelected(false);
  }, [activeTab]);

  const handleOpenUploadModal = () => setIsUploadModalOpen(true);
  const handleCloseUploadModal = () => setIsUploadModalOpen(false);

  const handleUploadSuccess = () => {
    setRefreshKey(prev => prev + 1);
    setSelectedGradeSections([]);
    setSelectedSchedules([]);
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    if (activeTab === 'gradeSections') setGradeSectionSearch(value);
    else if (activeTab === 'schedules') setScheduleSearch(value);
  };

  const getCurrentSearch = () => {
    switch (activeTab) {
      case 'gradeSections': return gradeSectionSearch;
      case 'schedules': return scheduleSearch;
      default: return '';
    }
  };

  // ==================== GRADE SECTIONS PAGINATION ====================

  // Use filtered rows from the hook directly
  const filteredGradeSections = gradeSectionFilteredRows;

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
    if (selectedGradeSections.length === sortedGradeSections.length && sortedGradeSections.length > 0)
      return `All ${sortedGradeSections.length} grade sections selected`;
    if (selectedGradeSections.length > 0) return `${selectedGradeSections.length} grade section/s selected`;
    return '';
  })();

  const gradeSectionSelectAllBanner = (() => {
    if (selectedGradeSections.length === sortedGradeSections.length && sortedGradeSections.length > 0 && sortedGradeSections.length > paginatedGradeSections.length) {
      return (
        <button
          onClick={() => { setIsAllGradeSectionsSelected(false); setSelectedGradeSections([]); }}
          onMouseEnter={e => e.currentTarget.style.background = '#0a5042'}
          onMouseLeave={e => e.currentTarget.style.background = '#0f6b58'}
          style={{
            background: '#0f6b58', border: '1px solid #0f6b58', borderRadius: '999px',
            cursor: 'pointer', color: 'white', fontSize: '0.85rem', fontWeight: 600,
            padding: '6px 12px', transition: 'background 0.2s ease'
          }}
        >
          Clear all
        </button>
      );
    }
    if (selectedGradeSections.length > 0 && sortedGradeSections.length > paginatedGradeSections.length) {
      return (
        <button
          onClick={() => { 
            setIsAllGradeSectionsSelected(true); 
            setSelectedGradeSections(sortedGradeSections.map(gs => gs.id)); 
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#0a5042'}
          onMouseLeave={e => e.currentTarget.style.background = '#0f6b58'}
          style={{
            background: '#0f6b58', border: '1px solid #0f6b58', borderRadius: '999px',
            cursor: 'pointer', color: 'white', fontSize: '0.85rem', fontWeight: 600,
            padding: '6px 12px', transition: 'background 0.2s ease'
          }}
        >
          <FontAwesomeIcon icon={faPlus} style={{ marginRight: '6px', fontSize: '0.75rem' }} />
          Select all {sortedGradeSections.length} grade sections
        </button>
      );
    }
    return null;
  })();

  // ==================== SCHEDULES PAGINATION ====================

  // Use filtered rows from the hook directly
  const filteredSchedules = scheduleFilteredRows;

  const sortedSchedules = useMemo(() => {
    return [...filteredSchedules].sort((a, b) => (parseInt(a.grade_level) || 0) - (parseInt(b.grade_level) || 0));
  }, [filteredSchedules]);

  const scheduleTotalPages = Math.ceil(sortedSchedules.length / ROWS_PER_PAGE);

  const paginatedSchedules = useMemo(() => {
    const start = (schedulePage - 1) * ROWS_PER_PAGE;
    return sortedSchedules.slice(start, start + ROWS_PER_PAGE);
  }, [sortedSchedules, schedulePage]);

  const visibleSelectedSchedules = useMemo(() => {
    const visibleIds = new Set(paginatedSchedules.map(s => s.id));
    return selectedSchedules.filter(id => visibleIds.has(id));
  }, [selectedSchedules, paginatedSchedules]);

  const allSchedulesOnPageSelected = paginatedSchedules.length > 0 &&
    paginatedSchedules.every(s => selectedSchedules.includes(s.id));

  const scheduleInfoText = (() => {
    if (selectedSchedules.length === sortedSchedules.length && sortedSchedules.length > 0)
      return `All ${sortedSchedules.length} schedules selected`;
    if (selectedSchedules.length > 0) return `${selectedSchedules.length} schedule/s selected`;
    return '';
  })();

  const scheduleSelectAllBanner = (() => {
    if (selectedSchedules.length === sortedSchedules.length && sortedSchedules.length > 0 && sortedSchedules.length > paginatedSchedules.length) {
      return (
        <button
          onClick={() => { setIsAllSchedulesSelected(false); setSelectedSchedules([]); }}
          onMouseEnter={e => e.currentTarget.style.background = '#0a5042'}
          onMouseLeave={e => e.currentTarget.style.background = '#0f6b58'}
          style={{
            background: '#0f6b58', border: '1px solid #0f6b58', borderRadius: '999px',
            cursor: 'pointer', color: 'white', fontSize: '0.85rem', fontWeight: 600,
            padding: '6px 12px', transition: 'background 0.2s ease'
          }}
        >
          Clear all
        </button>
      );
    }
    if (selectedSchedules.length > 0 && sortedSchedules.length > paginatedSchedules.length) {
      return (
        <button
          onClick={() => { setIsAllSchedulesSelected(true); setSelectedSchedules(sortedSchedules.map(s => s.id)); }}
          onMouseEnter={e => e.currentTarget.style.background = '#0a5042'}
          onMouseLeave={e => e.currentTarget.style.background = '#0f6b58'}
          style={{
            background: '#0f6b58', border: '1px solid #0f6b58', borderRadius: '999px',
            cursor: 'pointer', color: 'white', fontSize: '0.85rem', fontWeight: 600,
            padding: '6px 12px', transition: 'background 0.2s ease'
          }}
        >
          <FontAwesomeIcon icon={faPlus} style={{ marginRight: '6px', fontSize: '0.75rem' }} />
          Select all {sortedSchedules.length} schedules
        </button>
      );
    }
    return null;
  })();

  // ==================== SELECTION HANDLERS WITH GUARDS ====================

  const handleGradeSectionsSelectedUpdate = (selected) => {
    if (isAllGradeSectionsSelected) return;
    setSelectedGradeSections(selected);
    if (selected.length === 0) {
      setIsAllGradeSectionsSelected(false);
    }
  };

  const handleSchedulesSelectedUpdate = (selected) => {
    if (isAllSchedulesSelected) return;
    setSelectedSchedules(selected);
    if (selected.length === 0) {
      setIsAllSchedulesSelected(false);
    }
  };

  // ==================== DELETE HANDLERS ====================

  const getSelectedCount = () => {
    switch (activeTab) {
      case 'gradeSections': return selectedGradeSections.length;
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
    if (type === 'schedules' || type === 'schedule' || type === 'grade schedule' || type === 'gradeSchedule') return 'schedules';
    return type;
  };

  const getModalEntityType = () => {
    if (deleteEntityType === 'gradeSections') return 'grade section';
    if (deleteEntityType === 'schedules') return 'grade schedule';
    return 'entity';
  };

  const getModalEntityData = () => {
    if (deleteEntityType === 'gradeSections') return gradeSectionData;
    if (deleteEntityType === 'schedules') return scheduleData;
    return [];
  };

  const getSelectedEntitiesForModal = () => {
    const data = getModalEntityData();
    const selectedIds = deleteEntityType === 'gradeSections' ? selectedGradeSections
      : selectedSchedules;
    return selectedIds.map(id => data.find(item => String(item.id) === String(id))).filter(Boolean);
  };

  // ===== UPDATED: handleConfirmDelete with cascade deletion for sections =====
  const handleConfirmDelete = async (idOrIds) => {
    setIsDeleting(true);
    try {
      if (deleteEntityType === 'gradeSections') {
        // Sections need the grade-cascade check; schedules don't (no children to check).
        const ids = deleteModalMode === 'single' ? [idOrIds] : idOrIds;
        const { deletedGradeIds } = await deleteSectionsWithGradeCascade(ids);

        const count = ids.length;
        success(
          deletedGradeIds.length > 0
            ? `${count} grade section${count !== 1 ? 's' : ''} deleted — ${deletedGradeIds.length} grade level${deletedGradeIds.length !== 1 ? 's' : ''} removed (no sections remaining)`
            : `${count} grade section${count !== 1 ? 's' : ''} deleted successfully`
        );

        if (deleteModalMode === 'bulk') setSelectedGradeSections([]);
      } else {
        // Non-section entities (schedules) keep the existing simple delete path.
        const { EntityService } = await import('../../../Utils/EntityService.js');
        const service = new EntityService('grade_schedules');

        if (deleteModalMode === 'single') {
          await service.delete(idOrIds);
          success(`${getModalEntityType()} deleted successfully`);
        } else {
          for (const id of idOrIds) {
            await service.delete(id);
          }
          success(`${idOrIds.length} ${getModalEntityType()}s deleted successfully`);
          setSelectedSchedules([]);
        }
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
    schedules: scheduleData,
  });

  const hasAnyMasterData = () => {
    return gradeSectionData.length > 0 || scheduleData.length > 0;
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
      case 'schedules': return "Search Grade Schedules Records...";
      default: return "Search...";
    }
  };

  const getNewEntityButtonLabel = () => {
    switch (activeTab) {
      case 'gradeSections': return '+ New Sections';
      case 'schedules': return '+ New Schedules';
      default: return '+ New Entity';
    }
  };

  const getTableInfoMessage = () => {
    switch (activeTab) {
      case 'gradeSections':
        if (gradeSectionSearch) return `Found ${sortedGradeSections.length} grade section/s matching "${gradeSectionSearch}"`;
        return `Showing ${sortedGradeSections.length} grade section/s`;
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
                  <span style={{
                    color: '#3f4f67',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    padding: '6px 10px',
                    borderRadius: '999px',
                    background: '#e8f4ef',
                    border: '1px solid #cae6dd',
                    whiteSpace: 'nowrap'
                  }}>
                    {gradeSectionInfoText}
                  </span>
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
            
            {activeTab === 'schedules' && (
              <>
                {scheduleInfoText && (
                  <span style={{
                    color: '#3f4f67',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    padding: '6px 10px',
                    borderRadius: '999px',
                    background: '#e8f4ef',
                    border: '1px solid #cae6dd',
                    whiteSpace: 'nowrap'
                  }}>
                    {scheduleInfoText}
                  </span>
                )}
                {scheduleSelectAllBanner}
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

          <div style={{ display: activeTab === 'schedules' ? 'block' : 'none' }}>
            <GradeSchedulesTable 
              // REMOVED: key={`schedule-${refreshKey}`} remount hack
              // ADDED: refreshTrigger prop to trigger silent refetch on upload
              searchTerm={scheduleSearch}
              schedules={paginatedSchedules}
              totalFilteredCount={sortedSchedules.length}
              selectedSchedules={selectedSchedules}
              onSelectedSchedulesUpdate={handleSchedulesSelectedUpdate}
              onSingleDeleteClick={handleSingleDeleteClick}
              onEntityDataUpdate={handleScheduleDataUpdate}
              isAllPagesSelected={isAllSchedulesSelected}
              onSelectAllPages={() => {
                setIsAllSchedulesSelected(true);
                setSelectedSchedules(sortedSchedules.map(s => s.id));
              }}
              onClearAllPages={() => {
                setIsAllSchedulesSelected(false);
                setSelectedSchedules([]);
              }}
              currentPage={schedulePage}
              refreshTrigger={refreshKey}  // ← ADDED: connects to refreshKey
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
        gradeSchedulesData={scheduleData}
        onConfirm={deleteModalMode === 'single' ? handleConfirmDelete : undefined}
        onConfirmBulk={deleteModalMode === 'bulk' ? handleConfirmDelete : undefined}
        currentFilter={getCurrentSearch()}
      />
    </main>
  );
}

export default AdminMasterData;