// Student table configuration
export const studentTableColumns = [
  { key: 'lrn', label: 'LRN' },
  { key: 'first_name', label: 'FIRST NAME' },
  { key: 'last_name', label: 'LAST NAME' },
  { key: 'grade', label: 'GRADE' },
  { key: 'section', label: 'SECTION' },
  { key: 'email', label: 'EMAIL ADDRESS' },
  { key: 'phone_number', label: 'PHONE NO.' },
  { key: 'qr_code', label: 'QR CODE', isAction: true },
  { key: 'edit', label: 'EDIT', isAction: true },
  { key: 'delete', label: 'DELETE', isAction: true }
];

// Attendance table configuration
export const attendanceTableColumns = [
  { key: 'lrn', label: 'LRN' },
  { key: 'first_name', label: 'FIRST NAME' },
  { key: 'last_name', label: 'LAST NAME' },
  { key: 'grade_section', label: 'GRADE AND SECTION' },
  { key: 'time_in', label: 'TIME IN' },
  { key: 'time_out', label: 'TIME OUT' },
  { key: 'date', label: 'DATE' },
  { key: 'status', label: 'STATUS' }
];

// Shared row click handler for all tables
export const shouldHandleRowClick = (isEditing, target) => {
  // Prevent row click during editing or when clicking interactive elements
  return !isEditing && 
         !target.closest('.edit-input') && 
         !target.closest('.action-button') &&
         !target.closest('button') &&
         !target.closest('input') &&
         !target.closest('select');
};

// Status options for attendance
export const attendanceStatuses = ['present', 'absent'];

// Time format options
export const timeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true
};

// Date format options
export const dateFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
};

export const gradeSectionTableColumns = [
  { key: 'grade', label: 'GRADE' },
  { key: 'section', label: 'SECTION' },
  { key: 'room', label: 'ROOM' },
  { key: 'edit', label: 'EDIT', isAction: true },
  { key: 'delete', label: 'DELETE', isAction: true }
];
