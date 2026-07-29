// TeacherDataValidation.js
import { validateAndFormatPhone } from "./PhoneValidation.js";
import { validateAndFormatEmail } from "./EmailValidation.js";

/**
 * Validates AND normalizes a teacher record in a single pass.
 *
 * @param {object} cleanedTeacher - output of cleanTeacherData() (trimmed, nulls for empty optionals)
 * @param {object} options - configuration options
 * @param {boolean} options.isFormContext - if true, shortens phone error messages for form UI
 * @returns {{ teacher: object, errors: object }}
 */
export const validateAndNormalizeTeacher = (cleanedTeacher, options = {}) => {
  const { isFormContext = false } = options;
  const errors = {};
  const teacher = { ...cleanedTeacher };

  console.log(`🔍 Validating teacher data:`, {
    employee_id: teacher.employee_id,
    first_name: teacher.first_name,
    last_name: teacher.last_name,
    grade_sections_teaching: teacher.grade_sections_teaching,
    adviser_grade_section: teacher.adviser_grade_section
  });

  if (!teacher.employee_id?.trim()) {
    errors.employee_id = 'Employee ID is required';
  } else if (!/^\d+$/.test(teacher.employee_id.trim())) {
    // Digits only — no letters, spaces, or symbols (e.g. dashes)
    errors.employee_id = 'Employee ID must contain numbers only';
  } else if (teacher.employee_id.trim().length > 50) {
    errors.employee_id = 'Employee ID must be 50 characters or less';
  }

  if (!teacher.first_name?.trim()) {
    errors.first_name = 'First name is required';
  } else if (teacher.first_name.trim().length > 100) {
    errors.first_name = 'First name must be 100 characters or less';
  }

  if (!teacher.last_name?.trim()) {
    errors.last_name = 'Last name is required';
  } else if (teacher.last_name.trim().length > 100) {
    errors.last_name = 'Last name must be 100 characters or less';
  }

  // ---- Email (validate once, use the formatted value only if valid) ----
  if (teacher.email_address) {
    const result = validateAndFormatEmail(teacher.email_address);
    if (result.isValid) {
      teacher.email_address = result.formatted;
    } else {
      errors.email_address = result.error;
    }
  }

  // ---- Phone number (validate once, use the formatted value only if valid) ----
  if (teacher.phone_no) {
    const result = validateAndFormatPhone(teacher.phone_no);
    if (result.isValid) {
      teacher.phone_no = result.formatted;
    } else {
      // Form context gets shortened message; bulk upload gets full detail
      errors.phone_no = isFormContext
        ? 'Phone number is invalid'
        : result.error;
    }
  }

  if (teacher.grade_sections_teaching && teacher.grade_sections_teaching.trim()) {
    const gradeSections = teacher.grade_sections_teaching.split(',').map(s => s.trim()).filter(s => s);
    const invalidGradeSections = [];

    gradeSections.forEach(gs => {
      if (!gs.match(/^(\d+)\s*[-]?\s*(.+)$/)) {
        invalidGradeSections.push(gs);
      }
    });

    if (invalidGradeSections.length > 0) {
      errors.grade_sections_teaching = `Invalid grade-section format: ${invalidGradeSections.join(', ')}. Use formats like "7-1" or "7 - Section Name"`;
    }
  }

  if (teacher.adviser_grade_section && teacher.adviser_grade_section.trim()) {
    const adviserSections = teacher.adviser_grade_section
      .split(',')
      .map(section => section.trim())
      .filter(Boolean);

    if (adviserSections.length > 1) {
      errors.adviser_grade_section = 'There must only be one adviser section';
    } else if (!teacher.adviser_grade_section.match(/^(\d+)\s*[-]?\s*(.+)$/)) {
      errors.adviser_grade_section = 'Invalid adviser grade-section format. Use formats like "7-1" or "7 - Section Name"';
    }
  }

  if (Object.keys(errors).length > 0) {
    console.log(`❌ Validation errors:`, errors);
  } else {
    console.log(`✅ Validation passed`);
  }

  return { teacher, errors };
};