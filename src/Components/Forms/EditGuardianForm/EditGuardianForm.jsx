import React from 'react';
import styles from './EditGuardianForm.module.css';

function EditGuardianForm({
  guardian,
  formData,
  onFieldChange,
  validationErrors = {},
  disabled = false,
}) {
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onFieldChange(name, value);
  };

  // Build the context display string
  const getContextDisplay = () => {
    if (!guardian) return '';
    
    const studentName = guardian.guardian_of || '';
    const grade = guardian.grade || '';
    const section = guardian.section || '';
    
    let display = studentName;
    
    if (grade && section) {
      display += ` | ${grade} - ${section}`;
    } else if (grade) {
      display += ` | ${grade}`;
    }
    
    return display;
  };

  return (
    <div className={styles.form}>
      {guardian?.guardian_of && (
        <div className={styles.contextRow}>
          <span className={styles.contextLabel}>Guardian of</span>
          <span className={styles.contextValue}>{getContextDisplay()}</span>
        </div>
      )}

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
          <label>Email</label>
          <input
            type="email"
            name="email"
            value={formData.email || ''}
            onChange={handleInputChange}
            className={`${styles.input} ${validationErrors.email ? styles.inputError : ''}`}
            disabled={disabled}
          />
          {validationErrors.email && (
            <div className={styles.fieldError}>{validationErrors.email}</div>
          )}
        </div>

        <div className={styles.formGroup}>
          <label>Phone</label>
          <input
            type="text"
            name="phone_number"
            value={formData.phone_number || ''}
            onChange={handleInputChange}
            className={`${styles.input} ${validationErrors.phone_number ? styles.inputError : ''}`}
            disabled={disabled}
          />
          {validationErrors.phone_number && (
            <div className={styles.fieldError}>{validationErrors.phone_number}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EditGuardianForm;