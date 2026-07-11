import { useState, useCallback, useEffect, useMemo } from 'react';
import styles from './AdminGuardians.module.css';
import PageLabel from "../../../Components/UI/Labels/PageLabel/PageLabel.jsx";
import SectionLabel from '../../../Components/UI/Labels/SectionLabel/SectionLabel.jsx';
import GuardianTable from '../../../Components/Tables/GuardianTable/GuardianTable.jsx';
import Input from '../../../Components/UI/Input/Input.jsx';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import Pagination from '../../../Components/UI/Buttons/Pagination/Pagination.jsx';
import { supabase } from '../../../lib/supabase';
import { sortGuardians } from '../../../Utils/SortEntities';
import { useToast } from '../../../Components/Toast/ToastContext/ToastContext.jsx';

function AdminGuardians() {
  const { error: toastError } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [availableSections, setAvailableSections] = useState([]);
  const [currentGrade, setCurrentGrade] = useState('all');
  const [allGuardians, setAllGuardians] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const [gradesData, setGradesData] = useState([]);
  const [sectionsData, setSectionsData] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);
  const ROWS_PER_PAGE = 20;

  const fetchGrades = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('grades')
        .select('*')
        .order('id');
      
      if (error) throw error;
      setGradesData(data || []);
    } catch (err) {
      console.error('❌ Error loading grades:', err);
      toastError('Failed to load grades data');
    }
  }, [toastError]);

  const fetchSections = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sections')
        .select(`
          *,
          grade:grades(grade_level)
        `)
        .order('id');
      
      if (error) throw error;
      setSectionsData(data || []);
    } catch (err) {
      console.error('❌ Error loading sections:', err);
      toastError('Failed to load sections data');
    }
  }, [toastError]);

  const fetchAllGuardians = useCallback(async () => {
    try {
      console.log('🔄 Fetching ALL guardians from database...');
      setLoadingData(true);
      
      const { data, error } = await supabase
        .from('students')
        .select(`
          id,
          guardian_first_name,
          guardian_middle_name,
          guardian_last_name,
          guardian_email,
          guardian_phone_number,
          first_name,
          last_name,
          middle_name,
          lrn,
          grade:grades(grade_level),
          section:sections(section_name)
        `)
        .not('guardian_first_name', 'is', null)
        .not('guardian_last_name', 'is', null);
      
      if (error) throw error;
      
      const transformedData = (data || []).map(student => ({
        id: student.id,
        first_name: student.guardian_first_name,
        middle_name: student.guardian_middle_name,
        last_name: student.guardian_last_name,
        email: student.guardian_email,
        phone_number: student.guardian_phone_number,
        guardian_of: `${student.first_name} ${student.middle_name || ''} ${student.last_name}`.trim(),
        student_lrn: student.lrn,
        grade: student.grade?.grade_level || 'N/A',
        section: student.section?.section_name || 'N/A'
      }));
      
      setAllGuardians(transformedData);
      console.log('✅ All guardians loaded:', transformedData.length);
      
    } catch (err) {
      console.error('❌ Error loading all guardians:', err);
      setAllGuardians([]);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoadingData(true);
      try {
        await fetchGrades();
        await fetchSections();
        await fetchAllGuardians();
      } catch (err) {
        console.error('❌ Error fetching initial data:', err);
        toastError('Failed to load application data');
      } finally {
        setLoadingData(false);
      }
    };
    
    fetchInitialData();
  }, [fetchGrades, fetchSections, fetchAllGuardians, toastError]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSection, currentGrade]);

  const refreshGuardians = useCallback(() => {
    console.log('🔄 Manual refresh triggered');
    fetchAllGuardians();
    setRefreshTrigger(prev => prev + 1);
  }, [fetchAllGuardians]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleSectionSelect = (section) => {
    setSelectedSection(section);
  };

  const handleClearSectionFilter = () => {
    setSelectedSection('');
  };

  const handleSectionsUpdate = (sections) => {
    setAvailableSections(sections);
  };

  const handleGradeUpdate = (grade) => {
    setCurrentGrade(grade);
  };

  // STEP 1: Filter guardians based on grade, section, and search
  const filteredGuardians = useMemo(() => {
    let filtered = allGuardians;

    if (currentGrade !== 'all') {
      filtered = filtered.filter(g => g.grade === currentGrade);
    }

    if (selectedSection) {
      filtered = filtered.filter(g => g.section === selectedSection);
    }

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(g => 
        g.first_name?.toLowerCase().includes(searchLower) ||
        g.last_name?.toLowerCase().includes(searchLower) ||
        g.guardian_of?.toLowerCase().includes(searchLower) ||
        g.student_lrn?.toLowerCase().includes(searchLower) ||
        g.email?.toLowerCase().includes(searchLower) ||
        g.phone_number?.toLowerCase().includes(searchLower) ||
        g.grade?.toString().toLowerCase().includes(searchLower) ||
        g.section?.toString().toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [allGuardians, searchTerm, currentGrade, selectedSection]);

  // STEP 2: Sort the FULL filtered result set before pagination
  const sortedGuardians = useMemo(() => {
    return sortGuardians(filteredGuardians);
  }, [filteredGuardians]);

  // STEP 3: Calculate total pages based on sorted count
  const totalPages = Math.ceil(sortedGuardians.length / ROWS_PER_PAGE);

  // STEP 4: Paginate the sorted guardians
  const paginatedGuardians = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return sortedGuardians.slice(start, start + ROWS_PER_PAGE);
  }, [sortedGuardians, currentPage]);

  return (
    <>
      <main className={styles.main}>
        <SectionLabel label="Guardian Records" />
        
        <div className={styles.top}>
          <div className={styles.searchAndFilter}>
            <Input 
              placeholder="Search Guardian Records" 
              value={searchTerm}
              onChange={handleSearchChange}
              search="true"
            />
          </div>
        </div>

        {loadingData ? (
          <div className={styles.loadingContainer}>
            <p>Loading guardian data...</p>
          </div>
        ) : (
          <GuardianTable 
            key={`guardian-table-${refreshTrigger}`}
            searchTerm={searchTerm}
            selectedSection={selectedSection}
            onSectionsUpdate={handleSectionsUpdate}
            onGradeUpdate={handleGradeUpdate}
            onClearSectionFilter={handleClearSectionFilter}
            onSectionSelect={handleSectionSelect}
            availableSections={availableSections}
            currentGrade={currentGrade}
            guardians={paginatedGuardians}
            totalGuardianCount={sortedGuardians.length}
            currentPage={currentPage}
            loading={loadingData}
            gradesData={gradesData}
            sectionsData={sectionsData}
            paginationContent={
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />
            }
          />
        )}
      </main>
    </>
  );
}

export default AdminGuardians;