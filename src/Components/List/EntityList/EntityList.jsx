// src/components/List/EntityList/EntityList.jsx
import React from 'react';
import {
  formatGradeSection,
  formatStudentDisplayName,
  formatTeacherDisplayName,
} from '../../../Utils/Formatters';
import styles from './EntityList.module.css';

function EntityList({
  entities = [],
  maxHeight = '100px',
  title = 'Entities included',
  showNumbers = true,
  variant = 'multiple',
  entityType = 'student'
}) {
  if (entities.length === 0) {
    return null;
  }

  const formatGradeSectionDisplay = (gradeSection) => {
    if (!gradeSection) return '';

    if (typeof gradeSection === 'string') {
      return gradeSection;
    }

    const grade = gradeSection.grade || gradeSection.grade_level || '';
    const section = gradeSection.section || gradeSection.section_name || '';
    const room = gradeSection.room;

    let display = '';
    if (grade && section) {
      display = `Grade ${grade} - ${section}`;
    } else if (grade) {
      display = `Grade ${grade}`;
    } else if (section) {
      display = section;
    }

    if (room && room !== 'N/A' && room !== '') {
      display += ` (Room ${room})`;
    }

    return display;
  };

  const formatGradeScheduleDisplay = (schedule) => {
    if (!schedule) return '';

    if (typeof schedule === 'string') {
      return schedule;
    }

    const grade = schedule.grade || schedule.grade_level || '';
    const startTime = schedule.class_start || '';
    const endTime = schedule.class_end || '';
    const gracePeriod = schedule.grace_period_minutes || 15;

    let display = '';
    if (grade) {
      display = `Grade ${grade}`;
    }

    if (startTime && endTime) {
      const formatTime = (timeStr) => {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours, 10);
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${period}`;
      };

      display += ` (${formatTime(startTime)} - ${formatTime(endTime)})`;
    }

    if (gracePeriod !== undefined && gracePeriod !== null) {
      display += ` • ${gracePeriod} min grace`;
    }

    return display;
  };

  const normalizedEntityType = String(entityType).toLowerCase();
  const isGradeSectionType = ['gradesection', 'grade section', 'section', 'grade sections', 'gradesections'].includes(normalizedEntityType);
  const isGradeScheduleType = ['gradeschedule', 'grade schedule', 'schedule', 'grade schedules', 'gradeschedules'].includes(normalizedEntityType);

  const formatEntityDetails = (entity) => {
    switch (entityType) {
      case 'student':
        return {
          identifier: entity.lrn || '',
          name: formatStudentDisplayName(entity),
          details: formatGradeSection(entity)
        };

      case 'teacher':
        return {
          identifier: entity.employee_id || '',
          name: formatTeacherDisplayName(entity),
          details: entity.email_address || 'NA'
        };

      case 'gradeSection':
      case 'section':
      case 'grade section':
      case 'grade sections':
        return {
          identifier: `${entity.grade || entity.grade_level || ''}-${entity.section || entity.section_name || ''}`,
          name: formatGradeSectionDisplay(entity),
          details: entity.room && entity.room !== 'N/A' ? `Room ${entity.room}` : ''
        };

      case 'grade':
        return {
          identifier: `Grade ${entity.grade_level || entity.grade || ''}`,
          name: `Grade ${entity.grade_level || entity.grade || ''}`,
          details: entity.description || ''
        };

      case 'gradeSchedule':
      case 'schedule':
      case 'grade schedule':
      case 'grade schedules':
        return {
          identifier: `Grade ${entity.grade || entity.grade_level || ''} Schedule`,
          name: formatGradeScheduleDisplay(entity),
          details: entity.grace_period_minutes ? `${entity.grace_period_minutes} min grace period` : ''
        };

      case 'room':
        return {
          identifier: entity.room_number || entity.name || '',
          name: entity.name || entity.room_number || '',
          details: entity.description || entity.building || ''
        };

      // Validation errors from a failed file upload — entities here look like
      // { row: 5, message: "Email is invalid, LRN is duplicated in the file" }
      case 'validationError':
        // Enhanced to handle sheet/record type disambiguation
        // If the entity has a displayLabel, use it; otherwise build a label
        let displayLabel = `Row ${entity.row}`;
        if (entity.displayLabel) {
          displayLabel = entity.displayLabel;
        } else if (entity.sheet) {
          displayLabel = `${entity.sheet} — Row ${entity.row}`;
        }
        
        return {
          identifier: displayLabel,
          name: entity.message || '',
          details: ''
        };

      default:
        if (entity.lrn) {
          return {
            identifier: entity.lrn || '',
            name: formatStudentDisplayName(entity),
            details: formatGradeSection(entity)
          };
        }
        if (entity.employee_id) {
          return {
            identifier: entity.employee_id || '',
            name: formatTeacherDisplayName(entity),
            details: entity.email_address || 'NA'
          };
        }
        if (entity.grade || entity.grade_level) {
          if (entity.section || entity.section_name) {
            return {
              identifier: `${entity.grade || entity.grade_level || ''}-${entity.section || entity.section_name || ''}`,
              name: formatGradeSectionDisplay(entity),
              details: entity.room && entity.room !== 'N/A' ? `Room ${entity.room}` : ''
            };
          }
          if (entity.class_start || entity.class_end) {
            return {
              identifier: `Grade ${entity.grade || entity.grade_level || ''} Schedule`,
              name: formatGradeScheduleDisplay(entity),
              details: entity.grace_period_minutes ? `${entity.grace_period_minutes} min grace period` : ''
            };
          }
          return {
            identifier: `Grade ${entity.grade_level || entity.grade || ''}`,
            name: `Grade ${entity.grade_level || entity.grade || ''}`,
            details: entity.description || ''
          };
        }
        return {
          identifier: entity.id || entity.code || '',
          name: entity.name || entity.title || entity.displayName || 'Unnamed Entity',
          details: entity.description || entity.email || entity.info || ''
        };
    }
  };

  const getTitle = () => {
    const entityTypeText = {
      student: 'Student',
      teacher: 'Teacher',
      gradeSection: 'Grade Section',
      section: 'Section',
      grade: 'Grade',
      gradeSchedule: 'Grade Schedule',
      schedule: 'Schedule',
      room: 'Room',
      validationError: 'Error',
      'grade section': 'Grade Section',
      'grade schedule': 'Grade Schedule',
      'grade sections': 'Grade Section',
      'grade schedules': 'Grade Schedule',
    }[entityType] || (isGradeSectionType ? 'Grade Section' : isGradeScheduleType ? 'Grade Schedule' : 'Entity');

    return `${title} (${entities.length} ${entityTypeText}${entities.length !== 1 ? 's' : ''}):`;
  };

  const getEntityDisplayText = (details) => {
    if (entityType === 'student') {
      return `${details.identifier} | ${details.name} | ${details.details}`;
    }

    if (entityType === 'teacher') {
      return `${details.identifier} | ${details.name} | ${details.details}`;
    }

    if (entityType === 'gradeSection' || entityType === 'section' || isGradeSectionType) {
      return details.name;
    }

    if (entityType === 'grade' || entityType === 'gradeSchedule' || entityType === 'schedule' || isGradeScheduleType) {
      return details.name;
    }

    if (entityType === 'room') {
      return `${details.identifier}${details.details ? ` - ${details.details}` : ''}`;
    }

    if (entityType === 'validationError') {
      // For validation errors, show the row/identifier and the error message
      // The identifier already includes the sheet/row info
      return `${details.identifier}: ${details.name}`;
    }

    if (details.identifier && details.name) {
      return details.details
        ? `${details.identifier} | ${details.name} | ${details.details}`
        : `${details.identifier} | ${details.name}`;
    }

    return details.name || details.identifier || 'Unknown Entity';
  };

  if (variant === 'single' && entities.length === 1) {
    const entity = entities[0];
    const details = formatEntityDetails(entity);
    return (
      <div className={styles.singleEntityContainer}>
        <div className={styles.singleEntityHeader}>
          {title || `${entityType.charAt(0).toUpperCase() + entityType.slice(1)}:`}
        </div>
        <div className={styles.singleEntityDetails}>
          {getEntityDisplayText(details)}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.entityListContainer}>
      <div className={styles.listHeader}>
        {getTitle()}
      </div>
      <div className={styles.entityList} style={{ maxHeight }}>
        {entities.map((entity, index) => {
          const details = formatEntityDetails(entity);
          return (
            <div key={entity.id || entity._id || index} className={styles.entityItem}>
              {showNumbers && (
                <div className={styles.entityNumber}>{index + 1}.</div>
              )}
              <div className={styles.entityDetails}>
                <div className={styles.entityName}>
                  {getEntityDisplayText(details)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default EntityList;