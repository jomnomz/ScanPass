import React, { useMemo, useState, useEffect, useCallback } from 'react';
import styles from './MessageTable.module.css';
import { supabase } from '../../../lib/supabase';
import SectionDropdown from '../../UI/Buttons/SectionDropdown/SectionDropdown';
import Table from '../Table/Table.jsx';
import Pagination from '../../../Components/UI/Buttons/Pagination/Pagination.jsx';

const MessageTable = ({
  searchTerm = '',
  selectedSection = '',
  onSectionsUpdate,
  onGradeUpdate,
  onSectionSelect,
  availableSections = [],
  loading: parentLoading = false,
  selectedDate = '',
}) => {
  const [currentClass, setCurrentClass] = useState('all');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [availableSectionsLocal, setAvailableSectionsLocal] = useState([]);
  const [expandedRowId, setExpandedRowId] = useState(null);

  // PAGINATION STATE
  const [currentPage, setCurrentPage] = useState(1);
  const ROWS_PER_PAGE = 20;

  // Get today's date in Philippine time (UTC+8)
  const getTodayPhilippines = () => {
    const now = new Date();
    const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return phTime.toISOString().split('T')[0];
  };

  // Get date for display
  const getTodayDisplay = () => {
    const today = getTodayPhilippines();
    const dateObj = new Date(today + 'T00:00:00Z');
    const phDate = new Date(dateObj.getTime() + (8 * 60 * 60 * 1000));
    return phDate.toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Check if a date is today
  const isDateToday = (dateString) => {
    const today = getTodayPhilippines();
    return dateString === today;
  };

  const allUniqueSections = useMemo(() => {
    const sections = messages
      .map(message => message.section || '')
      .filter(section => section && section.trim() !== '');

    const uniqueSections = [...new Set(sections)];
    return uniqueSections.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [messages]);

  const currentGradeSections = useMemo(() => {
    if (currentClass === 'all') {
      return allUniqueSections;
    }

    const sections = messages
      .filter(message => message.grade === currentClass)
      .map(message => message.section || '')
      .filter(section => section && section.trim() !== '');

    const uniqueSections = [...new Set(sections)];
    return uniqueSections.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [messages, currentClass, allUniqueSections]);

  useEffect(() => {
    setAvailableSectionsLocal(currentGradeSections);
    if (onSectionsUpdate) {
      onSectionsUpdate(allUniqueSections);
    }
  }, [currentGradeSections, allUniqueSections, onSectionsUpdate]);

  const formatDateTimeLocal = (dateString) => {
    if (!dateString) return 'N/A';

    try {
      const date = new Date(dateString);

      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }

      return date.toLocaleString('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return 'N/A';
    }
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return 'N/A';

    const cleaned = phone.replace(/\D/g, '');

    if (cleaned.length === 10 && cleaned.startsWith('9')) {
      return `+63 ${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6)}`;
    } else if (cleaned.length === 12 && cleaned.startsWith('639')) {
      return `+63 ${cleaned.substring(3, 6)} ${cleaned.substring(6, 9)} ${cleaned.substring(9)}`;
    }

    return phone;
  };

  const getGuardianName = (student) => {
    if (!student) return 'N/A';

    const firstName = student.guardian_first_name || '';
    const middleName = student.guardian_middle_name ? ` ${student.guardian_middle_name}` : '';
    const lastName = student.guardian_last_name || '';

    const fullName = `${firstName}${middleName} ${lastName}`.trim();
    return fullName || 'N/A';
  };

  const fetchSMSLogs = async (grade = 'all', dateFilter = '') => {
    setLoading(true);
    setError(null);

    try {
      console.log(`📱 Fetching SMS logs for ${grade === 'all' ? 'all grades' : `Grade ${grade}`}`);

      let query = supabase
        .from('sms_logs')
        .select(`
          *,
          student:students!sms_logs_student_id_fkey (
            id,
            lrn,
            first_name,
            last_name,
            grade_id,
            section_id,
            grade:grades(grade_level),
            section:sections(section_name),
            guardian_first_name,
            guardian_middle_name,
            guardian_last_name,
            guardian_phone_number,
            guardian_email
          )
        `)
        .order('sent_at', { ascending: false });

      const targetDate = dateFilter || getTodayPhilippines();
      console.log(`📅 Fetching logs for date: ${targetDate}`);

      const startDate = new Date(`${targetDate}T00:00:00.000+08:00`);
      const endDate = new Date(`${targetDate}T23:59:59.999+08:00`);

      query = query
        .gte('sent_at', startDate.toISOString())
        .lt('sent_at', endDate.toISOString());

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      console.log(`✅ Loaded ${data?.length || 0} SMS logs for ${targetDate}`);

      const transformedMessages = (data || []).map(log => {
        const student = log.student;

        const guardianName = student ? getGuardianName(student) : (log.guardian_name || 'N/A');
        const guardianPhone = student?.guardian_phone_number || log.phone_number || 'N/A';
        const formattedPhone = formatPhoneNumber(guardianPhone);

        const isDemo = log.demo_mode || log.provider === 'demo' || log.cost === '₱0.00';

        return {
          id: log.id,
          guardian_name: guardianName,
          guardian_first_name: student?.guardian_first_name || '',
          guardian_middle_name: student?.guardian_middle_name || '',
          guardian_last_name: student?.guardian_last_name || '',
          phone_number: guardianPhone,
          formatted_phone: formattedPhone,
          message: log.message,
          student_lrn: student?.lrn || log.student_lrn,
          student_first_name: student?.first_name || '',
          student_last_name: student?.last_name || '',
          student_name: student ? `${student.first_name} ${student.last_name}` : 'Unknown Student',
          grade: student?.grade?.grade_level || 'N/A',
          section: student?.section?.section_name || 'N/A',
          scan_type: log.scan_type || 'N/A',
          provider: log.provider || 'iprogsms',
          status: log.status || 'sent',
          cost: log.cost || '₱0.30',
          reason: log.reason || 'N/A',
          provider_id: log.provider_id,
          demo_mode: isDemo,
          date_time: formatDateTimeLocal(log.sent_at),
          raw_sent_at: log.sent_at,
          created_at: log.created_at,
          log_date: new Date(log.sent_at).toISOString().split('T')[0],
          _student: student
        };
      });

      console.log('📈 Transformed messages count:', transformedMessages.length);

      setMessages(transformedMessages);

    } catch (err) {
      setError(err.message);
      console.error('❌ Error fetching SMS logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSMSLogs('all', selectedDate);
  }, [selectedDate]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSection, currentClass, selectedDate]);

  const filteredMessages = useMemo(() => {
    let filtered = messages;

    if (currentClass !== 'all') {
      filtered = filtered.filter(message => message.grade === currentClass);
    }

    if (selectedSection) {
      filtered = filtered.filter(message => message.section === selectedSection);
    }

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(message => 
        message.guardian_name?.toLowerCase().includes(searchLower) ||
        message.guardian_first_name?.toLowerCase().includes(searchLower) ||
        message.guardian_last_name?.toLowerCase().includes(searchLower) ||
        message.student_name?.toLowerCase().includes(searchLower) ||
        message.student_first_name?.toLowerCase().includes(searchLower) ||
        message.student_last_name?.toLowerCase().includes(searchLower) ||
        message.student_lrn?.toLowerCase().includes(searchLower) ||
        message.message?.toLowerCase().includes(searchLower) ||
        message.grade?.toString().includes(searchLower) ||
        message.section?.toLowerCase().includes(searchLower) ||
        message.phone_number?.toLowerCase().includes(searchLower) ||
        message.formatted_phone?.toLowerCase().includes(searchLower)
      );
    }

    console.log('🔍 Filtered messages count:', filtered.length);
    return filtered;
  }, [messages, currentClass, selectedSection, searchTerm]);

  // PAGINATION
  const totalPages = Math.ceil(filteredMessages.length / ROWS_PER_PAGE);

  const paginatedMessages = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredMessages.slice(start, start + ROWS_PER_PAGE);
  }, [filteredMessages, currentPage]);

  const paginationContent = filteredMessages.length > 0 ? (
    <Pagination
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={setCurrentPage}
    />
  ) : null;

  const handleClassChange = (className) => {
    setCurrentClass(className);
    if (onSectionSelect) {
      onSectionSelect('');
    }
    if (onGradeUpdate) {
      onGradeUpdate(className);
    }
    setExpandedRowId(null);
  };

  const toggleRow = useCallback((messageId) => {
    setExpandedRowId((current) => (current === messageId ? null : messageId));
  }, []);

  const handleSectionFilter = (section) => {
    if (onSectionSelect) {
      onSectionSelect(section);
    }
    setExpandedRowId(null);
  };

  const getTableInfoMessage = () => {
    const messageCount = filteredMessages.length;

    if (selectedDate) {
      const dateObj = new Date(selectedDate + 'T00:00:00Z');
      const phDate = new Date(dateObj.getTime() + (8 * 60 * 60 * 1000));
      const formattedDate = phDate.toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      if (messageCount === 0) {
        return `No SMS messages found on ${formattedDate}`;
      }

      let message = `Showing ${messageCount} SMS message/s on ${formattedDate}`;

      if (currentClass !== 'all') {
        message += ` in Grade ${currentClass}`;
      }

      if (selectedSection) {
        message += `, Section ${selectedSection}`;
      }

      if (searchTerm.trim()) {
        message += ` matching "${searchTerm}"`;
      }

      return message;
    } else {
      const todayDisplay = getTodayDisplay();

      if (messageCount === 0) {
        return `No SMS messages sent today (${todayDisplay})`;
      }

      let message = `Showing ${messageCount} SMS message/s today (${todayDisplay})`;

      if (currentClass !== 'all') {
        message += ` in Grade ${currentClass}`;
      }

      if (selectedSection) {
        message += `, Section ${selectedSection}`;
      }

      if (searchTerm.trim()) {
        message += ` matching "${searchTerm}"`;
      }

      return message;
    }
  };

  const renderExpandedRow = useCallback((message) => {
    const isDemo = message.demo_mode;

    return (
      <div className={`${styles.messageCard} ${styles.expandableCard}`}>
        <div className={styles.messageHeader}>SMS Message Details</div>

        <div className={styles.details}>
          <div>
            <div className={styles.messageInfo}>
              <strong>Guardian Information</strong>
            </div>
            <div className={styles.messageInfo}>First Name: {message.guardian_first_name || 'N/A'}</div>
            <div className={styles.messageInfo}>Last Name: {message.guardian_last_name || 'N/A'}</div>
            <div className={styles.messageInfo}>Phone: {message.formatted_phone}</div>
          </div>

          <div>
            <div className={styles.messageInfo}>
              <strong>Student Information</strong>
            </div>
            <div className={styles.messageInfo}>First Name: {message.student_first_name || 'N/A'}</div>
            <div className={styles.messageInfo}>Last Name: {message.student_last_name || 'N/A'}</div>
            <div className={styles.messageInfo}>LRN: {message.student_lrn}</div>
            <div className={styles.messageInfo}>Grade & Section: {message.grade} - {message.section}</div>
          </div>

          <div>
            <div className={styles.messageInfo}>
              <strong>Message Details</strong>
            </div>
            <div className={styles.messageInfo}>Scan Type: {message.scan_type.toUpperCase()}</div>

            {isDemo && (
              <div className={styles.messageInfo}>
                <span className={styles.demoInfo}>DEMO MESSAGE - No actual SMS was sent</span>
              </div>
            )}

            {!isDemo && (
              <>
                <div className={styles.messageInfo}>Provider: {message.provider}</div>
                <div className={styles.messageInfo}>Cost: {message.cost}</div>
              </>
            )}

            {message.reason !== 'N/A' && !isDemo && (
              <div className={styles.messageInfo}>Reason: {message.reason}</div>
            )}
          </div>
        </div>

        <div className={styles.fullMessage}>
          <div className={styles.messageInfo}>
            <strong>Full Message:</strong>
          </div>
          <div className={styles.messageText}>{message.message}</div>
        </div>
      </div>
    );
  }, []);

  const withColumnWidth = useCallback((width, minWidth) => ({
    width,
    minWidth: `${minWidth}px`
  }), []);

  const tableColumns = useMemo(() => [
    {
      key: 'guardian_name',
      label: 'GUARDIAN',
      headerStyle: withColumnWidth('21%', 160),
      cellStyle: withColumnWidth('21%', 160),
      renderCell: ({ row }) => (
        <div className={styles.recipientCell}>
          <div>{row.guardian_name}</div>
          <small className={styles.subtext}>{row.formatted_phone}</small>
        </div>
      )
    },
    {
      key: 'student_name',
      label: 'STUDENT',
      headerStyle: withColumnWidth('21%', 160),
      cellStyle: withColumnWidth('21%', 160),
      renderCell: ({ row }) => (
        <div className={styles.studentCell}>
          <div>{row.student_name}</div>
          <small className={styles.subtext}>LRN: {row.student_lrn}</small>
        </div>
      )
    },
    {
      key: 'grade',
      label: 'GRADE',
      headerStyle: withColumnWidth('9%', 80),
      cellStyle: withColumnWidth('9%', 80),
      renderCell: ({ row }) => row.grade
    },
    {
      key: 'section',
      label: 'SECTION',
      headerStyle: withColumnWidth('11%', 90),
      cellStyle: withColumnWidth('11%', 90),
      renderHeader: () => (
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeaderRow}>
            <span>SECTION</span>
            <SectionDropdown
              availableSections={availableSectionsLocal}
              selectedValue={selectedSection}
              onSelect={handleSectionFilter}
            />
          </div>
        </div>
      ),
      renderCell: ({ row }) => row.section
    },
    {
      key: 'message',
      label: 'MESSAGE',
      headerStyle: withColumnWidth('24%', 220),
      cellStyle: withColumnWidth('24%', 220),
      renderCell: ({ row }) => {
        const truncatedMessage = row.message.length > 80 ? `${row.message.substring(0, 80)}...` : row.message;
        return <div className={styles.messageCell}>{truncatedMessage}</div>;
      }
    },
    {
      key: 'date_time',
      label: 'DATE & TIME',
      headerStyle: withColumnWidth('14%', 140),
      cellStyle: withColumnWidth('14%', 140),
      renderCell: ({ row }) => row.date_time
    }
  ], [availableSectionsLocal, handleSectionFilter, selectedSection, withColumnWidth]);

  const getVisibleRowClassName = useCallback(({ row }) => {
    return [
      styles.messageRow,
      expandedRowId === row.id ? styles.rowExpanded : ''
    ].filter(Boolean).join(' ');
  }, [expandedRowId]);

  return (
    <Table
      columns={tableColumns}
      rows={paginatedMessages}
      getRowId={(row) => row.id}
      loading={loading || parentLoading}
      error={error ? `Error: ${error}` : ''}
      emptyMessage={getTableInfoMessage()}
      gradeTabs={{
        options: ['7', '8', '9', '10'],
        currentValue: currentClass,
        onChange: handleClassChange,
        showAll: true,
        allLabel: 'All',
        renderLabel: (grade) => `Grade ${grade}`
      }}
      infoText=""
      tableLabel="Messages"
      onRowClick={({ rowId }) => toggleRow(rowId)}
      rowClassName={getVisibleRowClassName}
      expandedRowId={expandedRowId}
      renderExpandedRow={({ row }) => renderExpandedRow(row)}
      getExpandedRowClassName={() => styles.expandRow}
      className={styles.messageTableContainer}
      wrapperClassName={styles.tableWrapper}
      paginationContent={paginationContent}
    />
  );
};

export default MessageTable;