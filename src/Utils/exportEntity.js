import * as XLSX from 'xlsx';

// ===== CLASS ATTENDANCE REPORT EXPORT (used by ClassAttendanceReportModal) =====
export function exportClassAttendanceReportToExcel({
  attendanceRows = [],
  selectedMonth,
  year,
  className
}) {
  if (!attendanceRows || attendanceRows.length === 0) {
    throw new Error('No attendance data to export');
  }

  // Parse className (e.g. "9-Quezon" or "9 Quezon")
  let grade = '', section = '';
  if (typeof className === 'string') {
    const match = className.match(/^(\d+)[-\s](.+)$/);
    if (match) {
      grade = match[1];
      section = match[2];
    }
  } else if (className && className.grade && className.section) {
    grade = className.grade;
    section = className.section;
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[selectedMonth] || '';
  const headerTitle = `${monthName} ${year} | Grade ${grade} - Section ${section}`;

  // Prepare worksheet data
  const headers = [
    'Student Name',
    'School Days',
    'Present',
    'Late',
    'Absent',
    'Attendance Rate'
  ];
  const rows = attendanceRows.map(row => [
    row.name,
    row.schoolDays,
    row.present,
    row.late,
    row.absent,
    row.attendanceRate
  ]);

  // Insert the custom header/title row at the top
  const worksheetData = [[headerTitle], headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }
  ];
  worksheet['!cols'] = headers.map((header, i) => ({ wch: Math.max(header.length + 2, 16) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Report');

  // Filename: April_2026_Grade9_Quezon.xlsx
  const safeSection = (section || '').replace(/\s+/g, '');
  const filename = `${monthName}_${year}_Grade${grade}_${safeSection}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

const STUDENT_HEADERS = [
  'LRN',
  'First Name',
  'Last Name',
  'Grade',
  'Section',
  'Email',
  'Phone Number',
  'Guardian First Name',
  'Guardian Last Name',
  'Guardian Phone Number',
  'Guardian Email',
];

const TEACHER_HEADERS = [
  'Employee ID',
  'First Name',
  'Last Name',
  'Email Address',
  'Phone Number',
  'Grade-Sections (Teaching)',
  'Adviser Grade-Section',
];

const ATTENDANCE_HEADERS = [
  'LRN',
  'First Name',
  'Last Name',
  'Grade',
  'Section',
  'Date',
  'Time In',
  'Time Out',
  'Status',
  'Scan Type',
];

const MASTER_DATA_HEADERS = {
  gradeSections: ['Grade', 'Section'],
  schedules: ['Grade', 'Class Start', 'Class End', 'Grace Period'],
};

const joinList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean).join(', ');
  }
  return value ?? '';
};

const autoSizeColumns = (headers, rows) => {
  return headers.map((header, index) => {
    const longestCell = rows.reduce((max, row) => {
      const value = String(row[index] ?? '');
      return Math.max(max, value.length);
    }, String(header).length);

    return { wch: Math.max(longestCell + 2, 16) };
  });
};

const createSheetFromRows = (headers, rows) => {
  const worksheetData = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  worksheet['!cols'] = autoSizeColumns(headers, rows);

  // Force LRN and phone columns to be text (for student export)
  const lrnCol = headers.findIndex(h => h.toLowerCase().includes('lrn'));
  const phoneCols = headers
    .map((h, idx) => (h.toLowerCase().includes('phone') ? idx : -1))
    .filter(idx => idx !== -1);

  // Start from row 2 (skip header)
  for (let r = 1; r < worksheetData.length; r++) {
    if (lrnCol !== -1) {
      const cellRef = XLSX.utils.encode_cell({ c: lrnCol, r });
      if (worksheet[cellRef]) worksheet[cellRef].t = 's';
    }
    for (const c of phoneCols) {
      const cellRef = XLSX.utils.encode_cell({ c, r });
      if (worksheet[cellRef]) worksheet[cellRef].t = 's';
    }
  }

  return worksheet;
};

const getDateSuffix = () => new Date().toISOString().slice(0, 10);

const exportStudentEntity = (students, filename) => {
  const rows = (students || []).map((student) => [
    student.lrn ?? '',
    student.first_name ?? '',
    student.last_name ?? '',
    student.grade ?? '',
    student.section ?? '',
    student.email ?? '',
    student.phone_number ?? '',
    student.guardian_first_name ?? '',
    student.guardian_last_name ?? '',
    student.guardian_phone_number ?? '',
    student.guardian_email ?? '',
  ]);

  const workbook = XLSX.utils.book_new();
  const worksheet = createSheetFromRows(STUDENT_HEADERS, rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
  XLSX.writeFile(workbook, `${filename}-${getDateSuffix()}.xlsx`);
};

const exportTeacherEntity = (teachers, filename) => {
  const rows = (teachers || []).map((teacher) => [
    teacher.employee_id ?? '',
    teacher.first_name ?? '',
    teacher.last_name ?? '',
    teacher.email_address ?? teacher.email ?? '',
    teacher.phone_no ?? teacher.phone_number ?? '',
    joinList(teacher.grade_sections_teaching),
    teacher.adviser_grade_section ?? '',
  ]);

  const workbook = XLSX.utils.book_new();
  const worksheet = createSheetFromRows(TEACHER_HEADERS, rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Teachers');
  XLSX.writeFile(workbook, `${filename}-${getDateSuffix()}.xlsx`);
};

const exportAttendanceEntity = (attendances, filename) => {
  const rows = (attendances || []).map((a) => [
    a.lrn ?? '',
    a.first_name ?? '',
    a.last_name ?? '',
    a.grade ?? '',
    a.section ?? '',
    a.date ?? '',
    a.time_in ?? '',
    a.time_out ?? '',
    a.status ?? '',
    a.scan_type ?? '',
  ]);

  const workbook = XLSX.utils.book_new();
  const worksheet = createSheetFromRows(ATTENDANCE_HEADERS, rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
  XLSX.writeFile(workbook, `${filename}-${getDateSuffix()}.xlsx`);
};

const exportMasterDataEntity = (data, filename) => {
  const workbook = XLSX.utils.book_new();

  const gradeSections = data?.gradeSections || [];
  const schedules = data?.schedules || [];

  const gradeSectionRows = gradeSections.map((item) => [
    item.grade ?? '',
    item.section ?? item.section_name ?? '',
  ]);
  const gradeSectionSheet = createSheetFromRows(MASTER_DATA_HEADERS.gradeSections, gradeSectionRows);
  XLSX.utils.book_append_sheet(workbook, gradeSectionSheet, 'Grade Sections');

  const scheduleRows = schedules.map((item) => [
    item.grade_level ?? item.grade ?? '',
    item.class_start ?? '',
    item.class_end ?? '',
    item.grace_period_minutes ?? item.grace_period ?? 15,
  ]);
  const scheduleSheet = createSheetFromRows(MASTER_DATA_HEADERS.schedules, scheduleRows);
  XLSX.utils.book_append_sheet(workbook, scheduleSheet, 'Grade Schedules');

  XLSX.writeFile(workbook, `${filename}-${getDateSuffix()}.xlsx`);
};

export function exportEntity({ entity, data = [], filename } = {}) {
  if (!entity) {
    throw new Error('Missing entity export type');
  }

  if (entity !== 'masterData' && (!Array.isArray(data) || data.length === 0)) {
    throw new Error('No data available to export');
  }

  if (entity === 'student') {
    exportStudentEntity(data, filename || 'student-export');
    return;
  }

  if (entity === 'teacher') {
    exportTeacherEntity(data, filename || 'teacher-export');
    return;
  }

  if (entity === 'attendance') {
    exportAttendanceEntity(data, filename || 'attendance-export');
    return;
  }

  if (entity === 'masterData') {
    const hasGradeSections = Array.isArray(data?.gradeSections) && data.gradeSections.length > 0;
    const hasSchedules = Array.isArray(data?.schedules) && data.schedules.length > 0;

    if (!hasGradeSections && !hasSchedules) {
      throw new Error('No master data available to export');
    }

    const baseFilename = filename || 'master-data-export';
    exportMasterDataEntity(data, baseFilename);
    return;
  }

  throw new Error('Unsupported entity export type');
}