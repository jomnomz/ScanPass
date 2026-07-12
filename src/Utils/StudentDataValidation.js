import { validateAndFormatPhone } from "./PhoneValidation.js";
import { validateAndFormatEmail } from "./EmailValidation.js";

/**
 * Validates AND normalizes a student record in a single pass.
 *
 * Why single-pass: previously, formatting (normalize-or-null) and validation
 * were two separate steps. When a phone/email was invalid, the formatter set
 * it to `null`, and the validator's `if (value) { ... }` check then silently
 * skipped it — an invalid value disappeared instead of failing validation.
 *
 * Here, each field is validated exactly once. The formatted value is only
 * ever used when it's valid; when invalid, the ORIGINAL raw value is kept on
 * the returned student object (for error display purposes) and an error is
 * recorded, so the row is guaranteed to be rejected downstream.
 *
 * @param {object} cleanedStudent - output of cleanStudentData() (trimmed, nulls for empty optionals)
 * @returns {{ student: object, errors: object }}
 */
export const validateAndNormalizeStudent = (cleanedStudent) => {
  const errors = {};
  const student = { ...cleanedStudent };

  // ---- Required fields ----
  if (!student.lrn?.trim()) errors.lrn = 'LRN is required';
  if (!student.first_name?.trim()) errors.first_name = 'First name is required';
  if (!student.last_name?.trim()) errors.last_name = 'Last name is required';
  if (!student.grade?.trim()) errors.grade = 'Grade is required';
  if (!student.section?.trim()) errors.section = 'Section is required';

  // guardian_first_name / guardian_last_name are NOT NULL in the DB schema,
  // so they must be required here too (previously only checked "if provided").
  if (!student.guardian_first_name?.trim()) {
    errors.guardian_first_name = 'Guardian first name is required';
  }
  if (!student.guardian_last_name?.trim()) {
    errors.guardian_last_name = 'Guardian last name is required';
  }

  // ---- Phone number (validate once, use the formatted value only if valid) ----
  if (student.phone_number) {
    const result = validateAndFormatPhone(student.phone_number);
    if (result.isValid) {
      student.phone_number = result.formatted;
    } else {
      errors.phone_number = result.error;
      // leave student.phone_number as the raw input so the error is traceable
    }
  }

  if (student.guardian_phone_number) {
    const result = validateAndFormatPhone(student.guardian_phone_number);
    if (result.isValid) {
      student.guardian_phone_number = result.formatted;
    } else {
      errors.guardian_phone_number = result.error;
    }
  }

  // ---- Email (validate once, use the formatted value only if valid) ----
  if (student.email) {
    const result = validateAndFormatEmail(student.email);
    if (result.isValid) {
      student.email = result.formatted;
    } else {
      errors.email = result.error;
    }
  }

  if (student.guardian_email) {
    const result = validateAndFormatEmail(student.guardian_email);
    if (result.isValid) {
      student.guardian_email = result.formatted;
    } else {
      errors.guardian_email = result.error;
    }
  }

  return { student, errors };
};