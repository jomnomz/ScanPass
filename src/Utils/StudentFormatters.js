export const getStudentInitialData = (student) => ({
  lrn: student.lrn || '',
  first_name: student.first_name || '',
  last_name: student.last_name || '',
  grade: student.grade || '',
  section: student.section || '',
  email: student.email || '',
  phone_number: student.phone_number || ''
});