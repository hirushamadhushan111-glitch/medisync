/**
 * validators.js — shared form-validation rules (the MediSync QA standard).
 *
 * Every register/login form in the app imports its rules from this ONE file,
 * so all forms behave exactly the same way. The backend has a matching copy
 * (backend/utils/validators.js) that re-checks the same rules on the server,
 * so the API stays safe even if someone bypasses the browser form.
 *
 * QA standard:
 *  - Required : every field must be filled (no empty values)
 *  - Email    : must look like name@domain.tld
 *  - Password : at least 6 characters (any characters allowed)
 *  - Phone    : exactly 10 digits — no more, no less (e.g. 0712345678)
 *  - NIC      : Sri Lankan format — 12 digits (new) OR 9 digits + 'V' (old)
 *
 * If a rule ever changes, change it here AND in backend/utils/validators.js.
 */

// Required-field check: true when the value is non-empty after trimming.
export const isFilled = (value) => String(value ?? '').trim().length > 0;

// Phone: exactly 10 digits (e.g. 0712345678). Letters, spaces, +94 etc. fail.
export const isValidPhone = (value) => /^\d{10}$/.test(String(value || '').trim());

// Email: standard shape "something@domain.tld" with no spaces.
export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

// Password: at least 6 characters. Spaces count — passwords are never trimmed.
export const isValidPassword = (value) => String(value || '').length >= 6;

// Sri Lankan NIC: new format = exactly 12 digits,
// old format = exactly 9 digits ending with the letter V (upper or lower case).
export const isValidNIC = (value) => {
  const v = String(value || '').trim();
  return /^\d{12}$/.test(v) || /^\d{9}[Vv]$/.test(v);
};

/**
 * Validates the account fields shared by EVERY "create user" form
 * (Register Patient, Register Doctor, admin User Management).
 *
 * Reusable helper — call it once inside handleSubmit instead of repeating
 * the same four if-checks in every page.
 *
 * @param {object} form - form state containing email, password, phone, NIC
 * @param {function} t  - i18next translate function (for Sinhala/English messages)
 * @returns {string} the first translated error message, or '' when all rules pass
 */
export const getAccountFieldError = (form, t) => {
  if (!isValidEmail(form.email)) return t('validation.invalidEmail');
  if (!isValidPassword(form.password)) return t('validation.invalidPassword');
  if (!isValidPhone(form.phone)) return t('validation.invalidPhone');
  if (!isValidNIC(form.NIC)) return t('validation.invalidNic');
  return '';
};
