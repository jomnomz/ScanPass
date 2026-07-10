import Modal from '../Modal/Modal.jsx';
import styles from './DeleteEntityModal.module.css';
import Button from '../../UI/Buttons/Button/Button.jsx';
import { useToast } from '../../Toast/ToastContext/ToastContext.jsx';
import InfoBox from '../../UI/InfoBoxes/InfoBox/InfoBox.jsx';
import EntityList from '../../List/EntityList/EntityList.jsx';
import TitleModalLabel from '../../UI/Labels/TitleModalLabel/TitleModalLabel.jsx';
import MessageModalLabel from '../../UI/Labels/MessageModalLabel/MessageModalLabel.jsx';

function DeleteEntityModal({ 
  isOpen, 
  onClose, 
  entity, 
  selectedEntities = [], 
  entityData = [], 
  onConfirm,
  onConfirmBulk,
  entityType = 'entity', 
  entityConfig = {},
  currentFilter = '',
  currentSection = '',
  currentGrade = ''
}) {
  const { info, error: toastError } = useToast(); 
  const labels = getEntityTypeLabels(entityType);
  
  const isBulkDelete = selectedEntities.length > 0;
  const deleteCount = isBulkDelete ? selectedEntities.length : 1;
  
  if (!isOpen) return null;
  if (!isBulkDelete && !entity) return null; 

  const config = {
    warningMessage: 'This action cannot be undone.',
    hasAccountField: false,
    hasQRCode: false,
    hasContextInfo: false,
    
    ...getEntityConfig(labels.singularKey),
    ...entityConfig
  };

  const selectedEntityObjects = isBulkDelete
    ? selectedEntities
        .map((selectedItem) => {
          if (selectedItem && typeof selectedItem === 'object') {
            return selectedItem;
          }

          const selectedId = String(selectedItem);
          return entityData.find((item) => String(item.id) === selectedId);
        })
        .filter(Boolean)
    : [entity];

  const selectedEntityIds = isBulkDelete
    ? selectedEntities.map((selectedItem) =>
        selectedItem && typeof selectedItem === 'object' ? selectedItem.id : selectedItem
      )
    : [];

  const hasAccounts = config.hasAccountField && 
    selectedEntityObjects.some(entity => 
      entity.status === 'pending' || entity.status === 'active' || entity.status === 'inactive'
    );

  const getWarningMessage = () => {
    let warning = config.warningMessage;
    
    if (hasAccounts && config.hasAccountField) {
      warning = `This will permanently delete ${labels.sentenceSingular} data and ${deleteCount > 1 ? labels.sentencePlural : labels.sentenceSingular} who have accounts.`;
    } else if (config.hasQRCode) {
      warning = `This action cannot be undone. All ${labels.sentenceSingular} data, including QR codes, will be permanently removed.`;
    }
    
    return warning;
  };

  const getStatusMessage = () => {
    if (!config.hasAccountField) return null;
    
    const statuses = selectedEntityObjects.map(e => e.status || 'no status');
    const uniqueStatuses = [...new Set(statuses)];
    
    if (uniqueStatuses.length === 1) {
      const status = uniqueStatuses[0];
      if (status === 'pending') return `${deleteCount > 1 ? labels.sentencePlural : labels.sentenceSingular} ${deleteCount > 1 ? 'have' : 'has'} pending invitations.`;
      if (status === 'active') return `${deleteCount > 1 ? labels.sentencePlural : labels.sentenceSingular} ${deleteCount > 1 ? 'have' : 'has'} active accounts.`;
      if (status === 'inactive') return `${deleteCount > 1 ? labels.sentencePlural : labels.sentenceSingular} ${deleteCount > 1 ? 'have' : 'has'} inactive accounts.`;
      return `${deleteCount > 1 ? labels.sentencePlural : labels.sentenceSingular} ${deleteCount > 1 ? 'have' : 'has'} no accounts yet.`;
    } else {
      return `Selected ${labels.sentencePlural} have various account statuses.`;
    }
  };

  const handleConfirm = async () => {
    try {
      if (isBulkDelete) {
        await onConfirmBulk?.(selectedEntityIds);
        info(`${deleteCount} ${deleteCount !== 1 ? labels.sentencePlural : labels.sentenceSingular} successfully deleted`);
      } else {
        await onConfirm?.(entity.id);
        info(`${deleteCount} ${labels.sentenceSingular} successfully deleted`);
      }
      onClose();
    } catch (error) {
      console.error('Error in deletion:', error);
      toastError(`Failed to delete ${labels.sentenceSingular}: ${error.message}`);
      onClose();
    }
  };

  const getContextDescription = () => {
    if (!config.hasContextInfo) return '';
    
    if (currentSection) {
      return `from Section ${currentSection}`;
    }
    if (currentFilter) {
      return `matching "${currentFilter}"`;
    }
    return currentGrade ? `from Grade ${currentGrade}` : '';
  };

  return (
    <Modal size="md" isOpen={isOpen} onClose={onClose}>
      <div className={styles.modalContainer}>
        <TitleModalLabel>
          {isBulkDelete 
            ? `Delete ${deleteCount} Selected ${deleteCount > 1 ? labels.titlePlural : labels.titleSingular}` 
            : `Delete ${labels.titleSingular}`}
        </TitleModalLabel>
        
        <MessageModalLabel>
          {isBulkDelete ? (
            `Are you sure you want to delete ${deleteCount} ${deleteCount !== 1 ? labels.sentencePlural : labels.sentenceSingular} ${getContextDescription()}?`
          ) : (
            `Are you sure you want to delete this ${labels.sentenceSingular}?`
          )}
        </MessageModalLabel>

        <InfoBox type="warning">
          <strong>Warning:</strong> {getWarningMessage()}
        </InfoBox>
        
        {config.hasAccountField && getStatusMessage() && (
          <InfoBox type="important">
            <strong>Status:</strong> {getStatusMessage()}
          </InfoBox>
        )}
        
        <EntityList 
          entities={selectedEntityObjects}
          variant={isBulkDelete ? "multiple" : "single"}
          title={`${deleteCount > 1 ? labels.titlePlural : labels.titleSingular} to be deleted`}
          entityType={labels.listEntityType}
        />

        <div className={styles.buttonGroup}>
          <Button 
            label="Cancel"
            color="ghost"
            onClick={onClose}
            width="sm"
            height="sm"
          />
          <Button
            label="Delete"
            color="danger"
            onClick={handleConfirm}
            width="xs"
            height="sm"
            disabled={isBulkDelete && selectedEntities.length === 0}
          />
        </div>
      </div>
    </Modal>
  );
}

