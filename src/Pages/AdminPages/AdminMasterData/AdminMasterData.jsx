import { useState, useCallback, useEffect } from 'react';
import styles from './AdminMasterData.module.css';
import SectionLabel from "../../../Components/UI/Labels/SectionLabel/SectionLabel.jsx";
import FileUploadModal from '../../../Components/Modals/FileUploadModal/FileUploadModal.jsx';
import Button from '../../../Components/UI/Buttons/Button/Button.jsx';
import Input from '../../../Components/UI/Input/Input.jsx';
import DeleteEntityModal from '../../../Components/Modals/DeleteEntityModal/DeleteEntityModal.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import TableChartIcon from '@mui/icons-material/TableChart';
import GradeSectionTable from '../../../Components/Tables/GradeSectionTable/GradeSectionTable.jsx';
import SubjectTable from '../../../Components/Tables/SubjectTable/SubjectTable.jsx';
import GradeSchedulesTable from '../../../Components/Tables/GradeSchedulesTable/GradeSchedulesTable.jsx';
import { useToast } from '../../../Components/Toast/ToastContext/ToastContext.jsx';
import { EntityService } from '../../../Utils/EntityService.js';
import { exportEntity } from '../../../Utils/exportEntity.js';
import UploadIcon from '@mui/icons-material/Upload';
import DownloadIcon from '@mui/icons-material/Download';

