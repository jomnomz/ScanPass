import styles from './PhoneNumberInput.module.css';

const PH_PREFIX = '+63';

/**
 * Given whatever is currently stored (could be full E.164 "+639171234567",
 * a raw "09171234567", "9171234567", or empty/null), extract just the
 * 10-digit local part ("9171234567") to show after the locked "+63" prefix.
 */
function extractLocalDigits(value) {
  if (!value) return '';

  const raw = value.toString().trim();

  if (raw.startsWith('+63')) {
    return raw.slice(3).replace(/\D/g, '').slice(0, 10);
  }

  const digitsOnly = raw.replace(/\D/g, '');

  if (digitsOnly.startsWith('63') && digitsOnly.length >= 11) {
    return digitsOnly.slice(2).slice(0, 10);
  }

  if (digitsOnly.startsWith('09')) {
    return digitsOnly.slice(1).slice(0, 10);
  }

  return digitsOnly.slice(0, 10);
}

/**
 * Renders a phone input as: [+63] | [editable 10-digit local number]
 * The "+63" prefix is always shown and can never be deleted — it isn't
 * part of the editable input at all, it's a fixed label beside it.
 *
 * onChange is called with the FULL E.164 value ("+639171234567") once
 * at least one digit is entered, or "" when the field is cleared —
 * matching the empty-is-valid contract of validateAndFormatPhone().
 */
function PhoneNumberInput({ name, label, value, onChange, error, disabled, required = false }) {
  const localDigits = extractLocalDigits(value);

  const handleChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
    const fullValue = digitsOnly ? `${PH_PREFIX}${digitsOnly}` : '';
    onChange(name, fullValue);
  };

  return (
    <div className={styles.formGroup}>
      {label && (
        <label>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <div
        className={`${styles.phoneInputWrapper} ${error ? styles.inputError : ''} ${
          disabled ? styles.phoneInputDisabled : ''
        }`}
      >
        <span className={styles.phonePrefix}>{PH_PREFIX}</span>
        <span className={styles.phoneDivider}>|</span>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          name={name}
          value={localDigits}
          onChange={handleChange}
          placeholder="9XXXXXXXXX"
          disabled={disabled}
          className={styles.phoneInputField}
          maxLength={10}
        />
      </div>
      {error && <div className={styles.fieldError}>{error}</div>}
    </div>
  );
}

export default PhoneNumberInput;