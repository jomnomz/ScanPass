import styles from './NavBar.module.css';
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
import StarIcon from '@mui/icons-material/Star';
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import ExpandLessOutlinedIcon from '@mui/icons-material/ExpandLessOutlined';
import { supabase } from '../../../lib/supabase.js';
import ScanPassLogo from "../../../assets/ScanPassLogo.png";

function NavBar({ userType = 'admin', onCollapseChange }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [studentsOpen, setStudentsOpen] = useState(false);
  const [teacherClasses, setTeacherClasses] = useState([]);
  const { profile, user } = useAuth();

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

  useEffect(() => {
    if (location.pathname.includes('/students')) {
      setStudentsOpen(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (userType !== 'teacher' || !user) return;

    const fetchClasses = async () => {
      try {
        const { data: teacherData, error: teacherError } = await supabase
          .from('teachers')
          .select('id')
          .eq('email_address', user.email)
          .single();

        if (teacherError) return;

        const { data: advisorySections } = await supabase
          .from('teacher_sections')
          .select(`
            section:sections (
              id,
              section_name,
              grade:grades ( id, grade_level )
            )
          `)
          .eq('teacher_id', teacherData.id)
          .eq('is_adviser', true);

        // Get teaching sections (non-advisory)
        const { data: teachingSections } = await supabase
          .from('teacher_sections')
          .select(`
            section:sections (
              id,
              section_name,
              grade:grades ( id, grade_level )
            )
          `)
          .eq('teacher_id', teacherData.id)
          .eq('is_adviser', false);

        const classMap = new Map();

        (advisorySections || []).forEach(item => {
          if (!item.section) return;
          const grade = item.section.grade?.grade_level || '';
          const section = item.section.section_name || '';
          const key = `${grade}-${section}`;
          if (!classMap.has(key)) {
            classMap.set(key, { key, grade, section, isAdvisory: false });
          }
          classMap.get(key).isAdvisory = true;
        });

        (teachingSections || []).forEach(item => {
          if (!item.section) return;
          const grade = item.section.grade?.grade_level || '';
          const section = item.section.section_name || '';
          const key = `${grade}-${section}`;
          if (!classMap.has(key)) {
            classMap.set(key, { key, grade, section, isAdvisory: false });
          }
        });

        const classes = Array.from(classMap.values()).sort((a, b) => {
          if (a.isAdvisory && !b.isAdvisory) return -1;
          if (!a.isAdvisory && b.isAdvisory) return 1;
          const ga = parseInt(a.grade) || 0;
          const gb = parseInt(b.grade) || 0;
          if (ga !== gb) return ga - gb;
          return a.section.localeCompare(b.section);
        });

        setTeacherClasses(classes);
      } catch (err) {
        console.error('NavBar: failed to fetch teacher classes', err);
      }
    };

    fetchClasses();
  }, [userType, user]);

  const toggleNavbar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (onCollapseChange) onCollapseChange(newState);
  };

  const isActive = (path) => location.pathname === `/${userType}${path}`;

  const isStudentsActive = () => location.pathname.startsWith(`/${userType}/students`);

  const getClassUrl = (cls) => `/${userType}/students?class=${encodeURIComponent(cls.key)}`;

  const isClassActive = (cls) => {
    const params = new URLSearchParams(location.search);
    return location.pathname === `/${userType}/students` && params.get('class') === cls.key;
  };

  // Get the first advisory class URL, or first class if no advisory
  const getFirstClassUrl = () => {
    if (teacherClasses.length === 0) return `/${userType}/students`;
    const firstAdvisory = teacherClasses.find(c => c.isAdvisory);
    const firstClass = firstAdvisory || teacherClasses[0];
    return getClassUrl(firstClass);
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

  const renderStudentsAccordion = () => (
    <div className={styles.accordionWrapper}>
      <button
        className={`${styles.sideBarButton} ${styles.accordionTrigger} ${isStudentsActive() ? styles.active : ''}`}
        onClick={() => setStudentsOpen(prev => !prev)}
        type="button"
      >
        <span className={styles.sideBarButtonIcon}>
          <GroupsOutlinedIcon />
        </span>
        {(!isCollapsed || isMobile) && (
          <>
            <span className={styles.sideBarButtonLabel}>Students</span>
            <span className={styles.accordionChevron}>
              {studentsOpen ? <ExpandLessOutlinedIcon fontSize="small" /> : <ExpandMoreOutlinedIcon fontSize="small" />}
            </span>
          </>
        )}
      </button>

      {studentsOpen && (!isCollapsed || isMobile) && (
        <div className={styles.accordionContent}>
          {teacherClasses.length === 0 && (
            <span className={styles.accordionEmpty}>No classes assigned</span>
          )}
          {teacherClasses.map(cls => {
            const label = cls.key;

            return (
              <Link
                key={cls.key}
                to={getClassUrl(cls)}
                className={`${styles.classNavItem} ${isClassActive(cls) ? styles.classNavItemActive : ''}`}
                onClick={isMobile ? closeMobile : undefined}
              >
                <span className={styles.classNavLabel}>{label}</span>
                {cls.isAdvisory && (
                  <StarIcon
                    className={styles.advisoryStar}
                    fontSize="inherit"
                    titleAccess="Advisory class"
                  />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderNavContent = () => (
    <>
      <div className={styles.header}>
        <div className={styles.schoolContainer}>
          <div className={styles.schoolLogoContainer}>
            <img className={styles.schoolLogo}  src={ScanPassLogo} alt="ScanPassLogo" />
          </div>
          <div className={styles.schoolName}>
            <span className={styles.schoolTitle}>ScanPass</span> {/* Sto Niño */}
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
        {userType === 'teacher' ? (
          <>
            {currentNavItems.filter(i => i.path === '/dashboard').map(item => (
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

            {currentNavItems.filter(i => i.path === '/attendance').map(item => (
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

            {/* Students accordion with direct link to first class */}
            <div className={styles.accordionWrapper}>
              <Link
                to={getFirstClassUrl()}
                className={`${styles.sideBarButton} ${isStudentsActive() ? styles.active : ''}`}
                onClick={(e) => {
                  if (isMobile) closeMobile();
                  setStudentsOpen(prev => !prev);
                }}
              >
                <span className={styles.sideBarButtonIcon}>
                  <GroupsOutlinedIcon />
                </span>
                {(!isCollapsed || isMobile) && (
                  <>
                    <span className={styles.sideBarButtonLabel}>Students</span>
                    <span
                      className={styles.accordionChevron}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setStudentsOpen(prev => !prev);
                      }}
                    >
                      {studentsOpen ? <ExpandLessOutlinedIcon fontSize="small" /> : <ExpandMoreOutlinedIcon fontSize="small" />}
                    </span>
                  </>
                )}
              </Link>

              {studentsOpen && (!isCollapsed || isMobile) && (
                <div className={styles.accordionContent}>
                  {teacherClasses.length === 0 && (
                    <span className={styles.accordionEmpty}>No classes assigned</span>
                  )}
                  {teacherClasses.map(cls => {
                    const label = cls.key;

                    return (
                      <Link
                        key={cls.key}
                        to={getClassUrl(cls)}
                        className={`${styles.classNavItem} ${isClassActive(cls) ? styles.classNavItemActive : ''}`}
                        onClick={isMobile ? closeMobile : undefined}
                      >
                        <span className={styles.classNavLabel}>{label}</span>
                        {cls.isAdvisory && (
                          <StarIcon
                            className={styles.advisoryStar}
                            fontSize="inherit"
                            titleAccess="Advisory class"
                          />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {currentNavItems.filter(i => i.path === '/settings').map(item => (
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
          </>
        ) : (
          currentNavItems.map(item => (
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
          ))
        )}
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

        <button className={styles.logoutButton} onClick={handleLogout} type="button">
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