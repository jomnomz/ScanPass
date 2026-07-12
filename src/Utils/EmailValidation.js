// Reasonable email shape: local@domain.tld
// Rejects consecutive dots, leading/trailing dots in local part, missing TLD.
const EMAIL_REGEX =
  /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;

const MAX_EMAIL_LENGTH = 255;

/**
 * Validates and normalizes an email address.
 * Mirrors the shape of validateAndFormatPhone(): { isValid, formatted, error }
 */
export const validateAndFormatEmail = (email) => {
  if (!email) {
    return {
      isValid: true, // Email is optional, so empty is valid
      formatted: null,
      error: null
    };
  }

  const trimmed = email.toString().trim();

  if (trimmed === '') {
    return {
      isValid: true,
      formatted: null,
      error: null
    };
  }

  const normalized = trimmed.toLowerCase();

  if (normalized.length > MAX_EMAIL_LENGTH) {
    return {
      isValid: false,
      formatted: null,
      error: `Email must be ${MAX_EMAIL_LENGTH} characters or fewer`
    };
  }

  if (!EMAIL_REGEX.test(normalized)) {
    return {
      isValid: false,
      formatted: null,
      error: 'Email address is invalid'
    };
  }

  return {
    isValid: true,
    formatted: normalized,
    error: null
  };
};

/**
 * Simple format for emails - just trims/lowercases without validation.
 * (Kept for symmetry with formatPhilippinePhone; prefer validateAndFormatEmail
 * where you also need to know if the input was valid.)
 */
export const formatEmail = (email) => {
  if (!email) return null;
  const trimmed = email.toString().trim();
  return trimmed === '' ? null : trimmed.toLowerCase();
};