import React, { useState } from 'react';
import Modal from '../Modal/Modal';
import ClassAttendanceReportTable from '../../Tables/ClassAttendanceReportTable/ClassAttendanceReportTable.jsx';
import Button from '../../UI/Buttons/Button/Button.jsx';
import { exportClassAttendanceReportToExcel } from '../../../Utils/exportEntity';
import styles from './ClassAttendanceReportModal.module.css';

const ClassAttendanceReportModal = ({ isOpen, onClose, currentClass }) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    setSelectedMonth(prev => {
      let month = prev.month - 1;
      let year = prev.year;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
      return { month, year };
    });
  };

  const handleNextMonth = () => {
    setSelectedMonth(prev => {
      let month = prev.month + 1;
      let year = prev.year;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      return { month, year };
    });
  };

  const handleMonthDropdown = (e) => {
    setSelectedMonth(prev => ({ ...prev, month: Number(e.target.value) }));
  };

  const [attendanceRows, setAttendanceRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleExport = () => {
    exportClassAttendanceReportToExcel({
      attendanceRows,
      selectedMonth: selectedMonth.month,
      year: selectedMonth.year,
      className: currentClass
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xxl">
      <div className={styles.topControlsRow}>
        <h2 className={styles.modalTitle}>Class Attendance Report</h2>
        <div className={styles.topControlsRight}>
          <button className={styles.monthNavButton} onClick={handlePrevMonth} aria-label="Previous Month">&#60;</button>
          <select className={styles.monthDropdown} value={selectedMonth.month} onChange={handleMonthDropdown}>
            {monthNames.map((name, idx) => (
              <option key={name} value={idx}>{name} {selectedMonth.year}</option>
            ))}
          </select>
          <button className={styles.monthNavButton} onClick={handleNextMonth} aria-label="Next Month">&#62;</button>
          <Button
            label={loading ? 'Exporting...' : 'Export'}
            onClick={handleExport}
            disabled={loading || attendanceRows.length === 0}
            height="sm"
            width="xs-sm"
            color="primary"
          />
        </div>
      </div>

      <ClassAttendanceReportTable
        currentClass={currentClass}
        selectedMonth={selectedMonth}
        attendanceRows={attendanceRows}
        setAttendanceRows={setAttendanceRows}
        loading={loading}
        setLoading={setLoading}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        totalPages={totalPages}
        setTotalPages={setTotalPages}
        monthNames={monthNames}
      />
    </Modal>
  );
};

export default ClassAttendanceReportModal;