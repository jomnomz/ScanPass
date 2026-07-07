import React, { useRef, useState } from 'react';
import { grades } from '../../../Utils/TableHelpers';
import { getProfileColor, getProfileInitial } from '../../../Utils/ProfileHelpers';
import styles from './EditTeacherForm.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera, faTrashCan, faPlus } from '@fortawesome/free-solid-svg-icons';

let rowIdCounter = 0;
const nextRowId = () => `row-${Date.now()}-${rowIdCounter++}`;

function EditTeacherForm({
  teacher,
  formData,
  onFieldChange,
  validationErrors = {},
  gradeSectionsMap = {},       // { [gradeLevel]: [sectionName, ...] }
  availableSubjects = [],      // [{ code, name }, ...] full catalog to choose from
  disabled = false,
}) {
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [subjectToAdd, setSubjectToAdd] = useState('');

  const assignments = formData.assignments || [];
  const subjects = formData.subjects || [];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onFieldChange(name, value);
  };

  const handlePhotoClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Preview only — actual upload wiring comes later once storage is set up.
    setPreviewUrl(URL.createObjectURL(file));
  };

  // ===== TEACHING ASSIGNMENTS (grade + section pairs) =====

  const handleAddAssignment = () => {
    const newRow = { id: nextRowId(), grade: '', section: '', isAdviser: false };
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
          ? { ...row, grade: newGrade, section: sectionsForGrade[0] || '' }
          : row
      )
    );
  };

  const handleAssignmentSectionChange = (rowId, newSection) => {
    onFieldChange(
      'assignments',
      assignments.map((row) => (row.id === rowId ? { ...row, section: newSection } : row))
    );
  };

  const handleSetAdviser = (rowId) => {
    // Only one row can be adviser at a time — clear the rest.
    onFieldChange(
      'assignments',
      assignments.map((row) => ({ ...row, isAdviser: row.id === rowId }))
    );
  };

  // ===== SUBJECTS (simple multi-select) =====

  const subjectsNotYetAdded = availableSubjects.filter(
    (s) => !subjects.includes(s.code)
  );

  const handleAddSubject = () => {
    if (!subjectToAdd) return;
    onFieldChange('subjects', [...subjects, subjectToAdd]);
    setSubjectToAdd('');
  };

  const handleRemoveSubject = (code) => {
    onFieldChange('subjects', subjects.filter((s) => s !== code));
  };

  const getSubjectLabel = (code) => {
    const match = availableSubjects.find((s) => s.code === code);
    return match ? match.name : code;
  };

  const { bg, text } = getProfileColor(
    teacher?.id ?? `${formData.first_name}${formData.last_name}`
  );

  return (
    <div className={styles.form}>
      {/* ===== PROFILE PHOTO (UI only, no upload wiring yet) ===== */}
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

      {/* ===== BASIC INFO ===== */}
      <div className={styles.formGroup}>
        <label>Employee ID</label>
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

        <div className={styles.formGroup}>
          <label>Phone Number</label>
          <input
            type="text"
            name="phone_no"
            value={formData.phone_no || ''}
            onChange={handleInputChange}
            className={`${styles.input} ${validationErrors.phone_no ? styles.inputError : ''}`}
            disabled={disabled}
          />
          {validationErrors.phone_no && (
            <div className={styles.fieldError}>{validationErrors.phone_no}</div>
          )}
        </div>
      </div>

      {/* ===== TEACHING ASSIGNMENTS & SUBJECTS (side-by-side) ===== */}
      <div className={styles.twoColumnGrid}>
        <div className={styles.sectionBlock}>
          <div className={styles.sectionHeaderRow}>
            <div className={styles.sectionTitle}>Teaching Assignments</div>
            <button
              type="button"
              className={styles.addButton}
              onClick={handleAddAssignment}
              disabled={disabled}
            >
              <FontAwesomeIcon icon={faPlus} /> Add
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
                  {grades.map((grade) => (
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
                    onChange={() => handleSetAdviser(row.id)}
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

        <div className={styles.sectionBlock}>
          <div className={styles.sectionTitle}>Subjects</div>

          <div className={styles.subjectAddRow}>
            <select
              value={subjectToAdd}
              onChange={(e) => setSubjectToAdd(e.target.value)}
              className={`${styles.input} ${styles.select}`}
              disabled={disabled || subjectsNotYetAdded.length === 0}
            >
              <option value="">
                {subjectsNotYetAdded.length === 0 ? 'All subjects added' : 'Select a subject'}
              </option>
              {subjectsNotYetAdded.map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </select>
            <button
              type="button"
              className={styles.addButton}
              onClick={handleAddSubject}
              disabled={disabled || !subjectToAdd}
            >
              <FontAwesomeIcon icon={faPlus} /> Add
            </button>
          </div>

          <div className={styles.subjectChipList}>
            {subjects.length === 0 && (
              <div className={styles.emptyHint}>No subjects assigned yet.</div>
            )}
            {subjects.map((code) => (
              <div key={code} className={styles.subjectChip}>
                <span>{getSubjectLabel(code)}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSubject(code)}
                  disabled={disabled}
                  aria-label={`Remove ${getSubjectLabel(code)}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditTeacherForm;