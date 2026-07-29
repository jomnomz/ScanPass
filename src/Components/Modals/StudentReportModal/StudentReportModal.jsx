import React, { useState, useEffect } from 'react';
import Modal from '../Modal/Modal';
import Button from '../../../Components/UI/Buttons/Button/Button';
import styles from './StudentReportModal.module.css';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../Authentication/AuthProvider/AuthProvider';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

const StudentReportModal = ({ isOpen, onClose, student, currentClass }) => {
  const [reportType, setReportType] = useState('weekly');
  const [currentPeriod, setCurrentPeriod] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [teacherId, setTeacherId] = useState(null);
  const [gradeLevel, setGradeLevel] = useState(null);
  const [schoolDaysData, setSchoolDaysData] = useState([]);
  const { user } = useAuth();

  // Helper functions for date manipulation
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

  const eachMonthOfInterval = ({ start, end }) => {
    const months = [];
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
      months.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  };

  // Extract grade level from class name
  const extractGradeLevel = (className) => {
    if (!className) return null;
    const match = className.match(/^(\d+)[-\s]/);
    return match ? match[1] : null;
  };

  // Get teacher ID
  useEffect(() => {
    const getTeacherId = async () => {
      if (!user?.email) return;
      
      const { data, error } = await supabase
        .from('teachers')
        .select('id')
        .eq('email_address', user.email)
        .single();
        
      if (!error && data) {
        setTeacherId(data.id);
      } else {
        console.error('Error fetching teacher ID:', error);
      }
    };
    
    getTeacherId();
  }, [user]);

  // Extract grade level
  useEffect(() => {
    if (currentClass) {
      const grade = extractGradeLevel(currentClass);
      setGradeLevel(grade);
    }
  }, [currentClass]);

  useEffect(() => {
    if (isOpen && student && gradeLevel && teacherId) {
      loadReportData();
    }
  }, [isOpen, student, reportType, currentPeriod, gradeLevel, teacherId]);

  const loadReportData = async () => {
    if (!student || !gradeLevel || !teacherId) return;
    
    setLoading(true);
    
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
      }

      const dateFormat = 'yyyy-MM-dd';
      
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', student.id)
        .gte('date', formatDate(startDate, dateFormat))
        .lte('date', formatDate(endDate, dateFormat))
        .order('date', { ascending: true });
        
      if (attendanceError) {
        console.error('Error fetching attendance:', attendanceError);
        throw attendanceError;
      }

      console.log('📊 Attendance data found:', attendance?.length || 0, 'records');
      console.log('📅 Dates in attendance data:', attendance?.map(a => a.date).sort() || []);

      const { data: schoolDays, error: schoolDaysError } = await supabase
        .from('class_school_days')
        .select('date')
        .eq('class_name', `Grade ${gradeLevel}`)
        .eq('teacher_id', teacherId)
        .gte('date', formatDate(startDate, dateFormat))
        .lte('date', formatDate(endDate, dateFormat));
      
      if (schoolDaysError) {
        console.error('Error fetching school days:', schoolDaysError);
      }

      setSchoolDaysData(schoolDays || []);

      const validSchoolDays = new Set(schoolDays?.map(item => item.date) || []);
      
      console.log('📚 Valid school days configured by teacher:', Array.from(validSchoolDays).sort());
      console.log('📚 Total valid school days:', validSchoolDays.size);

      if (!attendance || attendance.length === 0) {
        console.log('No attendance data found for period');
        setAttendanceData([]);
        setSummary(null);
        setLoading(false);
        return;
      }

      let groupedData = [];
      let summaryData = null;
      
      if (reportType === 'weekly') {
        const attendanceDates = [...new Set(attendance.map(a => a.date))]
          .filter(date => validSchoolDays.has(date)) 
          .sort((a, b) => new Date(a) - new Date(b));
        
        console.log('✅ Showing only these dates (with attendance AND valid school days):', attendanceDates);
        
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
        
        const totalDays = groupedData.length;
        
        if (totalDays > 0) {
          const presentDays = groupedData.filter(day => day.status === 'present').length;
          const lateDays = groupedData.filter(day => day.status === 'late').length;
          const absentDays = groupedData.filter(day => day.status === 'absent').length;
          const attendanceRate = ((presentDays + lateDays) / totalDays * 100).toFixed(1);

          summaryData = {
            totalSchoolDays: totalDays,
            presentDays,
            lateDays,
            absentDays,
            attendanceRate
          };
        }
      } 
      else {
        const monthStart = startOfMonth(currentPeriod);
        const monthEnd = endOfMonth(currentPeriod);
        const monthStr = formatDate(currentPeriod, 'MMM yyyy');
        
        const monthAttendance = attendance.filter(a => {
          const recordDate = new Date(a.date);
          return recordDate >= monthStart && recordDate <= monthEnd;
        });
        
        if (monthAttendance.length > 0) {
          const validAttendanceDays = monthAttendance
            .filter(a => validSchoolDays.has(a.date))
            .map(a => a.date);
          
          const uniqueDays = [...new Set(validAttendanceDays)].length;
          
          if (uniqueDays > 0) {
            const presentDays = monthAttendance
              .filter(a => a.status === 'present' && validSchoolDays.has(a.date))
              .length;
            
            const lateDays = monthAttendance
              .filter(a => a.status === 'late' && validSchoolDays.has(a.date))
              .length;
            
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
        
        const totalDays = groupedData.reduce((sum, month) => sum + month.schoolDays, 0);
        const totalPresent = groupedData.reduce((sum, month) => sum + month.present, 0);
        const totalLate = groupedData.reduce((sum, month) => sum + month.late, 0);
        const totalAbsent = groupedData.reduce((sum, month) => sum + month.absent, 0);
        const totalRate = totalDays > 0 
          ? ((totalPresent + totalLate) / totalDays * 100).toFixed(1)
          : 0;

        summaryData = {
          totalSchoolDays: totalDays,
          presentDays: totalPresent,
          lateDays: totalLate,
          absentDays: totalAbsent,
          attendanceRate: totalRate
        };
      }

      setAttendanceData(groupedData);
      setSummary(summaryData);
      
      console.log('✅ Final grouped data:', {
        count: groupedData.length,
        items: groupedData,
        summary: summaryData
      });
      
    } catch (error) {
      console.error('Error loading report data:', error);
      setAttendanceData([]);
      setSummary(null);
      setSchoolDaysData([]);
    } finally {
      setLoading(false);
    }
  };

  const getPeriodNavigation = () => {
    switch(reportType) {
      case 'weekly':
        const weekStart = startOfWeek(currentPeriod, 1);
        const weekEnd = endOfWeek(currentPeriod, 1);
        return (
          <div className={styles.periodNavigation}>
            <Button
              icon={<KeyboardArrowLeftIcon />}
              onClick={() => setCurrentPeriod(subWeeks(currentPeriod, 1))}
              title="Previous Week"
              height="xs"
              width="xxss"
              iconColor="#ffffff"
            />
            <span>{formatDate(weekStart, 'MMM d')} - {formatDate(weekEnd, 'MMM d, yyyy')}</span>
            <Button
              icon={<KeyboardArrowRightIcon />}
              onClick={() => setCurrentPeriod(addWeeks(currentPeriod, 1))}
              title="Next Week"
              height="xs"
              width="xxss"
              iconColor="#ffffff"
            />
          </div>
        );
      case 'monthly':
        return (
          <div className={styles.periodNavigation}>
            <Button
              icon={<KeyboardArrowLeftIcon />}
              onClick={() => setCurrentPeriod(subMonths(currentPeriod, 1))}
              title="Previous Month"
              height="xs"
              width="xxss"
              iconColor="#ffffff"
            />
            <span>{formatDate(currentPeriod, 'MMMM yyyy')}</span>
            <Button
              icon={<KeyboardArrowRightIcon />}
              onClick={() => setCurrentPeriod(addMonths(currentPeriod, 1))}
              title="Next Month"
              height="xs"
              width="xxss"
              iconColor="#ffffff"
            />
          </div>
        );
    }
  };

  const renderReportTable = () => {
    if (loading) {
      return <div className={styles.loading}>Loading report data...</div>;
    }

    if (!attendanceData.length) {
      return <div className={styles.noData}>No attendance data available for this period.</div>;
    }

    switch(reportType) {
      case 'weekly':
        return (
          <table className={styles.reportTable}>
            <thead>
              <tr>
                <th className={styles.tableHeader}>DATE</th>
                <th className={styles.tableHeader}>STATUS</th>
                <th className={styles.tableHeader}>TIME IN</th>
                <th className={styles.tableHeader}>TIME OUT</th>
              </tr>
            </thead>
            <tbody>
              {attendanceData.map((day, index) => (
                <tr key={index}>
                  <td className={styles.tableCell}>{day.period}</td>
                  <td className={styles.tableCell}>
                    <span className={`${styles.statusBadge} ${styles[day.status] || styles.absent}`}>
                      {day.status?.toUpperCase() || 'ABSENT'}
                    </span>
                  </td>
                  <td className={styles.tableCell}>{day.timeIn || '-'}</td>
                  <td className={styles.tableCell}>{day.timeOut || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'monthly':
        return (
          <table className={styles.reportTable}>
            <thead>
              <tr>
                <th className={styles.tableHeader}>MONTH</th>
                <th className={styles.tableHeader}>SCHOOL DAYS</th>
                <th className={styles.tableHeader}>PRESENT</th>
                <th className={styles.tableHeader}>LATE</th>
                <th className={styles.tableHeader}>ABSENT</th>
                <th className={styles.tableHeader}>ATTENDANCE RATE</th>
              </tr>
            </thead>
            <tbody>
              {attendanceData.map((period, index) => (
                <tr key={index}>
                  <td className={styles.tableCell}>{period.period}</td>
                  <td className={styles.tableCell}>{period.schoolDays}</td>
                  <td className={styles.tableCell}>{period.present}</td>
                  <td className={styles.tableCell}>{period.late}</td>
                  <td className={styles.tableCell}>{period.absent}</td>
                  <td className={styles.tableCell}>
                    <span className={styles.rateCell}>
                      {period.rate}
                      <div className={styles.rateBar} style={{ width: `${parseFloat(period.rate)}%` }}></div>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
    }
  };

  const renderSummaryCards = () => {
    if (!summary) return null;

    return (
      <div className={styles.summaryCards}>
        <div className={styles.summaryCardSmall}>
          <div className={styles.summaryLabelSmall}>Valid School Days</div>
          <div className={styles.summaryValueSmall}>{summary.totalSchoolDays}</div>
        </div>
        <div className={styles.summaryCardSmall}>
          <div className={styles.summaryLabelSmall}>Present</div>
          <div className={styles.summaryValueSmall} style={{ color: '#10b981' }}>{summary.presentDays}</div>
        </div>
        <div className={styles.summaryCardSmall}>
          <div className={styles.summaryLabelSmall}>Late</div>
          <div className={styles.summaryValueSmall} style={{ color: '#f59e0b' }}>{summary.lateDays}</div>
        </div>
        <div className={styles.summaryCardSmall}>
          <div className={styles.summaryLabelSmall}>Absent</div>
          <div className={styles.summaryValueSmall} style={{ color: '#ef4444' }}>{summary.absentDays}</div>
        </div>
        <div className={styles.summaryCardSmall}>
          <div className={styles.summaryLabelSmall}>Attendance Rate</div>
          <div className={styles.summaryValueSmall} style={{ color: '#3b82f6' }}>
            {summary.attendanceRate}%
          </div>
        </div>
      </div>
    );
  };

  if (!student) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xxxl">
      <div className={styles.studentReportModal}>
        <div className={styles.modalHeader}>
          <div>
            <h2>Attendance Report</h2>
            <p className={styles.studentInfo}>
              {student.last_name}, {student.first_name}
              <span className={styles.lrn}> • LRN: {student.lrn}</span>
              <span className={styles.class}> • Class: {currentClass}</span>
            </p>
          </div>
        </div>

        <div className={styles.reportControls}>
          <div className={styles.reportTypeSelector}>
            <Button
              label="Weekly"
              color={reportType === 'weekly' ? 'primary' : 'secondary'}
              onClick={() => setReportType('weekly')}
              active={reportType === 'weekly'}
              height="sm"
            />
            <Button
              label="Monthly"
              color={reportType === 'monthly' ? 'primary' : 'secondary'}
              onClick={() => setReportType('monthly')}
              active={reportType === 'monthly'}
              height="sm"
            />
          </div>
          
          {getPeriodNavigation()}
        </div>

        {renderSummaryCards()}

        <div className={styles.reportTableContainer}>
          {renderReportTable()}
        </div>

        <div className={styles.footer}>
          <p className={styles.note}>
            <strong>Note:</strong> This report shows ONLY attendance on <strong>valid school days</strong> configured by the teacher.
            {schoolDaysData.length === 0 && reportType === 'weekly' && (
              <span> No school days configured - showing all dates with attendance.</span>
            )}
            {schoolDaysData.length > 0 && (
              <span> Using teacher-configured school days: {schoolDaysData.length} day(s) in this period.</span>
            )}
            Attendance Rate = (Present + Late) / Total Valid School Days with attendance.
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default StudentReportModal;