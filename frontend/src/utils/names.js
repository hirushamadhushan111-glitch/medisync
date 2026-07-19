// Ensures a doctor's name carries exactly one "Dr." prefix.
// Safe for legacy names saved without the prefix and for names
// already saved as "Dr. …" / "dr …" (no double prefix).
export const withDrPrefix = (name) => {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '';
  return `Dr. ${trimmed.replace(/^dr\.\s*|^dr\s+/i, '')}`;
};
