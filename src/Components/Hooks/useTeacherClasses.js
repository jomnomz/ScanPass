import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../Authentication/AuthProvider/AuthProvider'; 

export const useTeacherClasses = () => {
  const [teacherClasses, setTeacherClasses] = useState([]);
  const [teacherSections, setTeacherSections] = useState([]);
  const [teacherSchedule, setTeacherSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user, profile } = useAuth();

  const fetchTeacherData = async () => {
    if (!user || !profile) {
      console.log('No user or profile found');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching teacher data for user:', user.email);
      
      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('id, employee_id, first_name, last_name, email_address, auth_user_id')
        .eq('email_address', user.email)
        .single();

      if (teacherError) {
        console.log('Teacher not found by email, trying auth_user_id:', teacherError);
        
        const { data: teacherData2, error: teacherError2 } = await supabase
          .from('teachers')
          .select('id, employee_id, first_name, last_name, email_address, auth_user_id')
          .eq('auth_user_id', user.id)
          .single();

        if (teacherError2) {
          console.log('Teacher not found in database at all');
          setLoading(false);
          return;
        }
        
        await processTeacherData(teacherData2);
      } else {
        await processTeacherData(teacherData);
      }

    } catch (err) {
      setError(err.message);
      console.error('❌ Error fetching teacher data:', err);
    } finally {
      setLoading(false);
    }
  };

  const processTeacherData = async (teacherData) => {
    if (!teacherData) return;
    
    const teacherId = teacherData.id;
    console.log('Processing teacher data for ID:', teacherId);

    // Fetch teacher sections from teacher_sections table 
    const { data: teacherSectionsData, error: sectionsError } = await supabase
      .from('teacher_sections')
      .select(`
        id,
        section_id,
        is_adviser,
        section:sections(
          id,
          section_name,
          grade:grades(id, grade_level)
        )
      `)
      .eq('teacher_id', teacherId);

    if (sectionsError) {
      console.error('Error fetching teacher sections:', sectionsError);
      return;
    }

    console.log('Teacher sections data:', teacherSectionsData);

    // Format sections as classes
    const classes = teacherSectionsData?.map(item => ({
      id: item.id,
      section_id: item.section_id,
      section_name: item.section?.section_name,
      grade_id: item.section?.grade?.id,
      grade_level: item.section?.grade?.grade_level,
      is_adviser: item.is_adviser || false,
      display_name: `${item.section?.grade?.grade_level?.replace('Grade ', '') || ''}-${item.section?.section_name || ''}`
    })) || [];

    console.log('Formatted classes:', classes);
    setTeacherClasses(classes);

    // Set unique sections
    const uniqueSections = [...new Map(classes.map(cls => [cls.section_id, {
      section_id: cls.section_id,
      section_name: cls.section_name,
      grade_id: cls.grade_id,
      grade_level: cls.grade_level,
      is_adviser: cls.is_adviser
    }])).values()];
    
    setTeacherSections(uniqueSections);

    // Fetch grade schedules for the sections
    if (uniqueSections.length > 0) {
      const gradeIds = [...new Set(uniqueSections.map(section => section.grade_id).filter(Boolean))];
      
      console.log('Grade IDs for schedule:', gradeIds);
      
      if (gradeIds.length > 0) {
        try {
          const { data: gradeSchedules, error: scheduleError } = await supabase
            .from('grade_schedules')
            .select(`
              id,
              grade_id,
              class_start,
              class_end,
              grace_period_minutes,
              grade:grades(grade_level)
            `)
            .in('grade_id', gradeIds);

          if (scheduleError) {
            console.error('Error fetching grade schedules:', scheduleError);
            setTeacherSchedule([]);
          } else if (gradeSchedules && gradeSchedules.length > 0) {
            console.log('Found grade schedules:', gradeSchedules);
            
            const schedule = gradeSchedules.map(item => ({
              id: item.id,
              grade_id: item.grade_id,
              grade_level: item.grade?.grade_level || `Grade ${item.grade_id}`,
              class_start: item.class_start,
              class_end: item.class_end,
              grace_period: item.grace_period_minutes
            }));
            
            console.log('Formatted teacher schedule:', schedule);
            setTeacherSchedule(schedule);
          } else {
            console.log('No grade schedules found for these grades');
            setTeacherSchedule([]);
          }
        } catch (scheduleErr) {
          console.error('Error processing schedule data:', scheduleErr);
          setTeacherSchedule([]);
        }
      } else {
        console.log('No grade IDs found in sections');
        setTeacherSchedule([]);
      }
    } else {
      console.log('No sections found for teacher');
      setTeacherSchedule([]);
    }

    console.log('✅ Teacher data loaded successfully');
    console.log('- Classes (sections):', classes.length);
    console.log('- Unique Sections:', uniqueSections.length);
    console.log('- Schedule entries:', teacherSchedule.length);
  };

  useEffect(() => {
    if (user && profile) {
      fetchTeacherData();

      const subscription = supabase
        .channel('teacher-sections-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'teacher_sections'
          },
          () => {
            fetchTeacherData();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'grade_schedules'
          },
          () => {
            fetchTeacherData();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user, profile]);

  return {
    teacherClasses,
    teacherSections,
    teacherSchedule,
    loading,
    error,
    currentTeacher: user,
    refreshTeacherData: fetchTeacherData
  };
};