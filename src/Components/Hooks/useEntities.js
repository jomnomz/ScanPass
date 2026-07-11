import { useState, useEffect } from 'react';
import { StudentService, GuardianService, TeacherService } from '../../Utils/EntityService';  
import { supabase } from '../../lib/supabase';

const getStoredGrade = () => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('currentGrade');
    return stored || 'all';
  }
  return 'all';
};

const setStoredGrade = (grade) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('currentGrade', grade);
  }
};

const getStoredFilter = (entityType) => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(`${entityType}Filter`) || 'all';
  }
  return 'all';
};

const setStoredFilter = (entityType, filter) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`${entityType}Filter`, filter);
  }
};

export const useStudents = () => {
  const [currentClass, setCurrentClass] = useState(() => getStoredGrade());
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const studentService = new StudentService();

  const fetchStudents = async (grade) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(`🔄 Fetching students for grade: ${grade}`);
      
      if (grade === 'all') {
        const data = await studentService.fetchAll();
        console.log(`✅ Fetched all students: ${data.length} records`);
        setStudents(data);
      } else {
        const data = await studentService.fetchByGrade(grade);
        console.log(`✅ Fetched grade ${grade} students: ${data.length} records`);
        setStudents(data);
      }
    } catch (err) {
      console.error('❌ Error fetching students:', err);
      setError('Failed to load students');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('🚀 useStudents hook initialized, fetching initial data...');
    fetchStudents(currentClass);
  }, []);

  useEffect(() => {
    console.log(`🔄 Current class changed to: ${currentClass}, fetching students...`);
    fetchStudents(currentClass);
  }, [currentClass]);

  useEffect(() => {
    console.log('🔔 Setting up real-time INSERT subscription for grade:', currentClass);
    
    const subscription = supabase
      .channel('students-inserts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'students',
        },
        (payload) => {
          console.log('🆕 REAL-TIME INSERT: New student detected:', payload.new);
          
          if (currentClass === 'all' || payload.new.grade === currentClass) {
            console.log('✅ Adding new student to current view');
            setStudents(prevStudents => {
              const exists = prevStudents.some(s => s.id === payload.new.id);
              if (!exists) {
                return [...prevStudents, payload.new];
              }
              return prevStudents;
            });
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentClass]);

  const changeClass = (className) => {
    setCurrentClass(className);
    setStoredGrade(className);
  };

  const refetch = () => {
    fetchStudents(currentClass);
  };

  return {
    currentClass,
    entities: students,
    loading,
    error,
    changeClass,
    refetch,
    setEntities: setStudents
  };
};

export const useGuardians = () => {
  const [currentClass, setCurrentClass] = useState(() => getStoredGrade());
  const [guardians, setGuardians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const guardianService = new GuardianService();

  const fetchGuardians = async (grade) => {
    try {
      setLoading(true);
      setError(null);
      
      const data = grade === 'all' 
        ? await guardianService.fetchAll()
        : await guardianService.fetchByGrade(grade);
      
      setGuardians(data);
    } catch (err) {
      console.error('Error fetching guardians:', err);
      setError('Failed to load guardians');
      setGuardians([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuardians(currentClass);
  }, [currentClass]);

  const changeClass = (className) => {
    setCurrentClass(className);
    setStoredGrade(className);
  };

  const refetch = () => {
    fetchGuardians(currentClass);
  };

  return {
    currentClass,
    entities: guardians,
    loading,
    error,
    changeClass,
    refetch,
    setEntities: setGuardians
  };
};

// ===== HELPER: Normalize teacher assignments to match expected shape =====
// The service returns { subjects, sections, assignments }
// The UI expects { subjects, sections, teachingAssignments }
const normalizeTeacherAssignments = (result) => ({
  subjects: result.subjects || [],
  sections: result.sections || [],
  teachingAssignments: result.assignments || []
});

export const useTeachers = () => {
  const [currentFilter, setCurrentFilter] = useState(() => getStoredFilter('teacher'));
  const [teachers, setTeachers] = useState([]);
  const [teacherAssignments, setTeacherAssignments] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [error, setError] = useState(null);

  const teacherService = new TeacherService();

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(`🔄 Fetching teachers...`);
      const data = await teacherService.fetchAll();
      console.log(`✅ Fetched ${data.length} teachers`);
      setTeachers(data);
      
      // Fetch assignments for all teachers (bulk background sync — used for table display only)
      setLoadingAssignments(true);
      console.log('🔄 Fetching teacher assignments...');
      const assignments = {};
      for (const teacher of data) {
        const result = await teacherService.getTeacherAssignments(teacher.id);
        // Normalize the shape: assignments -> teachingAssignments
        assignments[teacher.id] = normalizeTeacherAssignments(result);
      }
      setTeacherAssignments(assignments);
      setLoadingAssignments(false);
      
    } catch (err) {
      console.error('❌ Error fetching teachers:', err);
      setError('Failed to load teachers');
      setTeachers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('🚀 useTeachers hook initialized');
    fetchTeachers();
  }, []);

  useEffect(() => {
    console.log('🔔 Setting up real-time subscription for teachers');
    
    const subscription = supabase
      .channel('teachers-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teachers',
        },
        (payload) => {
          console.log(`🔄 REAL-TIME: Teacher ${payload.eventType}:`, payload.new || payload.old);
          
          if (payload.eventType === 'INSERT') {
            setTeachers(prevTeachers => {
              const exists = prevTeachers.some(t => t.id === payload.new.id);
              if (!exists) {
                return [...prevTeachers, payload.new];
              }
              return prevTeachers;
            });
          } else if (payload.eventType === 'UPDATE') {
            setTeachers(prevTeachers =>
              prevTeachers.map(teacher =>
                teacher.id === payload.new.id ? payload.new : teacher
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setTeachers(prevTeachers =>
              prevTeachers.filter(teacher => teacher.id !== payload.old.id)
            );
            setTeacherAssignments(prev => {
              const newAssignments = { ...prev };
              delete newAssignments[payload.old.id];
              return newAssignments;
            });
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const changeFilter = (filterName) => {
    setCurrentFilter(filterName);
    setStoredFilter('teacher', filterName);
  };

  const refetch = async () => {
    await fetchTeachers();
  };

  const getTeacherAssignments = (teacherId) => {
    return teacherAssignments[teacherId] || { subjects: [], sections: [], teachingAssignments: [] };
  };

  // ===== fetch ONE teacher's assignments fresh from the DB, on demand =====
  // Use this right before opening the edit modal so the form is never built
  // from stale/in-flight background-sync data.
  const fetchTeacherAssignmentsFresh = async (teacherId) => {
    const result = await teacherService.getTeacherAssignments(teacherId);
    // Normalize the shape: assignments -> teachingAssignments
    const normalized = normalizeTeacherAssignments(result);
    setTeacherAssignments(prev => ({
      ...prev,
      [teacherId]: normalized
    }));
    return normalized; // return the normalized shape, not raw result
  };

  const updateTeacherAssignments = async (teacherId, assignments) => {
    try {
      const result = await teacherService.updateTeacherAssignments(teacherId, assignments);
      if (result.success) {
        // Refresh assignments for this teacher
        const updatedAssignments = await teacherService.getTeacherAssignments(teacherId);
        // Normalize the shape: assignments -> teachingAssignments
        setTeacherAssignments(prev => ({
          ...prev,
          [teacherId]: normalizeTeacherAssignments(updatedAssignments)
        }));
      }
      return result;
    } catch (error) {
      console.error('Error updating teacher assignments:', error);
      return { success: false, error: error.message };
    }
  };

  return {
    currentFilter,
    entities: teachers,
    teacherAssignments,
    loadingAssignments,
    loading,
    error,
    changeFilter,
    refetch,
    setEntities: setTeachers,
    getTeacherAssignments,
    fetchTeacherAssignmentsFresh,
    updateTeacherAssignments
  };
};