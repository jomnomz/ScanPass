import styles from './NavBar.module.css'
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../Authentication/AuthProvider/AuthProvider';
import { useEffect, useState } from 'react';

import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LogoutIcon from '@mui/icons-material/Logout';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import { supabase } from '../../../lib/supabase.js';
import minimalist_stonino from  '../../../assets/minimalist_stonino.png';



function NavBar({ userType = 'admin', onCollapseChange }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { profile } = useAuth();
  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (isMobile && onCollapseChange) {
      onCollapseChange(true);
    }
  }, [isMobile, onCollapseChange]);

  const toggleNavbar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (onCollapseChange) onCollapseChange(newState);
  };

  const isActive = (path) => {
    return location.pathname === `/${userType}${path}`;
  };

  const navItems = {
    admin: [
      { path: '/dashboard', icon: <DashboardOutlinedIcon />, label: 'Dashboard' },
      { path: '/students', icon: <GroupsOutlinedIcon />, label: 'Students' },
      { path: '/guardians', icon: <PeopleAltOutlinedIcon />, label: 'Guardians' },
      { path: '/messages', icon: <NotificationsNoneOutlinedIcon />, label: 'Notifications' },
      { path: '/attendance', icon: <AssignmentTurnedInOutlinedIcon />, label: 'Attendance' },
      { path: '/masterData', icon: <TableChartOutlinedIcon />, label: 'Master Data' },
      { path: '/teachers', icon: <SchoolOutlinedIcon />, label: 'Teachers' },
      { path: '/settings', icon: <SettingsOutlinedIcon />, label: 'Settings' }
    ],
    teacher: [
      { path: '/dashboard', icon: <DashboardOutlinedIcon />, label: 'Dashboard' },
      { path: '/attendance', icon: <AssignmentTurnedInOutlinedIcon />, label: 'Attendance' },
      { path: '/students', icon: <GroupsOutlinedIcon />, label: 'Students' },
      { path: '/settings', icon: <SettingsOutlinedIcon />, label: 'Settings' }
    ]
  };

  const currentNavItems = navItems[userType] || navItems.admin;
  const displayName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
  const displayEmail = profile?.email || profile?.username || `${userType}@example.com`;

  const handleLogout = async () => {
    try {
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.removeItem('supabase.auth.token');
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      navigate('/');
    }
  };

  const closeMobile = () => setMobileOpen(false);

  const renderNavContent = () => (
    <>
      <div className={styles.header}>

        <div className={styles.schoolContainer}>
          <div className={styles.schoolLogoContainer}>
            <img className={styles.schoolLogo} src={minimalist_stonino} alt="" />
          </div>
          <div className={styles.schoolName}>
            <span className={styles.schoolTitle}>Sto Niño</span>
            <span className={styles.schoolSubtitle}>High School</span>
          </div>
        </div>

        {isMobile ? (
          <button className={styles.iconButton} onClick={closeMobile} aria-label="Close sidebar">
            <CloseOutlinedIcon fontSize="small" />
          </button>
        ) : (
          <button className={styles.iconButton} onClick={toggleNavbar} aria-label="Toggle sidebar">
            <MenuOutlinedIcon fontSize="small" />
          </button>
        )}
      </div>

      <div className={styles.sideBar}>
        {currentNavItems.map(item => (
          <Link
            key={item.path}
            to={`/${userType}${item.path}`}
            className={`${styles.sideBarButton} ${isActive(item.path) ? styles.active : ''}`}
            title={isCollapsed && !isMobile ? item.label : ''}
            onClick={isMobile ? closeMobile : undefined}
          >
            <span className={styles.sideBarButtonIcon}>{item.icon}</span>
            {(!isCollapsed || isMobile) && <span className={styles.sideBarButtonLabel}>{item.label}</span>}
          </Link>
        ))}
      </div>

      <div className={styles.footer}>
        <div className={styles.footerProfile}>
          <span className={styles.footerIcon}>
            <PersonOutlineIcon fontSize="small" />
          </span>
          {(!isCollapsed || isMobile) && (
            <div className={styles.footerText}>
              <p className={styles.footerName}>{displayName || 'User'}</p>
              <p className={styles.footerEmail}>{displayEmail}</p>
            </div>
          )}
        </div>

        <button className={styles.logoutButton} onClick={handleLogout} type="button" pill="true">
          <span className={styles.logoutIcon}>
            <LogoutIcon fontSize="small" />
          </span>
          {(!isCollapsed || isMobile) && <span className={styles.logoutLabel}>Logout</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {isMobile && (
        <button
          className={styles.mobileTrigger}
          onClick={() => setMobileOpen(true)}
          aria-label="Open sidebar"
        >
          <MenuOutlinedIcon fontSize="small" />
        </button>
      )}

      {isMobile && mobileOpen && <div className={styles.backdrop} onClick={closeMobile} />}

      <nav
        className={[
          styles.nav,
          isCollapsed ? styles.collapsed : '',
          isMobile ? styles.mobileNav : '',
          isMobile && mobileOpen ? styles.mobileOpen : ''
        ].filter(Boolean).join(' ')}
      >
        {renderNavContent()}
      </nav>
    </>
  );
}

export default NavBar;