function AdminMasterData() {
  const { success, error: toastError } = useToast();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const [activeTab, setActiveTab] = useState('gradeSections');
  const [tableInfoByTab, setTableInfoByTab] = useState({
    gradeSections: '',
    subjects: '',
    schedules: ''
  });
  
  const [gradeSectionSearch, setGradeSectionSearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [scheduleSearch, setScheduleSearch] = useState('');
  
  const [selectedGradeSections, setSelectedGradeSections] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [selectedSchedules, setSelectedSchedules] = useState([]);
  const [gradeSectionData, setGradeSectionData] = useState([]);
  const [subjectData, setSubjectData] = useState([]);
  const [scheduleData, setScheduleData] = useState([]);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteModalMode, setDeleteModalMode] = useState('single');
  const [entityToDelete, setEntityToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteEntityType, setDeleteEntityType] = useState('');

  const sectionService = new EntityService('sections');
  const subjectService = new EntityService('subjects');
  const scheduleService = new EntityService('grade_schedules');

  const handleOpenUploadModal = () => {
    setIsUploadModalOpen(true);
  };

  const handleCloseUploadModal = () => {
    setIsUploadModalOpen(false);
  };

  const handleUploadSuccess = () => {
    setRefreshKey(prevKey => prevKey + 1);
    setSelectedGradeSections([]);
    setSelectedSubjects([]);
    setSelectedSchedules([]);
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    if (activeTab === 'gradeSections') {
      setGradeSectionSearch(value);
    } else if (activeTab === 'subjects') {
      setSubjectSearch(value);
    } else if (activeTab === 'schedules') {
      setScheduleSearch(value);
    }
  };

  const handleGradeSectionsSelectedUpdate = (selected) => {
    setSelectedGradeSections(selected);
  };

  const handleSubjectsSelectedUpdate = (selected) => {
    setSelectedSubjects(selected);
  };

  const handleSchedulesSelectedUpdate = (selected) => {
    setSelectedSchedules(selected);
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
    if (type === 'gradeSections' || type === 'gradeSection' || type === 'grade section') {
      return 'gradeSections';
    }
    if (type === 'subjects' || type === 'subject') {
      return 'subjects';
    }
    if (type === 'schedules' || type === 'schedule' || type === 'grade schedule' || type === 'gradeSchedule') {
      return 'schedules';
    }
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

    const selectedIds = deleteEntityType === 'gradeSections'
      ? selectedGradeSections
      : deleteEntityType === 'subjects'
      ? selectedSubjects
      : selectedSchedules;

    return selectedIds
      .map((id) => data.find((item) => String(item.id) === String(id)))
      .filter(Boolean);
  };

  const deleteSingleGradeSectionAPI = async (id) => {
    try {
      await sectionService.delete(id);
      return { success: true };
    } catch (err) {
      throw new Error(`Failed to delete grade section: ${err.message}`);
    }
  };

  const deleteMultipleGradeSectionsAPI = async (ids) => {
    try {
      for (const id of ids) {
        await sectionService.delete(id);
      }
      return { success: true };
    } catch (err) {
      throw new Error(`Failed to delete grade sections: ${err.message}`);
    }
  };

  const deleteSingleSubjectAPI = async (id) => {
    try {
      await subjectService.delete(id);
      return { success: true };
    } catch (err) {
      throw new Error(`Failed to delete subject: ${err.message}`);
    }
  };

  const deleteMultipleSubjectsAPI = async (ids) => {
    try {
      for (const id of ids) {
        await subjectService.delete(id);
      }
      return { success: true };
    } catch (err) {
      throw new Error(`Failed to delete subjects: ${err.message}`);
    }
  };

  const deleteSingleScheduleAPI = async (id) => {
    try {
      await scheduleService.delete(id);
      return { success: true };
    } catch (err) {
      throw new Error(`Failed to delete schedule: ${err.message}`);
    }
  };

  const deleteMultipleSchedulesAPI = async (ids) => {
    try {
      for (const id of ids) {
        await scheduleService.delete(id);
      }
      return { success: true };
    } catch (err) {
      throw new Error(`Failed to delete schedules: ${err.message}`);
    }
  };

  const handleConfirmDelete = async (idOrIds) => {
    setIsDeleting(true);
    
    try {
      if (deleteModalMode === 'single') {
        if (deleteEntityType === 'gradeSections') {
          await deleteSingleGradeSectionAPI(idOrIds);
          success('Grade section deleted successfully');
        } else if (deleteEntityType === 'subjects') {
          await deleteSingleSubjectAPI(idOrIds);
          success('Subject deleted successfully');
        } else if (deleteEntityType === 'schedules') {
          await deleteSingleScheduleAPI(idOrIds);
          success('Grade schedule deleted successfully');
        }
      } else {
        if (deleteEntityType === 'gradeSections') {
          await deleteMultipleGradeSectionsAPI(idOrIds);
          success(`${idOrIds.length} grade sections deleted successfully`);
          setSelectedGradeSections([]);
        } else if (deleteEntityType === 'subjects') {
          await deleteMultipleSubjectsAPI(idOrIds);
          success(`${idOrIds.length} subjects deleted successfully`);
          setSelectedSubjects([]);
        } else if (deleteEntityType === 'schedules') {
          await deleteMultipleSchedulesAPI(idOrIds);
          success(`${idOrIds.length} grade schedules deleted successfully`);
          setSelectedSchedules([]);
        }
      }
      
      setRefreshKey(prevKey => prevKey + 1);
      
    } catch (err) {
      console.error('❌ Delete error:', err);
      toastError(`Failed to delete: ${err.message}`);
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      setEntityToDelete(null);
      setDeleteEntityType('');
    }
  };

  const getSearchPlaceholder = () => {
    switch (activeTab) {
      case 'gradeSections':
        return "Search Grade and Section Records...";
      case 'subjects':
        return "Search Subject Records...";
      case 'schedules':
        return "Search Grade Schedules Records...";
      default:
        return "Search...";
    }
  };

  const getNewEntityButtonLabel = () => {
    switch (activeTab) {
      case 'gradeSections':
        return '+ New Sections';
      case 'subjects':
        return '+ New Subject';
      case 'schedules':
        return '+ New Schedules';
      default:
        return '+ New Entity';
    }
  };

  const getSelectedCount = () => {
    switch (activeTab) {
      case 'gradeSections':
        return selectedGradeSections.length;
      case 'subjects':
        return selectedSubjects.length;
      case 'schedules':
        return selectedSchedules.length;
      default:
        return 0;
    }
  };

  const getCurrentSearch = () => {
    switch (activeTab) {
      case 'gradeSections':
        return gradeSectionSearch;
      case 'subjects':
        return subjectSearch;
      case 'schedules':
        return scheduleSearch;
      default:
        return '';
    }
  };

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

  const handleTableInfoChange = useCallback((tabKey, infoText) => {
    setTableInfoByTab((previous) => ({
      ...previous,
      [tabKey]: infoText
    }));
  }, []);

  // Memoized handlers to avoid infinite re-renders
  const handleGradeSectionsInfoTextChange = useCallback(
    (text) => handleTableInfoChange('gradeSections', text),
    [handleTableInfoChange]
  );
  const handleSubjectsInfoTextChange = useCallback(
    (text) => handleTableInfoChange('subjects', text),
    [handleTableInfoChange]
  );
  const handleSchedulesInfoTextChange = useCallback(
    (text) => handleTableInfoChange('schedules', text),
    [handleTableInfoChange]
  );

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
            color="coolGray"
            onClick={handleExportMasterData}
            disabled={!hasAnyMasterData()}
          />
          <Button
            height="sm" 
            width="auto"
            icon={<UploadIcon/>}
            label="Import"
            color="coolGray"
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

      {/* Tab Navigation */}
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
          
          <div className={styles.tableInfo}>
            {tableInfoByTab[activeTab] && <p>{tableInfoByTab[activeTab]}</p>}
            {getSelectedCount() > 0 && <p className={styles.selectedInfoText}>{getSelectedCount()} selected</p>}
          </div>
        </div>
        
        {/* CHANGED: Removed .tableWrapper and use .tabContent instead */}
        <div className={styles.tabContent}>
          {/* Render all tables always so data is fetched for export, hide via CSS */}
          <div style={{ display: activeTab === 'gradeSections' ? 'block' : 'none' }}>
            <GradeSectionTable 
              key={`grade-section-${refreshKey}`}
              searchTerm={gradeSectionSearch}
              onSelectedGradeSectionsUpdate={handleGradeSectionsSelectedUpdate}
              selectedGradeSections={selectedGradeSections}
              onSingleDeleteClick={handleSingleDeleteClick}
              onEntityDataUpdate={setGradeSectionData}
              onInfoTextChange={handleGradeSectionsInfoTextChange}
            />
          </div>

          <div style={{ display: activeTab === 'subjects' ? 'block' : 'none' }}>
            <SubjectTable 
              key={`subject-${refreshKey}`}
              searchTerm={subjectSearch}
              onSelectedSubjectsUpdate={handleSubjectsSelectedUpdate}
              selectedSubjects={selectedSubjects}
              onSingleDeleteClick={handleSingleDeleteClick}
              onEntityDataUpdate={setSubjectData}
              onInfoTextChange={handleSubjectsInfoTextChange}
            />
          </div>

          <div style={{ display: activeTab === 'schedules' ? 'block' : 'none' }}>
            <GradeSchedulesTable 
              key={`schedule-${refreshKey}`}
              searchTerm={scheduleSearch}
              onSelectedSchedulesUpdate={handleSchedulesSelectedUpdate}
              selectedSchedules={selectedSchedules}
              onSingleDeleteClick={handleSingleDeleteClick}
              onEntityDataUpdate={setScheduleData}
              onInfoTextChange={handleSchedulesInfoTextChange}
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