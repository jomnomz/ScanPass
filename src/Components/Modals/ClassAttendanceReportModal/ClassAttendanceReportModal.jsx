import React, { useState } from 'react';
import Modal from '../Modal/Modal';
import ClassAttendanceReportTable from '../../Tables/ClassAttendanceReportTable/ClassAttendanceReportTable.jsx';
import Button from '../../UI/Buttons/Button/Button.jsx';
import Input from '../../UI/Inputs/Input/Input.jsx';
import { exportClassAttendanceReportToExcel } from '../../../Utils/exportEntity';
import styles from './ClassAttendanceReportModal.module.css';
import DownloadIcon from '@mui/icons-material/Download';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

const ClassAttendanceReportModal = ({ isOpen, onClose, currentClass }) => {
  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const currentYear = now.getFullYear();

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const isFutureMonth = (monthIdx, year) => {
    if (year > currentYear) return true;
    if (year === currentYear && monthIdx > currentMonthIdx) return true;
    return false;
  };

  const canGoNext = !(selectedMonth.year === currentYear && selectedMonth.month === currentMonthIdx);

  const handlePrevMonth = () => {
    setSelectedMonth(prev => {
      let month = prev.month - 1;
      let year = prev.year;
      if (month < 0) { month = 11; year -= 1; }
      return { month, year };
    });
  };

  const handleNextMonth = () => {
    setSelectedMonth(prev => {
      let month = prev.month + 1;
      let year = prev.year;
      if (month > 11) { month = 0; year += 1; }
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
      <div className={styles.modalContent}>
        <div className={styles.titleRow}>
          <h2 className={styles.modalTitle}>Class Attendance Report</h2>
        </div>

        <div className={styles.secondControlsRow}>
          <Button
            onClick={handleExport}
            disabled={loading || attendanceRows.length === 0}
            height="sm"
            icon={<DownloadIcon/>}
            width="auto"
            label="Export"
            color="teaGreen"
          />

          <div className={styles.rightControlsGroup}>
            <Input
              search
              placeholder="Search by name, LRN, or section..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <div className={styles.monthPickerGroup}>
              <button
                className={styles.monthNavButton}
                onClick={handlePrevMonth}
                aria-label="Previous Month"
              >
                &#8592;
              </button>

              <div className={styles.monthPickerButtonWrapper}>
                <Button
                  color="nav"
                  height="sm"
                  width="auto"
                  className={styles.monthTriggerButton}
                  icon={
                    <span className={styles.monthTriggerInner}>
                      <CalendarTodayIcon style={{ fontSize: '16px', opacity: 0.8 }} />
                      <span className={styles.monthTriggerDivider} />
                      <span className={styles.monthTriggerLabel}>
                        {monthNames[selectedMonth.month]} ({selectedMonth.year})
                      </span>
                      <KeyboardArrowDownIcon style={{ fontSize: '16px', opacity: 0.7 }} />
                    </span>
                  }
                />
                <select
                  className={styles.monthDropdownOverlay}
                  value={selectedMonth.month}
                  onChange={handleMonthDropdown}
                  aria-label="Select month"
                >
                  {monthNames
                    .map((name, idx) => ({ name, idx }))
                    .filter(({ idx }) => !isFutureMonth(idx, selectedMonth.year))
                    .map(({ name, idx }) => (
                      <option key={name} value={idx}>
                        {name} ({selectedMonth.year})
                      </option>
                    ))}
                </select>
              </div>

              <button
                className={styles.monthNavButton}
                onClick={handleNextMonth}
                disabled={!canGoNext}
                aria-label="Next Month"
              >
                &#8594;
              </button>
            </div>
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
          searchTerm={searchTerm}
        />
      </div>
    </Modal>
  );
};

export default ClassAttendanceReportModal;