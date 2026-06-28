// Helper functions for comparisons (formerly StudentSortHelpers.js)
export const extractLeadingNumber = (str) => {
  if (!str) return null;
  
  const match = str.match(/^\d+/);
  return match ? parseInt(match[0], 10) : null;
};

export const compareSections = (sectionA, sectionB) => {
  if (sectionA === sectionB) return 0;
  
  const numA = extractLeadingNumber(sectionA);
  const numB = extractLeadingNumber(sectionB);
  
  if (numA !== null && numB !== null) {
    if (numA !== numB) {
      return numA - numB;
    }

    return sectionA.localeCompare(sectionB);
  }
  
  if (numA !== null) return -1;
  if (numB !== null) return 1;
  
  return sectionA.localeCompare(sectionB);
};

export const compareNames = (nameA, nameB) => {
  const cleanA = (nameA || '').toLowerCase().trim();
  const cleanB = (nameB || '').toLowerCase().trim();
  return cleanA.localeCompare(cleanB);
};

export const compareGrades = (gradeA, gradeB) => {
  const numA = parseInt(gradeA) || 0;
  const numB = parseInt(gradeB) || 0;
  return numA - numB;
};

// Teacher sorting logic - needs assignments for grade data
const sortTeachersLogic = (a, b, teacherAssignments = {}) => {
  // Get lowest grade from assignments for teacher A
  const getLowestGrade = (teacher) => {
    const assignments = teacherAssignments[teacher.id] || {};
    
    // Try to get grade from sections
    const gradeLevels = (assignments.sections || [])
      .map(s => {
        // Handle both nested and flat structures
        const grade = s?.section?.grade?.grade_level || s?.grade?.grade_level || s?.grade_level;
        return parseInt(grade, 10);
      })
      .filter(g => !isNaN(g));
    
    // Debug: Log grade extraction
    if (gradeLevels.length === 0) {
      console.log(`🔍 No grade found in assignments for ${teacher.last_name}, sections:`, assignments.sections?.length);
    }
    
    // If no grades found in assignments, check teacher.grade field
    if (gradeLevels.length === 0 && teacher.grade) {
      const grades = String(teacher.grade).split('|')
        .map(g => parseInt(g.trim(), 10))
        .filter(g => !isNaN(g));
      if (grades.length > 0) {
        const lowest = Math.min(...grades);
        console.log(`🔍 Using teacher.grade for ${teacher.last_name}: ${lowest}`);
        return lowest;
      }
    }
    
    const lowest = gradeLevels.length > 0 ? Math.min(...gradeLevels) : Infinity;
    if (lowest === Infinity) {
      console.log(`🔍 No grade found for ${teacher.last_name}, using Infinity`);
    }
    return lowest;
  };

  const lowestGradeA = getLowestGrade(a);
  const lowestGradeB = getLowestGrade(b);

  // First sort by lowest grade (unassigned teachers go to the end)
  if (lowestGradeA !== lowestGradeB) {
    console.log(`📊 Sorting: ${a.last_name} (grade ${lowestGradeA}) vs ${b.last_name} (grade ${lowestGradeB}) -> ${lowestGradeA - lowestGradeB}`);
    return lowestGradeA - lowestGradeB;
  }

  // Then sort by last name
  const lastNameA = (a.last_name || '').toLowerCase().trim();
  const lastNameB = (b.last_name || '').toLowerCase().trim();
  const lastNameComparison = lastNameA.localeCompare(lastNameB);

  if (lastNameComparison !== 0) return lastNameComparison;

  // Then sort by first name
  const firstNameA = (a.first_name || '').toLowerCase().trim();
  const firstNameB = (b.first_name || '').toLowerCase().trim();
  return firstNameA.localeCompare(firstNameB);
};

// Export sortTeachers with assignments support
export const sortTeachers = (teachers, teacherAssignments = {}) => {
  if (!teachers || !Array.isArray(teachers)) return [];
  console.log(`🔍 sortTeachers called with ${teachers.length} teachers, ${Object.keys(teacherAssignments).length} assignments loaded`);
  return [...teachers].sort((a, b) => sortTeachersLogic(a, b, teacherAssignments));
};

// For backward compatibility - student sorting
export const sortStudents = (students) => {
  if (!students || !Array.isArray(students)) return [];
  
  return [...students].sort((a, b) => {
    const sectionA = (a.section || '').toString().trim();
    const sectionB = (b.section || '').toString().trim();
    
    const sectionComparison = compareSections(sectionA, sectionB);
    if (sectionComparison !== 0) {
      return sectionComparison;
    }
    
    const lastNameA = (a.last_name || '').toLowerCase().trim();
    const lastNameB = (b.last_name || '').toLowerCase().trim();
    
    return lastNameA.localeCompare(lastNameB);
  });
};