function getEntityTypeLabels(entityType = '') {
  const raw = String(entityType).trim();
  const normalized = raw.toLowerCase();

  if (['student', 'students'].includes(normalized)) {
    return {
      singularKey: 'student',
      titleSingular: 'Student',
      titlePlural: 'Students',
      sentenceSingular: 'student',
      sentencePlural: 'students',
      listEntityType: 'student'
    };
  }

  if (['teacher', 'teachers'].includes(normalized)) {
    return {
      singularKey: 'teacher',
      titleSingular: 'Teacher',
      titlePlural: 'Teachers',
      sentenceSingular: 'teacher',
      sentencePlural: 'teachers',
      listEntityType: 'teacher'
    };
  }

  if (['subject', 'subjects'].includes(normalized)) {
    return {
      singularKey: 'subject',
      titleSingular: 'Subject',
      titlePlural: 'Subjects',
      sentenceSingular: 'subject',
      sentencePlural: 'subjects',
      listEntityType: 'subject'
    };
  }

  if (['gradesection', 'grade section', 'gradesections', 'grade sections'].includes(normalized)) {
    return {
      singularKey: 'grade section',
      titleSingular: 'Grade Section',
      titlePlural: 'Grade Sections',
      sentenceSingular: 'grade section',
      sentencePlural: 'grade sections',
      listEntityType: 'grade section'
    };
  }

  if (['gradeschedule', 'grade schedule', 'gradeschedules', 'grade schedules', 'schedule', 'schedules'].includes(normalized)) {
    return {
      singularKey: 'grade schedule',
      titleSingular: 'Grade Schedule',
      titlePlural: 'Grade Schedules',
      sentenceSingular: 'grade schedule',
      sentencePlural: 'grade schedules',
      listEntityType: 'grade schedule'
    };
  }

  const fallback = raw || 'entity';
  return {
    singularKey: fallback,
    titleSingular: capitalizeFirstLetter(fallback),
    titlePlural: `${capitalizeFirstLetter(fallback)}s`,
    sentenceSingular: fallback,
    sentencePlural: `${fallback}s`,
    listEntityType: fallback
  };
}

function getEntityConfig(entityType) {
  const configs = {
    student: {
      warningMessage: 'This action cannot be undone. All student data, including QR codes, will be permanently removed.',
      hasAccountField: false,
      hasQRCode: true,
      hasContextInfo: true
    },
    teacher: {
      warningMessage: 'This will permanently delete teacher data from the system.',
      hasAccountField: true,
      hasQRCode: false,
      hasContextInfo: false
    },
    subject: {
      warningMessage: 'This will permanently delete the subject from the system.',
      hasAccountField: false,
      hasQRCode: false,
      hasContextInfo: false
    },
    gradeSection: {
      warningMessage: 'This will permanently delete the grade section from the system.',
      hasAccountField: false,
      hasQRCode: false,
      hasContextInfo: false
      },
      'grade schedule': {
        warningMessage: 'This will permanently delete the grade schedule from the system.',
        hasAccountField: false,
        hasQRCode: false,
        hasContextInfo: false
      },
      'grade section': {
        warningMessage: 'This will permanently delete the grade section from the system.',
        hasAccountField: false,
        hasQRCode: false,
        hasContextInfo: false
      }
  };
  
  return configs[entityType] || configs.entity;
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export default DeleteEntityModal;