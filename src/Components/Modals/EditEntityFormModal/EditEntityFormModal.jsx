import React from 'react';
import Modal from '../Modal/Modal.jsx';
import Button from '../../UI/Buttons/Button/Button.jsx';
import styles from './EditEntityFormModal.module.css';
import ReportGmailerrorredIcon from '@mui/icons-material/ReportGmailerrorred';

function EditEntityFormModal({
  isOpen,
  onClose,
  title,
  children,       // the entity-specific form (e.g. <EditStudentForm />)
  onSave,
  saving = false,
  saveDisabled = false,
  errorMessage = '',
  size = 'md',
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size={size}>
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
        </div>

        <div className={styles.body}>
          {children}
        </div>

        {errorMessage && (
          <div className={styles.error}>
            <ReportGmailerrorredIcon fontSize="small" />
            {errorMessage}
          </div>
        )}

        <div className={styles.footer}>
          <Button
            label="Cancel"
            color="ghost"
            onClick={onClose}
            disabled={saving}
            width="120px"
          />
          <Button
            label={saving ? 'Saving...' : 'Save'}
            color="ocean"
            onClick={onSave}
            disabled={saving || saveDisabled}
            width="120px"
          />
        </div>
      </div>
    </Modal>
  );
}

export default EditEntityFormModal;