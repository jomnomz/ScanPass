import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export const useTeacherClassAttendance = (teacherId, teacherClasses) => {
  const [classStats, setClassStats] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState({
    dates: [],
    present: { labels: [], data: [] },
    late: { labels: [], data: [] },
    absent: { labels: [], data: [] },
    totalStudents: { labels: [], data: [] },
    hasRecords: [] 
  });
  const [overallStats, setOverallStats] = useState({
    present: 0,
    late: 0,
    absent: 0,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    total: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getPhilippinesDate = () => {
    const now = new Date();
    const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return phTime.toISOString().split('T')[0];
  };

  const getLast5Days = () => {
    const dates = [];
    const today = new Date();
    const phToday = new Date(today.getTime() + (8 * 60 * 60 * 1000));
    
    for (let i = 4; i >= 0; i--) {
      const date = new Date(phToday);
      date.setDate(date.getDate() - i);
      const phDate = new Date(date.getTime() - (8 * 60 * 60 * 1000)); 
      dates.push(phDate.toISOString().split('T')[0]);
    }
    return dates;
  };

  const formatDateLabel = (dateString) => {
    const date = new Date(dateString + 'T00:00:00Z');
    const phDate = new Date(date.getTime() + (8 * 60 * 60 * 1000));
    return phDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const fetchTeacherClassAttendance = async () => {
    if (!teacherId || !teacherClasses || teacherClasses.length === 0) {
      setClassStats([]);
      setWeeklyStats({
        dates: [],
        present: { labels: [], data: [] },
        late: { labels: [], data: [] },
        absent: { labels: [], data: [] },
        totalStudents: { labels: [], data: [] },
        hasRecords: []
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const today = getPhilippinesDate();
      const last5Days = getLast5Days();
      
      const classStatsData = [];
      const weeklyData = {
        dates: last5Days.map(formatDateLabel),
        present: { labels: [], data: [] },
        late: { labels: [], data: [] },
        absent: { labels: [], data: [] },
        totalStudents: { labels: [], data: [] },
        hasRecords: new Array(last5Days.length).fill(false)
      };
      
      let totalPresent = 0;
      let totalLate = 0;
      let totalAbsent = 0;
      let totalStudents = 0;

      for (const teacherClass of teacherClasses) {
        const { data: students, error: studentsError } = await supabase
          .from('students')
          .select('id')
          .eq('section_id', teacherClass.section_id);

        if (studentsError) throw studentsError;

        const studentCount = students?.length || 0;
        const studentIds = students?.map(s => s.id) || [];

        let presentCount = 0;
        let lateCount = 0;
        let absentCount = 0;

        if (studentIds.length > 0) {
          const { data: todayAttendance, error: todayError } = await supabase
            .from('attendance')
            .select('student_id, status')
            .eq('date', today)
            .in('student_id', studentIds);

          if (todayError) throw todayError;

          if (todayAttendance && todayAttendance.length > 0) {
            todayAttendance.forEach(record => {
              if (record.status === 'present') presentCount++;
              else if (record.status === 'late') lateCount++;
              else if (record.status === 'absent') absentCount++;
            });
            
            const attendedStudentIds = todayAttendance.map(a => a.student_id);
            absentCount += studentCount - attendedStudentIds.length;
          } else {
            absentCount = studentCount;
          }
        } else {
          absentCount = studentCount;
        }

        const simplifiedClassName = `${teacherClass.grade_level?.replace('Grade ', '') || ''}-${teacherClass.section_name || ''}`;
        
        const weeklyClassData = {
          className: simplifiedClassName,
          present: [],
          late: [],
          absent: [],
          totalStudents: []
        };

        if (studentIds.length > 0) {
          const { data: weeklyAttendance, error: weeklyError } = await supabase
            .from('attendance')
            .select('date, student_id, status')
            .in('date', last5Days)
            .in('student_id', studentIds);

          if (weeklyError) throw weeklyError;

          const attendanceByDate = {};
          if (weeklyAttendance) {
            weeklyAttendance.forEach(record => {
              if (!attendanceByDate[record.date]) {
                attendanceByDate[record.date] = [];
              }
              attendanceByDate[record.date].push(record);
            });
          }

          last5Days.forEach((date, dayIndex) => {
            const dayRecords = attendanceByDate[date] || [];
            
            let dayPresent = 0;
            let dayLate = 0;
            let dayAbsent = 0;

            if (dayRecords.length > 0) {
              // We have attendance records for this day
              const attendedStudentIds = new Set();
              
              dayRecords.forEach(record => {
                attendedStudentIds.add(record.student_id);
                if (record.status === 'present') dayPresent++;
                else if (record.status === 'late') dayLate++;
                else if (record.status === 'absent') dayAbsent++;
              });
              
              dayAbsent += studentCount - attendedStudentIds.size;
              
              weeklyData.hasRecords[dayIndex] = true;
            } else {
              const recordDate = new Date(date + 'T00:00:00Z');
              const currentDate = new Date();
              const phCurrentDate = new Date(currentDate.getTime() + (8 * 60 * 60 * 1000));
              const recordDatePH = new Date(recordDate.getTime() + (8 * 60 * 60 * 1000));
              
              const isPastOrToday = recordDatePH <= phCurrentDate;
              
              if (isPastOrToday && studentCount > 0) {
                dayAbsent = studentCount;
                weeklyData.hasRecords[dayIndex] = true;
              }
            }

            weeklyClassData.present.push(dayPresent);
            weeklyClassData.late.push(dayLate);
            weeklyClassData.absent.push(dayAbsent);
            weeklyClassData.totalStudents.push(studentCount);
          });
        } else {
          last5Days.forEach((date, dayIndex) => {
            const recordDate = new Date(date + 'T00:00:00Z');
            const currentDate = new Date();
            const phCurrentDate = new Date(currentDate.getTime() + (8 * 60 * 60 * 1000));
            const recordDatePH = new Date(recordDate.getTime() + (8 * 60 * 60 * 1000));
            
            const isPastOrToday = recordDatePH <= phCurrentDate;
            
            weeklyClassData.present.push(0);
            weeklyClassData.late.push(0);
            weeklyClassData.absent.push(isPastOrToday ? studentCount : 0);
            weeklyClassData.totalStudents.push(studentCount);
            
            if (isPastOrToday && studentCount > 0) {
              weeklyData.hasRecords[dayIndex] = true;
            }
          });
        }

        weeklyData.present.labels.push(weeklyClassData.className);
        weeklyData.present.data.push(weeklyClassData.present);
        weeklyData.late.labels.push(weeklyClassData.className);
        weeklyData.late.data.push(weeklyClassData.late);
        weeklyData.absent.labels.push(weeklyClassData.className);
        weeklyData.absent.data.push(weeklyClassData.absent);
        
        weeklyData.totalStudents.labels.push(weeklyClassData.className);
        weeklyData.totalStudents.data.push(weeklyClassData.totalStudents);

        classStatsData.push({
          id: teacherClass.id,
          className: simplifiedClassName,
          present: presentCount,
          late: lateCount,
          absent: absentCount,
          total: studentCount
        });

        totalPresent += presentCount;
        totalLate += lateCount;
        totalAbsent += absentCount;
        totalStudents += studentCount;
      }

      const presentPercent = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;
      const latePercent = totalStudents > 0 ? Math.round((totalLate / totalStudents) * 100) : 0;
      const absentPercent = totalStudents > 0 ? Math.round((totalAbsent / totalStudents) * 100) : 0;

      setClassStats(classStatsData);
      setWeeklyStats(weeklyData);
      setOverallStats({
        present: presentPercent,
        late: latePercent,
        absent: absentPercent,
        presentCount: totalPresent,
        lateCount: totalLate,
        absentCount: totalAbsent,
        total: totalStudents
      });

      console.log('📊 TEACHER Class attendance loaded:', {
        teacherId,
        classes: teacherClasses.length,
        totalStudents,
        totalPresent,
        totalLate,
        totalAbsent,
        hasRecords: weeklyData.hasRecords,
        weeklyData: {
          dates: weeklyData.dates,
          presentData: weeklyData.present.data,
          totalStudentsData: weeklyData.totalStudents.data
        }
      });

    } catch (err) {
      setError(err.message);
      console.error('❌ Error fetching teacher class attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (teacherId && teacherClasses) {
      fetchTeacherClassAttendance();
      
      const subscription = supabase
        .channel(`teacher-${teacherId}-attendance`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'attendance',
          },
          () => {
            fetchTeacherClassAttendance();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [teacherId, teacherClasses]);

  return {
    classStats,
    weeklyStats,
    overallStats,
    loading,
    error,
    refresh: fetchTeacherClassAttendance
  };
};