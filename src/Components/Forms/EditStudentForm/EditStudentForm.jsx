import React from 'react';
import { grades } from '../../../Utils/TableHelpers';
import { formatNA } from '../../../Utils/Formatters';
import styles from './EditStudentForm.module.css';
import ReportGmailerrorredIcon from '@mui/icons-material/ReportGmailerrorred';

function EditStudentForm({
  student,
  formData,
  onFieldChange,
  validationErrors = {},
  gradeSectionsMap = {},
  disabled = false,
}) {
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onFieldChange(name, value);
  };

  const handleGradeChange = (e) => {
    const { value } = e.target;
    const sectionsForGrade = gradeSectionsMap[value] || [];

    // If the current section isn't valid for the newly picked grade, reset it —
    // mirrors the inline-edit behavior in StudentTable so both stay consistent.
    if (formData.section && sectionsForGrade.includes(formData.section)) {
      onFieldChange('grade', value);
    } else {
      onFieldChange('section', sectionsForGrade[0] || '');
      onFieldChange('grade', value);
    }
  };

  const availableSections = gradeSectionsMap[formData.grade] || [];

  return (
    <div className={styles.form}>
      <div className={styles.formGroup}>
        <label>LRN</label>
        <input
          type="text"
          name="lrn"
          value={formData.lrn || ''}
          onChange={handleInputChange}
          className={`${styles.input} ${validationErrors.lrn ? styles.inputError : ''}`}
          disabled={disabled}
        />
        {validationErrors.lrn && (
          <div className={styles.fieldError}>{validationErrors.lrn}</div>
        )}
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label>First Name</label>
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
          <label>Last Name</label>
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
          <label>Grade</label>
          <select
            name="grade"
            value={formData.grade || ''}
            onChange={handleGradeChange}
            className={`${styles.input} ${styles.select} ${validationErrors.grade ? styles.inputError : ''}`}
            disabled={disabled}
          >
            <option value="" disabled>Select grade</option>
            {grades.map((grade) => (
              <option key={grade} value={grade}>
                Grade {grade}
              </option>
            ))}
          </select>
          {validationErrors.grade && (
            <div className={styles.fieldError}>{validationErrors.grade}</div>
          )}
        </div>

        <div className={styles.formGroup}>
          <label>Section</label>
          {!formData.grade || availableSections.length === 0 ? (
            <div className={styles.noSectionsMessage}>
              {!formData.grade ? 'Select a grade first' : 'No sections available for this grade'}
            </div>
          ) : (
            <select
              name="section"
              value={formData.section || ''}
              onChange={handleInputChange}
              className={`${styles.input} ${styles.select} ${validationErrors.section ? styles.inputError : ''}`}
              disabled={disabled}
            >
              {availableSections.map((section) => (
                <option key={section} value={section}>
                  {section}
                </option>
              ))}
            </select>
          )}
          {validationErrors.section && (
            <div className={styles.fieldError}>{validationErrors.section}</div>
          )}
        </div>
      </div>

      <div className={styles.readOnlySection}>
        <div className={styles.readOnlyLabel}>Not editable yet</div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Email</label>
            <input
              type="text"
              value={formatNA(student?.email)}
              className={`${styles.input} ${styles.readOnlyInput}`}
              disabled
              readOnly
            />
          </div>

          <div className={styles.formGroup}>
            <label>Phone</label>
            <input
              type="text"
              value={formatNA(student?.phone_number)}
              className={`${styles.input} ${styles.readOnlyInput}`}
              disabled
              readOnly
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditStudentForm;