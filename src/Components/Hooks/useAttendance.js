import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export const useAttendance = () => {
  const [currentClass, setCurrentClass] = useState('all');
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentDate, setCurrentDate] = useState(null);
  
  const getPhilippinesDate = useCallback(() => {
    const now = new Date();
    const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return phTime.toISOString().split('T')[0];
  }, []);

  const getPhilippinesDateTime = useCallback(() => {
    const now = new Date();
    return new Date(now.getTime() + (8 * 60 * 60 * 1000));
  }, []);

  const createDefaultAbsentRecordsForDate = useCallback(async (date) => {
    try {
      console.log(`📅 Creating default absent records for DATE: ${date}`);
      
      const { data: existingAttendance, error: checkError } = await supabase
        .from('attendance')
        .select('id')
        .eq('date', date)
        .limit(1);
      
      if (checkError) throw checkError;
      
      if (existingAttendance && existingAttendance.length > 0) {
        console.log(`📋 Attendance records already exist for ${date}, skipping`);
        return;
      }
      
      const { data: allStudents, error: studentsError } = await supabase
        .from('students')
        .select(`
          id,
          lrn,
          first_name,
          last_name,
          grade:grades(grade_level),
          section:sections(section_name)
        `)
        .order('last_name');
      
      if (studentsError) throw studentsError;
      
      if (!allStudents || allStudents.length === 0) {
        console.log('📭 No students found to create attendance records');
        return;
      }
      
      const defaultRecords = allStudents.map(student => ({
        student_id: student.id,
        status: 'absent',
        date: date,
        created_at: getPhilippinesDateTime().toISOString(),
        time_in: null,
        time_out: null,
        scan_type: null
      }));
      
      console.log(`📝 Creating ${defaultRecords.length} default absent records for ${date}`);
      
      // Insert in batches
      const batchSize = 50;
      for (let i = 0; i < defaultRecords.length; i += batchSize) {
        const batch = defaultRecords.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('attendance')
          .insert(batch);
        
        if (insertError) {
          console.error('❌ Error inserting default records:', insertError);
        }
      }
      
      console.log(`✅ Created ${defaultRecords.length} default absent records for ${date}`);
      
    } catch (error) {
      console.error('❌ Error creating default absent records:', error);
    }
  }, [getPhilippinesDateTime]);

  const processAttendanceData = useCallback((students, attendanceRecords, targetDate) => {
    const combinedData = students.map(student => {
      const studentRecord = attendanceRecords?.find(record => 
        record.student_id === student.id
      );

      if (!studentRecord) {
        return {
          id: `temp-${student.id}-${targetDate}`,
          lrn: student.lrn,
          first_name: student.first_name,
          last_name: student.last_name,
          grade: student.grade?.grade_level || 'N/A',
          section: student.section?.section_name || 'N/A',
          time_in: null,
          time_out: null,
          date: targetDate,
          status: 'absent',
          student_lrn: student.lrn,
          created_at: null,
          scan_type: null,
          student_id: student.id,
          has_record: false,
          is_temporary: true
        };
      }

      return {
        id: studentRecord.id,
        lrn: student.lrn,
        first_name: student.first_name,
        last_name: student.last_name,
        grade: student.grade?.grade_level || 'N/A',
        section: student.section?.section_name || 'N/A',
        time_in: studentRecord.time_in,
        time_out: studentRecord.time_out,
        date: studentRecord.date,
        status: studentRecord.status,
        student_lrn: studentRecord.student_lrn,
        created_at: studentRecord.created_at,
        scan_type: studentRecord.scan_type,
        student_id: studentRecord.student_id,
        has_record: true,
        is_temporary: false
      };
    });

    console.log(`✅ Processed ${combinedData.length} attendance records for ${targetDate}`);
    
    return combinedData;
  }, []);

  const fetchAttendance = useCallback(async (grade = 'all', date = null) => {
    setLoading(true);
    setError(null);
    
    try {
      const targetDate = date || getPhilippinesDate();
      setCurrentDate(targetDate);
      
      console.log(`📊 Fetching attendance for ${grade === 'all' ? 'all grades' : `Grade ${grade}`} on ${targetDate}`);
      
      let studentsQuery = supabase
        .from('students')
        .select(`
          id,
          lrn,
          first_name,
          last_name,
          grade:grades(id, grade_level),
          section:sections(section_name)
        `)
        .order('last_name');

      if (grade !== 'all') {
        studentsQuery = studentsQuery.eq('grades.grade_level', grade);
      }

      const { data: students, error: studentsError } = await studentsQuery;
      if (studentsError) throw studentsError;

      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', targetDate)
        .order('time_in', { ascending: true });

      if (attendanceError) throw attendanceError;

      let finalRecords = attendanceRecords;
      
      if (!attendanceRecords || attendanceRecords.length === 0) {
        console.log(`📭 No attendance records found for ${targetDate}, creating defaults...`);
        await createDefaultAbsentRecordsForDate(targetDate);
        
        const { data: newAttendanceRecords, error: newAttendanceError } = await supabase
          .from('attendance')
          .select('*')
          .eq('date', targetDate)
          .order('time_in', { ascending: true });
          
        if (newAttendanceError) throw newAttendanceError;
        finalRecords = newAttendanceRecords || [];
      }

      const processedData = processAttendanceData(students, finalRecords, targetDate);
      setAttendances(processedData);
      
    } catch (err) {
      setError(err.message);
      console.error('❌ Error fetching attendance:', err);
    } finally {
      setLoading(false);
    }
  }, [getPhilippinesDate, createDefaultAbsentRecordsForDate, processAttendanceData]);

  const fetchAttendanceForDate = useCallback(async (date, grade = 'all') => {
    return fetchAttendance(grade, date);
  }, [fetchAttendance]);

  const changeClass = useCallback((className) => {
    setCurrentClass(className);
  }, []);

  useEffect(() => {
    fetchAttendance('all');
  }, [fetchAttendance]);

  return {
    currentClass,
    attendances,
    loading,
    error,
    currentDate,
    
    changeClass,
    fetchAttendance,
    fetchAttendanceForDate,
    refreshAttendance: () => fetchAttendance(currentClass, currentDate),
    
    getStatusCounts: () => {
      const counts = {
        present: 0,
        late: 0,
        absent: 0,
        total: attendances.length
      };
      
      attendances.forEach(attendance => {
        if (attendance.status === 'present') {
          counts.present++;
        } else if (attendance.status === 'late') {
          counts.late++;
        } else if (attendance.status === 'absent') {
          counts.absent++;
        }
      });
      
      return counts;
    }
  };
};