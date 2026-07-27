import React from 'react';
import styles from './TeacherDashboard.module.css';
import TeacherBarGraph from "../../../Components/Charts/TeacherBarGraph/TeacherBarGraph.jsx";
import TeacherLineChart from "../../../Components/Charts/TeacherLineChart/TeacherLineChart.jsx";
import TeacherPieChart from "../../../Components/Charts/TeacherPieChart/TeacherPieChart.jsx";
import DashboardCard from "../../../Components/UI/Cards/DashboardCard/DashboardCard.jsx";
import SectionLabel from "../../../Components/UI/Labels/SectionLabel/SectionLabel.jsx";
import PageLabel from "../../../Components/UI/Labels/PageLabel/PageLabel.jsx";
import DateTodayLabel from "../../../Components/UI/Labels/DateTodayLabel/DateTodayLabel.jsx";
import { useSupabaseData } from '../../../Components/Hooks/fetchData.js';
import { useTeacherClasses } from '../../../Components/Hooks/useTeacherClasses.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUserGraduate,
  faClock,
  faUsers,
  faChartSimple
} from "@fortawesome/free-solid-svg-icons";

import DashboardIcon from '@mui/icons-material/Dashboard';

function TeacherDashboard() {
  const { 
    teacherClasses, 
    teacherSections, 
    teacherSchedule,
    loading: teacherLoading,
    currentTeacher 
  } = useTeacherClasses();
  
  const { data: students, loading: studentsLoading } = useSupabaseData('students');
  const { data: teachers, loading: teachersLoading } = useSupabaseData('teachers');
  
  const isLoading = studentsLoading || teachersLoading || teacherLoading;

  // Calculate teacher-specific stats
  const teacherStudents = React.useMemo(() => {
    if (!students || teacherSections.length === 0) return [];
    
    const sectionIds = teacherSections.map(section => section.section_id);
    return students.filter(student => 
      sectionIds.includes(student.section_id)
    );
  }, [students, teacherSections]);

  const teacherStudentCount = teacherStudents.length;

  // Format time from military to AM/PM
  const formatTimeToAMPM = (timeStr) => {
    if (!timeStr) return 'N/A';
    
    try {
      const [hours, minutes] = timeStr.split(':');
      const hour = parseInt(hours);
      const minute = parseInt(minutes);
      
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      const minuteStr = minute < 10 ? `0${minute}` : minute;
      
      return `${hour12}:${minuteStr}${ampm}`;
    } catch (error) {
      console.error('Error formatting time:', timeStr, error);
      return timeStr;
    }
  };

  // Format schedule for My Schedule card
  const formatScheduleForCard = () => {
    if (!teacherSchedule || teacherSchedule.length === 0) {
      return "No schedule";
    }
    
    // Get the most common schedule
    const scheduleCounts = {};
    teacherSchedule.forEach(schedule => {
      const key = `${schedule.class_start}-${schedule.class_end}`;
      scheduleCounts[key] = (scheduleCounts[key] || 0) + 1;
    });
    
    // Find the schedule with highest count
    let mostCommonSchedule = teacherSchedule[0];
    let highestCount = 0;
    
    teacherSchedule.forEach(schedule => {
      const key = `${schedule.class_start}-${schedule.class_end}`;
      if (scheduleCounts[key] > highestCount) {
        highestCount = scheduleCounts[key];
        mostCommonSchedule = schedule;
      }
    });
    
    const startTime = formatTimeToAMPM(mostCommonSchedule.class_start);
    const endTime = formatTimeToAMPM(mostCommonSchedule.class_end);
    
    return `${startTime}-${endTime}`;
  };

  if (isLoading) return <div className={styles.loading}>Loading dashboard...</div>;

  return (
    <>
      <main className={styles.main}>
        <div className={styles.pageHeader}>
          <SectionLabel 
            label="Teacher Dashboard"
          ></SectionLabel>
          <DateTodayLabel></DateTodayLabel>    
        </div>
        
        {/* Stats Cards */}
        <div className={styles.cards}>
          {/* Total Students Card */}
          <DashboardCard colors={{bg: '#FF6B6B'}}>
            <div className={styles.card}>
              <div className={styles.label}>
                 Total Students
              </div>
              <div className={styles.number}>{teacherStudentCount}</div>
            </div>
          </DashboardCard>

          {/* My Classes Card */}
          <DashboardCard colors={{bg: '#FFD166'}}>
            <div className={styles.card}>
              <div className={styles.label}>
                 My Classes
              </div>
              <div className={styles.number}>{teacherClasses.length}</div>
            </div>
          </DashboardCard>

          {/* Schedule Card */}
          <DashboardCard colors={{bg: '#4ECDC4'}}>
            <div className={styles.card}>
              <div className={styles.label}>
                 My Schedule
              </div>
              <div className={styles.number}>{formatScheduleForCard()}</div>
            </div>
          </DashboardCard>
        </div>

        {/* Charts Section - USING TEACHER-ONLY CHARTS */}
        <div className={styles.charts}>
          <TeacherLineChart 
            teacherId={currentTeacher?.id} 
            teacherSections={teacherSections}
            teacherClasses={teacherClasses}
          />          
          <TeacherBarGraph 
            teacherId={currentTeacher?.id} 
            teacherSections={teacherSections}
            teacherClasses={teacherClasses}
          />
          {/* <TeacherPieChart 
            teacherId={currentTeacher?.id} 
            teacherSections={teacherSections}
            teacherClasses={teacherClasses}
          /> */}
        </div>
      </main>
    </>
  );
}

export default TeacherDashboard;