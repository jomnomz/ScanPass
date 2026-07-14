import React, { useRef, useState } from 'react';
import { grades } from '../../../Utils/TableHelpers';
import { getProfileColor, getProfileInitial } from '../../../Utils/ProfileHelpers';
import styles from './EditStudentForm.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera } from '@fortawesome/free-solid-svg-icons';
import PhoneNumberInput from '../../UI/Inputs/PhoneNumberInput/PhoneNumberInput';
function EditStudentForm({
  student,
  formData,
  onFieldChange,
  validationErrors = {},
  gradeSectionsMap = {},
  disabled = false,
}) {
  const fileInputRef = useRef(null);
  // Local-only preview — no upload logic yet, just UI/UX placeholder until buckets exist.
  const [previewUrl, setPreviewUrl] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onFieldChange(name, value);
  };

  const handleGradeChange = (e) => {
    const { value } = e.target;
    const sectionsForGrade = gradeSectionsMap[value] || [];

    if (formData.section && sectionsForGrade.includes(formData.section)) {
      onFieldChange('grade', value);
    } else {
      onFieldChange('section', sectionsForGrade[0] || '');
      onFieldChange('grade', value);
    }
  };

  const handlePhotoClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview only — actual upload wiring comes later once storage is set up.
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const availableSections = gradeSectionsMap[formData.grade] || [];

  const { bg, text } = getProfileColor(
    student?.id ?? `${formData.first_name}${formData.last_name}`
  );

  return (
    <div className={styles.form}>
      <div className={styles.photoSection}>
        <button
          type="button"
          className={styles.photoCircleButton}
          onClick={handlePhotoClick}
          disabled={disabled}
          aria-label="Change profile photo"
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Profile preview" className={styles.photoImage} />
          ) : (
            <div className={styles.photoPlaceholder} style={{ backgroundColor: bg, color: text }}>
              {getProfileInitial(formData.first_name)}
            </div>
          )}
          <div className={styles.photoOverlay}>
            <FontAwesomeIcon icon={faCamera} />
          </div>
        </button>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handlePhotoChange}
          className={styles.hiddenFileInput}
        />
        <span className={styles.photoHint}>Click to change photo</span>
      </div>

      <div className={styles.formGroup}>
        <label>
          LRN<span className={styles.required}>*</span>
        </label>
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
          <label>
            Grade<span className={styles.required}>*</span>
          </label>
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
          <label>
            Section<span className={styles.required}>*</span>
          </label>
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

        <PhoneNumberInput
          name="phone_number"
          label="Phone"
          value={formData.phone_number}
          onChange={onFieldChange}
          error={validationErrors.phone_number}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export default EditStudentForm;