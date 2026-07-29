// MasterDataValidation.js
export const validateGradeSectionData = (data) => {
  const errors = {};
  
  if (!data.grade?.trim()) errors.grade = 'Grade is required';
  if (!data.section?.trim()) errors.section = 'Section is required';
  if (!data.room?.trim()) errors.room = 'Room is required';
  
  if (data.grade && !/^\d+$/.test(data.grade.trim())) {
    errors.grade = 'Grade must be a number';
  }
  
  return errors;
};