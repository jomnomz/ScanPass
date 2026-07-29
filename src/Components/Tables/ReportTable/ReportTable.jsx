import React, { useState, useEffect } from 'react';
import Button from '../../UI/Buttons/Button/Button';
import styles from './ReportTable.module.css';
import SignalCellularAltIcon  from '@mui/icons-material/SignalCellularAlt';

const ReportTable = () => {
  const [currentClass, setCurrentClass] = useState('7');
  const [expandedRow, setExpandedRow] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const mockReport = [
      {
        grade:'7',
        section:'1',
        first_name: 'John',
        last_name: 'Smith',
        total_students: '35',
      }
    ];
    setReports(mockReport);
    setLoading(false);
  }, [currentClass]);

  const handleClassChange = (className) => {
    setCurrentClass(className);
    setExpandedRow(null);
  };

  const toggleCard = (reportId) => {
    if (expandedRow === reportId) {
      setExpandedRow(null);
    } else {
      setExpandedRow(reportId);
    }
  };

  const grades = ['7', '8', '9', '10'];

  return (
    <div className={styles.reportTableContainer}>
      <div className={styles.reportTable}>
        <div className={styles.classContainers}>
          {grades.map(grade => (
            <Button 
              key={grade}
              label={`Grade ${grade}`}
              tabBottom={true}
              height="xs"
              width="xs-sm"
              color="grades"
              active={currentClass === grade}
              onClick={() => handleClassChange(grade)}
            >
              Grade {grade}
            </Button>
          ))}

          <div className={styles.tableInfo}>
              <p>Showing {reports.length} teacher/s in Grade {currentClass}</p>
          </div>
        </div>

        <table className={styles.reportsTable}>
          <thead>
            <tr>
              <th>CLASS</th>
              <th>ADVISER</th>
              <th>TOTAL STUDENTS</th>
              <th>GENERATE REPORT</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr>
                <td colSpan="11" className={styles.noReport}>
                  No reports found
                </td>
              </tr>
            ) : (
              reports.map(report => (
                <React.Fragment key={report.id}>
                  <tr 
                    className={`${styles.studentRow} ${expandedRow === report.id ? styles.hiddenRow : ''}`}
                    onClick={() => toggleCard(report.id)}
                  >
                    <td>{report.grade}-{report.section}</td>
                    <td>{report.first_name} {report.last_name}</td>
                    <td>{report.total_students}</td>
                    <td>
                      <div className={styles.icon}>
                      <SignalCellularAltIcon sx={{ fontSize: 34, mb: -0.4 }}/>
                      </div>
                    </td>
                  </tr>
                  
                  {expandedRow === report.id && (
                    <tr 
                      className={styles.expandRow}
                      onClick={() => toggleCard(report.id)}
                    >
                      <td colSpan="9">
                        <div className={`${styles.reportCard} ${styles.expand} ${styles.show}`}>
                          <div className={styles.reportHeader}>
                            {report.first_name} {report.last_name}
                          </div>
                          <div className={styles.reportInfo}>
                            <strong>Report Details</strong>
                          </div>
                          <div className={styles.reportInfo}>Class: {report.grade}-{report.section}</div>
                          <div className={styles.reportInfo}>Adviser's Full Name: {report.first_name} {report.last_name}</div>
                          <div className={styles.reportInfo}>Total Students: {report.total_students}</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReportTable;