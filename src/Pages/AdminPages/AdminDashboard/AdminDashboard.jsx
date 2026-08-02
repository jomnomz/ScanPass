import styles from './AdminDashboard.module.css'
import BarGraph from "../../../Components/Charts/BarGraph/BarGraph.jsx";
import LineChart from "../../../Components/Charts/LineChart/LineChart.jsx";
import PieChart from "../../../Components/Charts/PieChart/PieChart.jsx";
import DashboardCard from "../../../Components/UI/Cards/DashboardCard/DashboardCard.jsx";
import SectionLabel from "../../../Components/UI/Labels/SectionLabel/SectionLabel.jsx";
import DateTodayLabel from "../../../Components/UI/Labels/DateTodayLabel/DateTodayLabel.jsx";
import AttendanceRow from '../../../Components/Grids/AttendanceRow/AttendanceRow.jsx';
import { useSupabaseData } from '../../../Components/Hooks/fetchData.js'; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faUsers,
  faChalkboardUser,
  faUserCheck,
  faComments,
  faUserGraduate,
  faUserShield
} from "@fortawesome/free-solid-svg-icons";

import DashboardIcon from '@mui/icons-material/Dashboard';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import MessageIcon from '@mui/icons-material/Message';
import SchoolIcon from '@mui/icons-material/School';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';

