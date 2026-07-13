// TeacherDataValidation.js
import { validateAndFormatPhone } from "./PhoneValidation.js";
import { validateAndFormatEmail } from "./EmailValidation.js";

/**
 * Validates AND normalizes a teacher record in a single pass.
 *
 * Previously, phone/email were validated but the FORMATTED value was never
 * written back onto teacherData — only the pass/fail result was used. That
 * meant phone_no was inserted into the DB in whatever raw format the user
 * typed (e.g. "09171234567" instead of "+639171234567"), and email_address
 * was never lowercased. This mirrors the same single-pass pattern used for
 * students: validate once, use the formatted value only if valid, keep the
 * raw value (for error traceability) if invalid.
 *
 * @param {object} cleanedTeacher - output of cleanTeacherData() (trimmed, nulls for empty optionals)
 * @returns {{ teacher: object, errors: object }}
 */
export const validateAndNormalizeTeacher = (cleanedTeacher) => {
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

  if (teacher.middle_name && teacher.middle_name.trim().length > 100) {
    errors.middle_name = 'Middle name must be 100 characters or less';
  }

  // ---- Email (validate once, use the formatted value only if valid) ----
  if (teacher.email_address) {
    const result = validateAndFormatEmail(teacher.email_address);
    if (result.isValid) {
      teacher.email_address = result.formatted;
    } else {
      errors.email_address = result.error;
      // leave teacher.email_address as the raw input so the error is traceable
    }
  }

  // ---- Phone number (validate once, use the formatted value only if valid) ----
  if (teacher.phone_no) {
    const result = validateAndFormatPhone(teacher.phone_no);
    if (result.isValid) {
      teacher.phone_no = result.formatted;
    } else {
      errors.phone_no = result.error;
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

  if (teacher.status && teacher.status.trim()) {
    const validStatuses = ['pending', 'active', 'inactive'];
    const statusLower = teacher.status.toLowerCase().trim();
    if (!validStatuses.includes(statusLower)) {
      errors.status = `Status must be one of: ${validStatuses.join(', ')}`;
    }
  }

  if (Object.keys(errors).length > 0) {
    console.log(`❌ Validation errors:`, errors);
  } else {
    console.log(`✅ Validation passed`);
  }

  return { teacher, errors };
};