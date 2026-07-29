import { useState, useCallback, useEffect, useMemo } from 'react';
import styles from './AdminGuardians.module.css';
import PageLabel from "../../../Components/UI/Labels/PageLabel/PageLabel.jsx";
import SectionLabel from '../../../Components/UI/Labels/SectionLabel/SectionLabel.jsx';
import GuardianTable from '../../../Components/Tables/GuardianTable/GuardianTable.jsx';
import Input from '../../../Components/UI/Inputs/Input/Input.jsx';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import Pagination from '../../../Components/UI/Buttons/Pagination/Pagination.jsx';
import { supabase } from '../../../lib/supabase';
import { sortGuardians } from '../../../Utils/SortEntities';
import { useToast } from '../../../Components/Toast/ToastContext/ToastContext.jsx';
import useSearchFilter from '../../../Components/Hooks/useSearchFilter.js';

function AdminGuardians() {
  const { error: toastError } = useToast();
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
          guardian_last_name,
          guardian_email,
          guardian_phone_number,
          first_name,
          last_name,
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
        last_name: student.guardian_last_name,
        email: student.guardian_email,
        phone_number: student.guardian_phone_number,
        guardian_of: `${student.first_name} ${student.last_name}`.trim(),
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

  const { searchTerm, setSearchTerm, filteredRows: searchFilteredRows } = useSearchFilter(allGuardians, [
    (row) => [row.first_name, row.last_name].filter(Boolean).join(' '),
    'guardian_of',
    'student_lrn',
    'email',
    'phone_number',
    'grade',
    'section'
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSection, currentGrade]);

  const refreshGuardians = useCallback(() => {
    console.log('🔄 Manual refresh triggered');
    fetchAllGuardians();
    setRefreshTrigger(prev => prev + 1);
  }, [fetchAllGuardians]);

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

  const filteredGuardians = useMemo(() => {
    let filtered = searchFilteredRows;

    if (currentGrade !== 'all') {
      filtered = filtered.filter(g => g.grade === currentGrade);
    }

    if (selectedSection) {
      filtered = filtered.filter(g => g.section === selectedSection);
    }

    return filtered;
  }, [searchFilteredRows, currentGrade, selectedSection]);

  const sortedGuardians = useMemo(() => {
    return sortGuardians(filteredGuardians);
  }, [filteredGuardians]);

  const totalPages = Math.ceil(sortedGuardians.length / ROWS_PER_PAGE);

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
              placeholder="Search Guardians..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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