function AdminDashboard() {
  // Fetch students data
  const { data: students, loading: studentsLoading } = useSupabaseData('students');
  
  // Fetch teachers data
  const { data: teachers, loading: teachersLoading } = useSupabaseData('teachers');

  // State for SMS count
  const [smsCount, setSmsCount] = useState(0);
  const [smsLoading, setSmsLoading] = useState(true);
  const [smsError, setSmsError] = useState(null);

  // State for attendance dates (drives AttendanceRow's "past date" dots)
  const [availableDates, setAvailableDates] = useState([]);
  const [datesLoading, setDatesLoading] = useState(true);

  // Get start and end of today in Philippine time (UTC+8)
  const getTodayPhilippinesTimeRange = useCallback(() => {
    const now = new Date();
    
    // Convert to Philippine time (UTC+8)
    const phNow = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    
    // Start of day in Philippine time
    const startOfDay = new Date(phNow);
    startOfDay.setHours(0, 0, 0, 0);
    
    // End of day in Philippine time
    const endOfDay = new Date(phNow);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Convert back to UTC for database query
    const startUTC = new Date(startOfDay.getTime() - (8 * 60 * 60 * 1000));
    const endUTC = new Date(endOfDay.getTime() - (8 * 60 * 60 * 1000));
    
    return {
      start: startUTC.toISOString(),
      end: endUTC.toISOString()
    };
  }, []);

  // Fetch SMS logs count for today
  const fetchSmsCount = useCallback(async () => {
    setSmsLoading(true);
    setSmsError(null);
    
    try {
      const { start, end } = getTodayPhilippinesTimeRange();
      console.log('📱 Fetching SMS logs for today:', { start, end });
      
      // Get count of SMS logs for today (Philippine time)
      const { data, error, count } = await supabase
        .from('sms_logs')
        .select('*', { count: 'exact', head: false })
        .gte('sent_at', start)
        .lte('sent_at', end);
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log(`✅ Found ${count || 0} SMS logs for today`);
      setSmsCount(count || 0);
      
    } catch (err) {
      console.error('❌ Error fetching SMS logs:', err);
      setSmsError(err.message);
      setSmsCount(0); // Default to 0 on error
    } finally {
      setSmsLoading(false);
    }
  }, [getTodayPhilippinesTimeRange]);

  // ===== Attendance dates (same approach as AdminAttendance.jsx) =====
  const fetchAvailableDatesFallback = useCallback(async () => {
    try {
      let allDates = [];
      let from = 0;
      const BATCH = 1000;

      while (true) {
        const { data, error } = await supabase
          .from('attendance')
          .select('date')
          .order('date', { ascending: false })
          .range(from, from + BATCH - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allDates = allDates.concat(data.map(r => r.date).filter(Boolean));
        if (data.length < BATCH) break;
        from += BATCH;
      }

      const uniqueDates = [...new Set(allDates.map(d => {
        const m = String(d).match(/^\d{4}-\d{2}-\d{2}/);
        return m ? m[0] : null;
      }).filter(Boolean))];

      console.log(`✅ Fallback: ${uniqueDates.length} unique attendance dates from ${allDates.length} rows`);
      setAvailableDates(uniqueDates);
    } catch (err) {
      console.error('❌ Fallback attendance-dates fetch also failed:', err);
      setAvailableDates([]);
    }
  }, []);

  const fetchAvailableDates = useCallback(async () => {
    setDatesLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_distinct_attendance_dates');
      if (error) throw error;

      const normalize = (val) => {
        if (!val) return null;
        if (typeof val === 'string') {
          const m = val.match(/^\d{4}-\d{2}-\d{2}/);
          return m ? m[0] : null;
        }
        if (val instanceof Date) return val.toISOString().split('T')[0];
        return null;
      };

      const uniqueDates = (data || [])
        .map(row => normalize(row?.date))
        .filter(Boolean);

      console.log(`✅ Got ${uniqueDates.length} distinct attendance dates`);
      setAvailableDates(uniqueDates);
    } catch (err) {
      console.error('❌ RPC failed, falling back to batch fetch for attendance dates...', err);
      await fetchAvailableDatesFallback();
    } finally {
      setDatesLoading(false);
    }
  }, [fetchAvailableDatesFallback]);

  // Count unique guardians (assuming each student has one guardian)
  const guardianCount = students?.reduce((unique, student) => {
    const guardianKey = `${student.guardian_first_name}-${student.guardian_last_name}-${student.guardian_phone_number}`;
    if (!unique.has(guardianKey)) {
      unique.add(guardianKey);
    }
    return unique;
  }, new Set()).size;

  // Count teachers with accounts (status = 'active')
  const teachersWithAccounts = teachers?.filter(teacher => teacher.status === 'active').length || 0;

  // Total teachers count
  const totalTeachers = teachers?.length || 0;

  // Fetch SMS count on component mount
  useEffect(() => {
    fetchSmsCount();
    
    // Set up a refresh interval to update SMS count periodically (every 5 minutes)
    const intervalId = setInterval(fetchSmsCount, 5 * 60 * 1000);
    
    // Set up real-time subscription for SMS logs
    const channel = supabase
      .channel('sms-logs-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sms_logs'
        },
        (payload) => {
          console.log('📬 New SMS log inserted:', payload);
          // Refresh SMS count when new logs are added
          fetchSmsCount();
        }
      )
      .subscribe();

    return () => {
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [fetchSmsCount]);

  // Fetch attendance dates on mount + keep them live via realtime subscription
  useEffect(() => {
    fetchAvailableDates();

    const channel = supabase
      .channel('admin-dashboard-attendance-dates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        () => {
          fetchAvailableDates();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAvailableDates]);

  const isLoading = studentsLoading || teachersLoading || smsLoading;

  if (isLoading) return <div>Loading dashboard...</div>;

  return (
    <>
      <main className={styles.main}>
        <div className={styles.pageHeader}>
          <SectionLabel label="Admin Dashboard"></SectionLabel>
          <DateTodayLabel></DateTodayLabel>    
        </div>
        <div className={styles.cards}>
          {/* Students Card */}
          <DashboardCard  
            colors={{bg: '#E5EEF5'}}
          >
            <div className={styles.card}>
              <div className={styles.label}>
                Total Students & Guardians 
              </div>
              <div className={styles.number}>{students?.length || 0}</div>
            </div>
          </DashboardCard>

          {/* Total Teachers Card */}
          <DashboardCard 
            colors={{bg: '#E5EEF5'}}
          >
            <div className={styles.card}>
              <div className={styles.label}>
                 Total Teachers 
              </div>
              <div className={styles.number}>{totalTeachers}</div>             
            </div>
          </DashboardCard>

          {/* Teachers with Accounts Card */}
          <DashboardCard 
            colors={{bg: '#E5EEF5'}}
          >
            <div className={styles.card}>
              <div className={styles.label}>
                Teacher Accounts
              </div>
              <div className={styles.number}>{teachersWithAccounts}</div>             
            </div>
          </DashboardCard>

          {/* SMS Sent Today Card */}
          <DashboardCard 
            colors={{bg: '#E5EEF5'}}
          >
            <div className={styles.card}>
              <div className={styles.label}>
                 SMS Notifications Sent Today
              </div>
              <div className={styles.number}>
                {smsError ? (
                  <span className={styles.errorText}>Error</span>
                ) : (
                  smsCount.toLocaleString()
                )}
              </div>
              {smsError && (
                <div className={styles.smsError}>
                  <small>{smsError}</small>
                </div>
              )}
              {/* Timestamp removed as requested */}
            </div>
          </DashboardCard>
        </div>

      <div>
          <AttendanceRow
            hasDataDates={availableDates}
            onSelect={(info) => console.log(info)} // { date, isToday, key }
          />
      </div>

        <div className={styles.charts}>
          <LineChart></LineChart>
          <BarGraph></BarGraph>
          {/* <PieChart></PieChart> */}
        </div>
      </main>
    </>
  )
}

export default AdminDashboard;