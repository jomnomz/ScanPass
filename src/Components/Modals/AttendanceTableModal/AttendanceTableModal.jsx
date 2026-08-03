import React from 'react';
import Modal from '../Modal/Modal';
import TeacherAttendanceTable from '../../Tables/TeacherAttendanceTable/TeacherAttendanceTable';
import styles from './AttendanceTableModal.module.css';

const AttendanceTableModal = ({ 
  isOpen, 
  onClose, 
  className,
  gradeId,
  sectionId
}) => {
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      size="xxxl"
    >
      <div className={styles.modalShell}>
        <div className={styles.tableRegion}>
          <TeacherAttendanceTable
            className={className}
            gradeId={gradeId}
            sectionId={sectionId}
          />
        </div>
      </div>
    </Modal>
  );
};

export default AttendanceTableModal;