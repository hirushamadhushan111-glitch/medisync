/**
 * validators.js — server-side copy of the MediSync QA validation standard.
 *
 * The frontend validates first (frontend/src/utils/validators.js), but the
 * server must NEVER trust the browser — anyone can call the API directly
 * (e.g. with Postman). These helpers re-check the exact same rules so bad
 * data can never reach the database.
 *
 * QA standard (keep in sync with the frontend file):
 *  - Email    : must look like name@domain.tld
 *  - Password : at least 6 characters (any characters allowed)
 *  - Phone    : exactly 10 digits — no more, no less (e.g. 0712345678)
 *  - NIC      : Sri Lankan format — 12 digits (new) OR 9 digits + 'V' (old)
 */

// Required-field check: true when the value is non-empty after trimming.
const isFilled = (value) => String(value ?? '').trim().length > 0;

// Phone: exactly 10 digits (e.g. 0712345678). Letters, spaces, +94 etc. fail.
const isValidPhone = (value) => /^\d{10}$/.test(String(value || '').trim());

// Email: standard shape "something@domain.tld" with no spaces.
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

// Password: at least 6 characters. Spaces count — passwords are never trimmed.
const isValidPassword = (value) => String(value || '').length >= 6;

// Sri Lankan NIC: new format = exactly 12 digits,
// old format = exactly 9 digits ending with the letter V (upper or lower case).
const isValidNIC = (value) => {
  const v = String(value || '').trim();
  return /^\d{12}$/.test(v) || /^\d{9}[Vv]$/.test(v);
};

module.exports = { isFilled, isValidPhone, isValidEmail, isValidPassword, isValidNIC };
