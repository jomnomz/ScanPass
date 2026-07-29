import React, { useState, useEffect, useMemo } from 'react';
import styles from './AttendanceReportTable.module.css';
import { supabase } from '../../../lib/supabase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCalendarDays, 
  faCalendar, 
  faCalendarAlt,
  faArrowLeft, 
  faArrowRight,
  faFilter
} from '@fortawesome/free-solid-svg-icons';
import Input from '../../../Components/UI/Input/Input';
import Button from '../../../Components/UI/Buttons/Button/Button';

const AttendanceReportTable = ({ student, currentClass }) => {
  const [reportType, setReportType] = useState('weekly');
  const [currentPeriod, setCurrentPeriod] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gradeLevel, setGradeLevel] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const formatDate = (date, formatStr = 'yyyy-MM-dd') => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    if (formatStr === 'yyyy-MM-dd') {
      return `${year}-${month}-${day}`;
    } else if (formatStr === 'MMMM yyyy') {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
      return `${monthNames[d.getMonth()]} ${year}`;
    } else if (formatStr === 'MMM d, yyyy') {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[d.getMonth()]} ${d.getDate()}, ${year}`;
    } else if (formatStr === 'EEE, MMM d') {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${dayNames[d.getDay()]}, ${monthNames[d.getMonth()]} ${d.getDate()}`;
    } else if (formatStr === 'MMM yyyy') {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[d.getMonth()]} ${year}`;
    } else if (formatStr === 'MMM d') {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[d.getMonth()]} ${d.getDate()}`;
    } else if (formatStr === 'yyyy') {
      return year.toString();
    }
    return `${year}-${month}-${day}`;
  };

  const startOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  };

  const endOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  };

  const addMonths = (date, months) => {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  };

  const subMonths = (date, months) => {
    return addMonths(date, -months);
  };

  const startOfWeek = (date, weekStartsOn = 1) => {
    const result = new Date(date);
    const day = result.getDay();
    const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
    result.setDate(result.getDate() - diff);
    return result;
  };

  const endOfWeek = (date, weekStartsOn = 1) => {
    const result = new Date(date);
    const day = result.getDay();
    const diff = (day < weekStartsOn ? -7 : 0) + 6 - (day - weekStartsOn);
    result.setDate(result.getDate() + diff);
    return result;
  };

  const addWeeks = (date, weeks) => {
    const result = new Date(date);
    result.setDate(result.getDate() + weeks * 7);
    return result;
  };

  const subWeeks = (date, weeks) => {
    return addWeeks(date, -weeks);
  };

  const startOfYear = (date) => {
    return new Date(date.getFullYear(), 0, 1);
  };

  const endOfYear = (date) => {
    return new Date(date.getFullYear(), 11, 31);
  };

  const eachMonthOfInterval = ({ start, end }) => {
    const months = [];
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
      months.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  };

  const extractGradeLevel = (className) => {
    if (!className) return null;
    const match = className.match(/^(\d+)[-\s]/);
    return match ? match[1] : null;
  };

  useEffect(() => {
    if (currentClass) {
      const grade = extractGradeLevel(currentClass);
      setGradeLevel(grade);
    }
  }, [currentClass]);

  useEffect(() => {
    if (student && gradeLevel) {
      loadReportData();
    }
  }, [student, reportType, currentPeriod, gradeLevel]);

  const loadReportData = async () => {
    if (!student || !gradeLevel) return;
    
    setLoading(true);
    setError(null);
    
    try {
      let startDate, endDate;
      
      switch(reportType) {
        case 'weekly':
          startDate = startOfWeek(currentPeriod, 1);
          endDate = endOfWeek(currentPeriod, 1);
          break;
        case 'monthly':
          startDate = startOfMonth(currentPeriod);
          endDate = endOfMonth(currentPeriod);
          break;
        case 'yearly':
          startDate = startOfYear(currentPeriod);
          endDate = endOfYear(currentPeriod);
          break;
      }

      const dateFormat = 'yyyy-MM-dd';
      
      // Get ALL attendance records for the student in the period
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', student.id)
        .gte('date', formatDate(startDate, dateFormat))
        .lte('date', formatDate(endDate, dateFormat))
        .order('date', { ascending: true });
        
      if (attendanceError) throw attendanceError;

      if (!attendance || attendance.length === 0) {
        setAttendanceData([]);
        setLoading(false);
        return;
      }

      let groupedData = [];
      
      if (reportType === 'weekly') {
        const attendanceDates = [...new Set(attendance.map(a => a.date))]
          .sort((a, b) => new Date(a) - new Date(b));
        
        console.log('📊 Weekly attendance dates:', attendanceDates);
        
        groupedData = attendanceDates.map(dateStr => {
          const date = new Date(dateStr);
          const dayAttendance = attendance.find(a => a.date === dateStr);
          
          return {
            period: formatDate(date, 'EEE, MMM d'),
            date: dateStr,
            status: dayAttendance?.status || 'absent',
            timeIn: dayAttendance?.time_in || null,
            timeOut: dayAttendance?.time_out || null
          };
        });
      } 
      else {
        const months = eachMonthOfInterval({ start: startDate, end: endDate });
        
        for (const month of months) {
          const monthStart = startOfMonth(month);
          const monthEnd = endOfMonth(month);
          const monthStr = formatDate(month, 'MMM yyyy');
          
          const monthAttendance = attendance.filter(a => {
            const recordDate = new Date(a.date);
            return recordDate >= monthStart && recordDate <= monthEnd;
          });
          
          if (monthAttendance.length === 0) continue;
          
          const uniqueDays = [...new Set(monthAttendance.map(a => a.date))].length;
          
          const presentDays = monthAttendance.filter(a => a.status === 'present').length;
          const lateDays = monthAttendance.filter(a => a.status === 'late').length;
          const absentDays = uniqueDays - presentDays - lateDays;
          const rate = uniqueDays > 0 
            ? ((presentDays + lateDays) / uniqueDays * 100).toFixed(1)
            : 0;
          
          groupedData.push({
            period: monthStr,
            schoolDays: uniqueDays,
            present: presentDays,
            late: lateDays,
            absent: absentDays,
            rate: rate + '%'
          });
        }
      }

      console.log('📈 Final grouped data:', groupedData);
      setAttendanceData(groupedData);
      
    } catch (err) {
      console.error('Error loading report data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    if (reportType === 'weekly') {
      const totalDays = attendanceData.length;
      const presentDays = attendanceData.filter(day => day.status === 'present').length;
      const lateDays = attendanceData.filter(day => day.status === 'late').length;
      const absentDays = totalDays - presentDays - lateDays;
      const attendanceRate = totalDays > 0 
        ? ((presentDays + lateDays) / totalDays * 100).toFixed(1)
        : 0;

      return {
        totalSchoolDays: totalDays,
        presentDays,
        lateDays,
        absentDays,
        attendanceRate
      };
    } else {
      const totalDays = attendanceData.reduce((sum, month) => sum + month.schoolDays, 0);
      const totalPresent = attendanceData.reduce((sum, month) => sum + month.present, 0);
      const totalLate = attendanceData.reduce((sum, month) => sum + month.late, 0);
      const totalAbsent = attendanceData.reduce((sum, month) => sum + month.absent, 0);
      const totalRate = totalDays > 0 
        ? ((totalPresent + totalLate) / totalDays * 100).toFixed(1)
        : 0;

      return {
        totalSchoolDays: totalDays,
        presentDays: totalPresent,
        lateDays: totalLate,
        absentDays: totalAbsent,
        attendanceRate: totalRate
      };
    }
  };

  const formatTimeDisplay = (timeString) => {
    if (!timeString) return '-';
    
    try {
      const [hours, minutes] = timeString.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      
      return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch (error) {
      return timeString;
    }
  };

  const getStatusDisplay = (status) => {
    let className = styles.status;
    let text = 'Absent';
    
    switch(status?.toLowerCase()) {
      case 'present':
        className += ` ${styles.statusPresent}`;
        text = 'Present';
        break;
      case 'late':
        className += ` ${styles.statusLate}`;
        text = 'Late';
        break;
      case 'absent':
        className += ` ${styles.statusAbsent}`;
        text = 'Absent';
        break;
      default:
        className += ` ${styles.statusAbsent}`;
        text = 'Absent';
    }
    
    return { className, text };
  };

  const getPeriodNavigation = () => {
    switch(reportType) {
      case 'weekly':
        const weekStart = startOfWeek(currentPeriod, 1);
        const weekEnd = endOfWeek(currentPeriod, 1);
        return (
          <div className={styles.periodNavigation}>
            <Button
              icon={<FontAwesomeIcon icon={faArrowLeft} />}
              onClick={() => setCurrentPeriod(subWeeks(currentPeriod, 1))}
              title="Previous Week"
              height="sm"
            />
            <span className={styles.periodDisplay}>
              {formatDate(weekStart, 'MMM d')} - {formatDate(weekEnd, 'MMM d, yyyy')}
            </span>
            <Button
              icon={<FontAwesomeIcon icon={faArrowRight} />}
              onClick={() => setCurrentPeriod(addWeeks(currentPeriod, 1))}
              title="Next Week"
              height="sm"
            />
          </div>
        );
      case 'monthly':
        return (
          <div className={styles.periodNavigation}>
            <Button
              icon={<FontAwesomeIcon icon={faArrowLeft} />}
              onClick={() => setCurrentPeriod(subMonths(currentPeriod, 1))}
              title="Previous Month"
              height="sm"
            />
            <span className={styles.periodDisplay}>{formatDate(currentPeriod, 'MMMM yyyy')}</span>
            <Button
              icon={<FontAwesomeIcon icon={faArrowRight} />}
              onClick={() => setCurrentPeriod(addMonths(currentPeriod, 1))}
              title="Next Month"
              height="sm"
            />
          </div>
        );
      case 'yearly':
        return (
          <div className={styles.periodNavigation}>
            <Button
              icon={<FontAwesomeIcon icon={faArrowLeft} />}
              onClick={() => setCurrentPeriod(new Date(currentPeriod.getFullYear() - 1, 0, 1))}
              title="Previous Year"
              height="sm"
            />
            <span className={styles.periodDisplay}>{formatDate(currentPeriod, 'yyyy')}</span>
            <Button
              icon={<FontAwesomeIcon icon={faArrowRight} />}
              onClick={() => setCurrentPeriod(new Date(currentPeriod.getFullYear() + 1, 0, 1))}
              title="Next Year"
              height="sm"
            />
          </div>
        );
    }
  };

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return attendanceData;
    
    const searchLower = searchTerm.toLowerCase().trim();
    return attendanceData.filter(item => {
      if (reportType === 'weekly') {
        return item.period.toLowerCase().includes(searchLower) || 
               item.status.toLowerCase().includes(searchLower);
      } else {
        return item.period.toLowerCase().includes(searchLower);
      }
    });
  }, [attendanceData, searchTerm, reportType]);

  const stats = calculateStats();

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading attendance report...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <h3>Error Loading Report</h3>
        <p>{error}</p>
        <button 
          className={styles.retryButton}
          onClick={loadReportData}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.studentInfo}>
          <h2 className={styles.studentName}>
            {student.last_name}, {student.first_name}
          </h2>
          <div className={styles.metaInfo}>
            <span className={styles.lrn}>LRN: {student.lrn}</span>
            <span className={styles.class}>Class: {currentClass}</span>
            <span className={styles.grade}>Grade: {gradeLevel}</span>
          </div>
        </div>
        
        <div className={styles.reportControls}>
          <div className={styles.reportTypeSelector}>
            <Button
              label="Weekly"
              icon={<FontAwesomeIcon icon={faCalendarDays} />}
              color={reportType === 'weekly' ? 'primary' : 'secondary'}
              onClick={() => setReportType('weekly')}
              active={reportType === 'weekly'}
              height="sm"
            />
            <Button
              label="Monthly"
              icon={<FontAwesomeIcon icon={faCalendar} />}
              color={reportType === 'monthly' ? 'primary' : 'secondary'}
              onClick={() => setReportType('monthly')}
              active={reportType === 'monthly'}
              height="sm"
            />
            <Button
              label="Yearly"
              icon={<FontAwesomeIcon icon={faCalendarAlt} />}
              color={reportType === 'yearly' ? 'primary' : 'secondary'}
              onClick={() => setReportType('yearly')}
              active={reportType === 'yearly'}
              height="sm"
            />
          </div>
          
          {getPeriodNavigation()}
        </div>
      </div>

      <div className={styles.filterRow}>
        <div className={styles.searchContainer}>
          <Input
            placeholder={reportType === 'weekly' ? "Search dates..." : "Search periods..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            search={true}
          />
        </div>
        
        <div className={styles.statsContainer}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Total Days:</span>
            <span className={styles.statValue}>{stats.totalSchoolDays}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Present:</span>
            <span className={`${styles.statValue} ${styles.present}`}>{stats.presentDays}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Late:</span>
            <span className={`${styles.statValue} ${styles.late}`}>{stats.lateDays}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Absent:</span>
            <span className={`${styles.statValue} ${styles.absent}`}>{stats.absentDays}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Rate:</span>
            <span className={`${styles.statValue} ${styles.rate}`}>{stats.attendanceRate}%</span>
          </div>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <div className={styles.tableWrapper}>
          <table className={styles.attendanceTable}>
            <thead>
              <tr>
                {reportType === 'weekly' ? (
                  <>
                    <th className={styles.dateColumn}>DATE</th>
                    <th className={styles.statusColumn}>STATUS</th>
                    <th className={styles.timeColumn}>TIME IN</th>
                    <th className={styles.timeColumn}>TIME OUT</th>
                  </>
                ) : (
                  <>
                    <th className={styles.periodColumn}>PERIOD</th>
                    <th className={styles.daysColumn}>SCHOOL DAYS</th>
                    <th className={styles.countColumn}>PRESENT</th>
                    <th className={styles.countColumn}>LATE</th>
                    <th className={styles.countColumn}>ABSENT</th>
                    <th className={styles.rateColumn}>ATTENDANCE RATE</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={reportType === 'weekly' ? 4 : 6} className={styles.noData}>
                    No attendance data found for this period.
                  </td>
                </tr>
              ) : (
                filteredData.map((item, index) => {
                  if (reportType === 'weekly') {
                    const statusInfo = getStatusDisplay(item.status);
                    
                    return (
                      <tr 
                        key={index} 
                        className={index % 2 === 0 ? styles.rowEven : styles.rowOdd}
                      >
                        <td className={styles.dateCell}>{item.period}</td>
                        <td className={styles.statusCell}>
                          <span className={statusInfo.className}>
                            {statusInfo.text}
                          </span>
                        </td>
                        <td className={styles.timeCell}>{formatTimeDisplay(item.timeIn)}</td>
                        <td className={styles.timeCell}>{formatTimeDisplay(item.timeOut)}</td>
                      </tr>
                    );
                  } else {
                    return (
                      <tr 
                        key={index} 
                        className={index % 2 === 0 ? styles.rowEven : styles.rowOdd}
                      >
                        <td className={styles.periodCell}>{item.period}</td>
                        <td className={styles.daysCell}>{item.schoolDays}</td>
                        <td className={styles.countCell}>{item.present}</td>
                        <td className={styles.countCell}>{item.late}</td>
                        <td className={styles.countCell}>{item.absent}</td>
                        <td className={styles.rateCell}>
                          <div className={styles.rateContainer}>
                            {item.rate}
                            <div 
                              className={styles.rateBar} 
                              style={{ width: `${parseFloat(item.rate)}%` }}
                            ></div>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.footer}>
        <p className={styles.note}>
          <strong>Note:</strong> This report shows ONLY dates with actual attendance records from the database. 
          {reportType === 'weekly' && ' Missing dates are not shown or marked as absent.'}
          Attendance Rate = (Present + Late) / Total Days with attendance records.
        </p>
      </div>
    </div>
  );
};

export default AttendanceReportTable;