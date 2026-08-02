// src/components/Hooks/useEntities.js
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
// The service returns { sections, assignments }
// The UI expects { sections, teachingAssignments }
const normalizeTeacherAssignments = (result) => ({
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

  // ===== FIXED: fetchTeachers with silent option =====
  const fetchTeachers = async (options = {}) => {
    const { silent = false } = options;
    try {
      // Only show loading on initial mount, not on background refreshes
      if (!silent) setLoading(true);
      setError(null);
      
      console.log(`🔄 Fetching teachers...${silent ? ' (silent refresh)' : ''}`);
      const data = await teacherService.fetchAll();
      console.log(`✅ Fetched ${data.length} teachers`);
      setTeachers(data);
      
      // Fetch assignments for all teachers
      if (!silent) setLoadingAssignments(true);
      console.log('🔄 Fetching teacher assignments...');
      
      // ===== OPTIONAL: Use Promise.all for parallel assignment fetching =====
      // This makes both initial load and background refresh much faster
      const assignmentResults = await Promise.all(
        data.map(teacher => teacherService.getTeacherAssignments(teacher.id))
      );
      
      const assignments = {};
      data.forEach((teacher, i) => {
        assignments[teacher.id] = normalizeTeacherAssignments(assignmentResults[i]);
      });
      
      setTeacherAssignments(assignments);
      if (!silent) setLoadingAssignments(false);
      
    } catch (err) {
      console.error('❌ Error fetching teachers:', err);
      setError('Failed to load teachers');
      setTeachers([]);
    } finally {
      // Only show loading on initial mount, not on background refreshes
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    console.log('🚀 useTeachers hook initialized');
    fetchTeachers(); // initial mount — show loading
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

  // ===== FIXED: refetch now uses silent mode =====
  const refetch = async (options = {}) => {
    await fetchTeachers({ silent: true, ...options });
  };

  const getTeacherAssignments = (teacherId) => {
    return teacherAssignments[teacherId] || { sections: [], teachingAssignments: [] };
  };

  // ===== fetch ONE teacher's assignments fresh from the DB, on demand =====
  const fetchTeacherAssignmentsFresh = async (teacherId) => {
    const result = await teacherService.getTeacherAssignments(teacherId);
    const normalized = normalizeTeacherAssignments(result);
    setTeacherAssignments(prev => ({
      ...prev,
      [teacherId]: normalized
    }));
    return normalized;
  };

  const updateTeacherAssignments = async (teacherId, assignments) => {
    try {
      const result = await teacherService.updateTeacherAssignments(teacherId, assignments);
      if (result.success) {
        const updatedAssignments = await teacherService.getTeacherAssignments(teacherId);
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