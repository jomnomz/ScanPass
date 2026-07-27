import { useState, useEffect, useCallback, useMemo } from 'react';
import styles from './TeacherAttendance.module.css';
import PageLabel from "../../../Components/UI/Labels/PageLabel/PageLabel.jsx";
import AttendanceCard from '../../../Components/UI/Cards/AttendanceCard/AttendanceCard.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClipboardCheck } from "@fortawesome/free-solid-svg-icons";
import { useAuth } from '../../../Components/Authentication/AuthProvider/AuthProvider.jsx';
import SectionLabel from '../../../Components/UI/Labels/SectionLabel/SectionLabel.jsx';

const CACHE_TTL_MS = 5 * 60 * 1000;

const getTeacherAttendanceCacheKey = (userId, email) => {
  if (userId) {
    return `teacher-attendance-classes:${userId}`;
  }

  if (email) {
    return `teacher-attendance-classes:${email}`;
  }

  return '';
};

const readCachedClasses = (cacheKey) => {
  if (!cacheKey) {
    return null;
  }

  try {
    const cachedValue = sessionStorage.getItem(cacheKey);

    if (!cachedValue) {
      return null;
    }

    const parsed = JSON.parse(cachedValue);

    if (!Array.isArray(parsed?.classes)) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('Failed to read teacher attendance cache:', error);
    return null;
  }
};

const writeCachedClasses = (cacheKey, classes) => {
  if (!cacheKey) {
    return;
  }

  try {
    sessionStorage.setItem(
      cacheKey,
      JSON.stringify({
        classes,
        timestamp: Date.now()
      })
    );
  } catch (error) {
    console.error('Failed to write teacher attendance cache:', error);
  }
};

function TeacherAttendance() {
  const { user, profile, loading: authLoading } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cacheKey = useMemo(
    () => getTeacherAttendanceCacheKey(user?.id, profile?.email),
    [user?.id, profile?.email]
  );

  const getTeacherId = useCallback(async () => {
    try {
      if (user?.id) {
        console.log(`🔍 Trying auth user ID: ${user.id}`);
        const response = await fetch(
          `/api/teacher-invite/get-teacher-id-by-auth?authUserId=${user.id}`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include'
          }
        );
        
        console.log('📡 Response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('📦 Auth ID response:', data);
          
          if (data.success) {
            console.log(`✅ Found teacher via auth ID: ${data.teacherId}`);
            return data.teacherId;
          }
        } else {
          console.log('❌ Auth ID failed, trying email...');
        }
      }
      
      if (profile?.email) {
        console.log(`🔍 Falling back to email: ${profile.email}`);
        const response = await fetch(
          `/api/teacher-invite/get-teacher-id-by-email?email=${encodeURIComponent(profile.email)}`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include'
          }
        );
        
        console.log('📡 Response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('📦 Email response:', data);
          
          if (data.success) {
            console.log(`✅ Found teacher via email: ${data.teacherId}`);
            return data.teacherId;
          }
        }
      }
      
      console.log('❌ No teacher found');
      return null;
      
    } catch (err) {
      console.error('❌ Error getting teacher ID:', err.message);
      return null;
    }
  }, [profile?.email, user?.id]);

  const fetchTeacherClassesById = useCallback(async (teacherId, options = {}) => {
    const { silent = false } = options;

    try {
      if (!silent) {
        setLoading(true);
      }

      console.log(`📚 Fetching classes for teacher ID: ${teacherId}`);
      
      const response = await fetch(`/api/teacher-invite/teacher-classes/${teacherId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📦 Classes response:', data);
      
      if (data.success) {
        setClasses(data.classes);
        writeCachedClasses(cacheKey, data.classes);
        setError(null);
        console.log(`✅ Loaded ${data.classes.length} classes`);
      } else {
        setError(data.error || 'Failed to load classes');
      }
    } catch (err) {
      console.error('❌ Error fetching classes:', err.message);
      setError(err.message || 'Failed to load classes. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [cacheKey]);

  const fetchTeacherClasses = useCallback(async (options = {}) => {
    const { silent = false } = options;

    try {
      if (!silent) {
        setLoading(true);
      }

      setError(null);
      
      console.log('🔄 Starting fetchTeacherClasses');
      
      if (!user || !profile) {
        setError('Please log in to view your classes');
        setLoading(false);
        return;
      }
      
      if (profile.role !== 'teacher') {
        setError('This page is for teachers only');
        setLoading(false);
        return;
      }
      
      const teacherId = await getTeacherId();
      
      if (!teacherId) {
        setError('Teacher account not found. Please contact administration.');
        setLoading(false);
        return;
      }
      
      console.log(`✅ Got teacher ID: ${teacherId}`);
      await fetchTeacherClassesById(teacherId, { silent });
      
    } catch (err) {
      console.error('❌ Error in fetchTeacherClasses:', err);
      setError('Failed to load classes. Please try again.');
      setLoading(false);
    }
  }, [fetchTeacherClassesById, getTeacherId, profile, user]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user || !profile) {
      setClasses([]);
      setLoading(false);
      setError('Please log in to view your classes');
      return;
    }

    const cached = readCachedClasses(cacheKey);
    const hasCachedClasses = cached && Array.isArray(cached.classes);
    const isCacheFresh = hasCachedClasses && Date.now() - (cached.timestamp || 0) < CACHE_TTL_MS;

    if (hasCachedClasses) {
      setClasses(cached.classes);
      setLoading(false);
      setError(null);
    }

    if (!hasCachedClasses || !isCacheFresh) {
      fetchTeacherClasses({ silent: hasCachedClasses });
    }
  }, [authLoading, cacheKey, fetchTeacherClasses, profile, user]);

  const handleCardClick = (className) => {
    console.log(`Card clicked: ${className}`);
    const selectedClass = classes.find(cls => cls.className === className);
    if (selectedClass) {
      console.log('Selected class:', selectedClass);
      localStorage.setItem('selectedClass', JSON.stringify(selectedClass));
    }
  };

  if (authLoading) {
    return (
      <main className={styles.main}>
        <PageLabel 
          icon={<FontAwesomeIcon icon={faClipboardCheck} />}  
          label="Daily Attendance Record for Each Class"
        />
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading authentication...</p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className={styles.main}>
        <PageLabel 
          icon={<FontAwesomeIcon icon={faClipboardCheck} />}  
          label="Daily Attendance Record for Each Class"
        />
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading your classes...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className={styles.main}>
        <PageLabel 
          icon={<FontAwesomeIcon icon={faClipboardCheck} />}  
          label="Daily Attendance Record for Each Class"
        />
        <div className={styles.errorContainer}>
          <p className={styles.errorText}>{error}</p>
          <button onClick={() => fetchTeacherClasses()} className={styles.retryButton}>
            Try Again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <SectionLabel  
        label="Daily Attendance Record for Each Class"
      />
      
      {classes.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📚</div>
          <h3>No Classes Assigned</h3>
          <p>You don't have any classes assigned yet.</p>
          <p>Contact the school administration to get your teaching assignments.</p>
          <button onClick={() => fetchTeacherClasses()} className={styles.retryButton}>
            Refresh
          </button>
        </div>
      ) : (
        <div className={styles.classesGrid}>
          {classes.map((classItem) => (
            <AttendanceCard
              key={classItem.id}
              className={classItem.className}
              initialColor={classItem.initialColor}
              onCardClick={handleCardClick}
            />
          ))}
        </div>
      )}
    </main>
  );
}

export default TeacherAttendance;