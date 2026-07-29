export const formatStudentName = (student) => {
  return `${student.first_name} ${student.last_name}`.trim();
};

export const formatStudentDisplayName = (student) => {
  return `${student.first_name} ${student.last_name}`.trim();
};

export const formatTeacherName = (teacher) => {
  return `${teacher.first_name} ${teacher.last_name}`.trim();
};

export const formatTeacherDisplayName = (teacher, includeTitle = false) => {
  const name = `${teacher.first_name} ${teacher.last_name}`.trim();
  return includeTitle ? `Teacher ${name}` : name;
};

export const formatGradeSection = (studentOrAttendance) => {
  // Handle attendance objects
  if (studentOrAttendance.grade_section) {
    return studentOrAttendance.grade_section;
  }
  
  // Handle student objects with new structure (objects)
  if (studentOrAttendance.grade && studentOrAttendance.section) {
    const grade = typeof studentOrAttendance.grade === 'object' 
      ? studentOrAttendance.grade.grade_level 
      : studentOrAttendance.grade;
    
    const section = typeof studentOrAttendance.section === 'object'
      ? studentOrAttendance.section.section_name
      : studentOrAttendance.section;
    
    if (grade && section) {
      return `Grade ${grade} - ${section}`;
    } else if (grade) {
      return `Grade ${grade}`;
    } else if (section) {
      return section;
    }
  }
  
  return "NA";
};

export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString();
};

export const formatNA = (value) => {
  return value || "NA";
};

export const formatTime = (timeString) => {
  if (!timeString) return "—";
  try {
    return new Date(`1970-01-01T${timeString}`).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  } catch {
    return timeString;
  }
};

export const formatAttendanceStatus = (status) => {
  const statusMap = {
    present: 'Present',
    late: 'Late',
    absent: 'Absent'
  };
  return statusMap[status] || 'Unknown';
};

export const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    return date.toLocaleString('en-US', {
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

// Add new teacher-specific formatter
export const formatTeacherDetails = (teacher) => {
  return {
    employeeId: teacher.employee_id || 'NA',
    fullName: formatTeacherName(teacher),
    email: teacher.email_address || 'NA',
    phone: teacher.phone_no || 'NA'
  };
};