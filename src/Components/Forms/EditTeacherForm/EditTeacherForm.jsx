import React from 'react';
import styles from './EditTeacherForm.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashCan, faPlus } from '@fortawesome/free-solid-svg-icons';
import PhoneNumberInput from '../../UI/Inputs/PhoneNumberInput/PhoneNumberInput';
import { useGradeLevels } from '../../Hooks/useGradeLevels';

let rowIdCounter = 0;
const nextRowId = (prefix) => `${prefix}-${Date.now()}-${rowIdCounter++}`;

function EditTeacherForm({
  formData,
  onFieldChange,
  validationErrors = {},
  gradeSectionsMap = {},
  disabled = false,
}) {
  // ===== FETCH GRADE LEVELS FROM DATABASE =====
  const { gradeLevels } = useGradeLevels();

  const assignments = formData.assignments || [];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onFieldChange(name, value);
  };

  // ===== TEACHING ASSIGNMENTS (grade + section pairs) =====

  const handleAddAssignment = () => {
    const newRow = { id: nextRowId('assign'), grade: '', section: '', sectionId: null, isAdviser: false };
    onFieldChange('assignments', [...assignments, newRow]);
  };

  const handleRemoveAssignment = (rowId) => {
    onFieldChange('assignments', assignments.filter((row) => row.id !== rowId));
  };

  const handleAssignmentGradeChange = (rowId, newGrade) => {
    const sectionsForGrade = gradeSectionsMap[newGrade] || [];
    onFieldChange(
      'assignments',
      assignments.map((row) =>
        row.id === rowId
          ? { ...row, grade: newGrade, section: sectionsForGrade[0] || '', sectionId: null }
          : row
      )
    );
  };

  const handleAssignmentSectionChange = (rowId, newSection) => {
    onFieldChange(
      'assignments',
      assignments.map((row) => (row.id === rowId ? { ...row, section: newSection, sectionId: null } : row))
    );
  };

  // Toggle logic: clicking the currently-selected row turns it off;
  // clicking a different row moves the selection there.
  const handleSetAdviser = (rowId) => {
    onFieldChange(
      'assignments',
      assignments.map((row) => ({
        ...row,
        isAdviser: row.id === rowId ? !row.isAdviser : false,
      }))
    );
  };

  return (
    <div className={styles.form}>
      <div className={styles.formGroup}>
        <label>
          Employee ID<span className={styles.required}>*</span>
        </label>
        <input
          type="text"
          name="employee_id"
          value={formData.employee_id || ''}
          onChange={handleInputChange}
          className={`${styles.input} ${validationErrors.employee_id ? styles.inputError : ''}`}
          disabled={disabled}
        />
        {validationErrors.employee_id && (
          <div className={styles.fieldError}>{validationErrors.employee_id}</div>
        )}
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label>
            First Name<span className={styles.required}>*</span>
          </label>
          <input
            type="text"
            name="first_name"
            value={formData.first_name || ''}
            onChange={handleInputChange}
            className={`${styles.input} ${validationErrors.first_name ? styles.inputError : ''}`}
            disabled={disabled}
          />
          {validationErrors.first_name && (
            <div className={styles.fieldError}>{validationErrors.first_name}</div>
          )}
        </div>

        <div className={styles.formGroup}>
          <label>
            Last Name<span className={styles.required}>*</span>
          </label>
          <input
            type="text"
            name="last_name"
            value={formData.last_name || ''}
            onChange={handleInputChange}
            className={`${styles.input} ${validationErrors.last_name ? styles.inputError : ''}`}
            disabled={disabled}
          />
          {validationErrors.last_name && (
            <div className={styles.fieldError}>{validationErrors.last_name}</div>
          )}
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label>Email Address</label>
          <input
            type="email"
            name="email_address"
            value={formData.email_address || ''}
            onChange={handleInputChange}
            className={`${styles.input} ${validationErrors.email_address ? styles.inputError : ''}`}
            disabled={disabled}
          />
          {validationErrors.email_address && (
            <div className={styles.fieldError}>{validationErrors.email_address}</div>
          )}
        </div>

        <PhoneNumberInput
          name="phone_no"
          label="Phone Number"
          value={formData.phone_no}
          onChange={onFieldChange}
          error={validationErrors.phone_no}
          disabled={disabled}
        />
      </div>

      {/* ===== TEACHING ASSIGNMENTS ===== */}
      <div className={styles.sectionBlock}>
        <div className={styles.sectionHeaderRow}>
          <div className={styles.sectionTitle}>Teaching Assignments</div>
          <button
            type="button"
            className={styles.addButton}
            onClick={handleAddAssignment}
            disabled={disabled}
          >
            <FontAwesomeIcon icon={faPlus} /> Add Grade & Section
          </button>
        </div>

        {assignments.length === 0 && (
          <div className={styles.emptyHint}>No grade/section assignments yet.</div>
        )}

        {assignments.map((row) => {
          const sectionsForRow = gradeSectionsMap[row.grade] || [];
          return (
            <div key={row.id} className={styles.assignmentRow}>
              <select
                value={row.grade}
                onChange={(e) => handleAssignmentGradeChange(row.id, e.target.value)}
                className={`${styles.input} ${styles.select} ${styles.assignmentGradeSelect}`}
                disabled={disabled}
              >
                <option value="" disabled>Grade</option>
                {gradeLevels.map((grade) => (
                  <option key={grade} value={grade}>Grade {grade}</option>
                ))}
              </select>

              {!row.grade || sectionsForRow.length === 0 ? (
                <div className={`${styles.noSectionsMessage} ${styles.assignmentSectionSelect}`}>
                  {!row.grade ? 'Select grade' : 'No sections'}
                </div>
              ) : (
                <select
                  value={row.section}
                  onChange={(e) => handleAssignmentSectionChange(row.id, e.target.value)}
                  className={`${styles.input} ${styles.select} ${styles.assignmentSectionSelect}`}
                  disabled={disabled}
                >
                  {sectionsForRow.map((section) => (
                    <option key={section} value={section}>{section}</option>
                  ))}
                </select>
              )}

              <label className={styles.adviserLabel}>
                <input
                  type="radio"
                  name="adviser-section"
                  checked={row.isAdviser}
                  onClick={() => handleSetAdviser(row.id)}
                  onChange={() => {}}
                  disabled={disabled}
                />
                Adviser
              </label>

              <button
                type="button"
                className={styles.removeRowButton}
                onClick={() => handleRemoveAssignment(row.id)}
                disabled={disabled}
                aria-label="Remove assignment"
              >
                <FontAwesomeIcon icon={faTrashCan} />
              </button>
            </div>
          );
        })}
        {validationErrors.assignments && (
          <div className={styles.fieldError}>{validationErrors.assignments}</div>
        )}
      </div>
    </div>
  );
}

export default EditTeacherForm;