import { useState } from 'react';
import { validateAndNormalizeStudent } from '../../Utils/StudentDataValidation';
import { validateAndNormalizeTeacher } from  '../../Utils/TeacherDataValidation';
import { validateGradeSectionData } from '../../Utils/MasterDataValidation';

export const parseServiceError = (rawMessage) => {
  if (!rawMessage) return 'An unknown error occurred';
  
  const msg = rawMessage.toString();
  
  // Database constraint violations
  if (msg.includes('teacher_sections_one_adviser_per_section')) {
    return 'This grade-section already has an adviser assigned to another teacher.';
  }
  if (msg.includes('duplicate key')) {
    if (msg.includes('teachers_email_address_key')) {
      return 'This email address is already in use by another teacher.';
    }
    if (msg.includes('teachers_employee_id_key')) {
      return 'This Employee ID is already in use by another teacher.';
    }
    return 'A duplicate value was found in the database.';
  }
  
  // Permission/access errors
  if (msg.includes('permission denied') || msg.includes('violates row-level security')) {
    return 'You do not have permission to perform this action.';
  }
  
  // Foreign key violations
  if (msg.includes('foreign key constraint')) {
    if (msg.includes('teacher_sections_section_id_fkey')) {
      return 'One or more sections no longer exist in the database.';
    }
    if (msg.includes('teacher_sections_teacher_id_fkey')) {
      return 'The teacher record could not be found.';
    }
    return 'A related record could not be found.';
  }
  
  // Return the original message if no specific match
  return msg;
};

export const useEntityEdit = (entities, setEntities, entityType = 'student', refreshAll = null) => {
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const startEdit = (entity) => {
    setEditingId(entity.id);
    setValidationErrors({});
    
    if (entityType === 'student') {
      let grade = entity.grade;
      if (grade && typeof grade === 'string' && grade.includes('Grade ')) {
        grade = grade.replace('Grade ', '');
      }
      
      setEditFormData({
        lrn: entity.lrn,
        first_name: entity.first_name,
        last_name: entity.last_name,
        grade: grade,  
        section: entity.section,
        email: entity.email,
        phone_number: entity.phone_number,
        guardian_first_name: entity.guardian_first_name || '',
        guardian_last_name: entity.guardian_last_name || '',
        guardian_phone_number: entity.guardian_phone_number || '',
        guardian_email: entity.guardian_email || ''
      });
    } else if (entityType === 'guardian') {
      setEditFormData({
        first_name: entity.first_name || '',
        last_name: entity.last_name || '',
        phone_number: entity.phone_number || '',
        email: entity.email || ''
      });
    } else if (entityType === 'teacher') {
      setEditFormData({
        employee_id: entity.employee_id,
        first_name: entity.first_name,
        last_name: entity.last_name,
        phone_no: entity.phone_no || '',
        email_address: entity.email_address || '',
        assignments: entity.assignments || [],
        status: entity.status || ''
      });
    } else if (entityType === 'gradeSection') {
      setEditFormData({
        grade: entity.grade,
        section: entity.section,
        room: entity.room
      });
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFormData({});
    setValidationErrors({});
  };

  const updateEditField = (field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  /**
   * Runs field-level validation for the current entityType and, where the
   * validator supports it (student/teacher), also checks whether the
   * identifier (LRN / Employee ID) being edited would collide with a
   * DIFFERENT existing entity already in `entities`.
   *
   * Returns both the errors AND the normalized/sanitized data so callers
   * (saveEdit) can persist the sanitized version instead of the raw input.
   */
  const runValidation = (currentEntityId) => {
    let errors = {};
    let normalized = editFormData;

    if (entityType === 'student') {
      const result = validateAndNormalizeStudent(editFormData, { isFormContext: true });
      errors = { ...result.errors };
      normalized = result.student;

      const lrn = editFormData.lrn?.toString().trim();
      if (lrn) {
        const isDuplicate = entities.some(
          (e) => e.id !== currentEntityId && e.lrn?.toString().trim() === lrn
        );
        if (isDuplicate) {
          errors.lrn = `LRN ${lrn} already belongs to another student`;
        }
      }
    } else if (entityType === 'guardian') {
      if (!editFormData.first_name?.trim()) errors.first_name = 'First name is required';
      if (!editFormData.last_name?.trim()) errors.last_name = 'Last name is required';
      if (editFormData.email && !/\S+@\S+\.\S+/.test(editFormData.email)) errors.email = 'Email is invalid';
      if (editFormData.phone_number && !/^[\+]?[1-9][\d]{0,15}$/.test(editFormData.phone_number.replace(/\D/g, ''))) {
        errors.phone_number = 'Phone number is invalid';
      }
    } else if (entityType === 'teacher') {
      const result = validateAndNormalizeTeacher(editFormData, { isFormContext: true });
      errors = { ...result.errors };
      normalized = result.teacher ?? editFormData;

      const employeeId = editFormData.employee_id?.toString().trim();
      if (employeeId) {
        const isDuplicate = entities.some(
          (e) => e.id !== currentEntityId && e.employee_id?.toString().trim() === employeeId
        );
        if (isDuplicate) {
          errors.employee_id = `Employee ID ${employeeId} already belongs to another teacher`;
        }
      }
    } else if (entityType === 'gradeSection') {
      errors = validateGradeSectionData(editFormData);
    }

    return { errors, normalized };
  };

  // Kept for backward compatibility with any existing callers (e.g. on-blur
  // validation) that only care about the errors object.
  const validateForm = () => {
    const { errors } = runValidation(editingId);
    setValidationErrors(errors);
    return errors;
  };

  const saveEdit = async (entityId, currentClass, updateService) => {
    try {
      setSaving(true);

      const { errors, normalized } = runValidation(entityId);
      setValidationErrors(errors);

      if (Object.keys(errors).length > 0) {
        throw new Error('Please fix the validation errors');
      }

      // Use the sanitized/normalized data (formatted phone, lowercased
      // email, etc.) rather than the raw editFormData.
      const updatedEntity = await updateService(entityId, normalized);
      
      // Always update the entity in local state
      setEntities(prevEntities => {
        return prevEntities.map(entity => 
          entity.id === entityId ? updatedEntity : entity
        );
      });

      if (refreshAll) {
        await refreshAll();
      }

      cancelEdit();
      
      let gradeChanged = false;
      if (entityType === 'student') {
        const entity = entities.find(e => e.id === entityId);
        if (entity && normalized.grade) {
          let originalGrade = entity.grade;
          if (typeof originalGrade === 'string' && originalGrade.includes('Grade ')) {
            originalGrade = originalGrade.replace('Grade ', '');
          }
          gradeChanged = originalGrade !== normalized.grade;
        }
      }
      
      return { 
        success: true, 
        gradeChanged
      };
      
    } catch (err) {
      console.error(`Error updating ${entityType}:`, err);
      return { 
        success: false, 
        error: err.message,
        validationErrors: validationErrors
      };
    } finally {
      setSaving(false);
    }
  };

  return {
    editingId,
    editFormData,
    saving,
    validationErrors,
    startEdit,
    cancelEdit,
    updateEditField,
    validateForm,
    saveEdit,
    entityType
  };
};