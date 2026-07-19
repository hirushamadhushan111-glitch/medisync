/**
 * Standard clinic types found in Sri Lankan government hospitals.
 * The English label is stored in the database (departmentType);
 * the key maps to i18n translations (clinicTypes.<key>) for display.
 *
 * clinicTypeLabel / clinicDisplayName use alias matching so legacy
 * free-text values ("Cardiology", "Dermatology Clinic", "General Medicine")
 * still translate when the language is Sinhala.
 */

// The system runs with four demo clinics. The alias map below still
// recognises legacy values so old data keeps translating correctly.
export const CLINIC_TYPES = [
  { key: 'opd',        en: 'General OPD' },
  { key: 'diabetic',   en: 'Diabetic Clinic' },
  { key: 'cardiology', en: 'Heart (Cardiology) Clinic' },
  { key: 'eye',        en: 'Eye Clinic' },
];

// Lowercased, "clinic"/punctuation stripped → type key
const ALIASES = {
  generalopd: 'opd', opd: 'opd', outpatient: 'opd',
  medical: 'medical', generalmedicine: 'medical',
  diabetic: 'diabetic', diabetes: 'diabetic',
  hypertension: 'hypertension', bloodpressure: 'hypertension',
  cardiology: 'cardiology', heart: 'cardiology', heartcardiology: 'cardiology', cardiac: 'cardiology',
  respiratory: 'respiratory', chest: 'respiratory', chestrespiratory: 'respiratory',
  antenatal: 'antenatal', maternity: 'antenatal',
  wellbaby: 'wellBaby',
  pediatric: 'pediatric', paediatric: 'pediatric', children: 'pediatric',
  eye: 'eye', ophthalmology: 'eye',
  ent: 'ent', earnosethroat: 'ent',
  skin: 'skin', dermatology: 'skin', skindermatology: 'skin',
  dental: 'dental',
  mentalhealth: 'mentalHealth', psychiatric: 'mentalHealth', psychiatry: 'mentalHealth',
  neurology: 'neurology', neuro: 'neurology',
  orthopedic: 'orthopedic', orthopaedic: 'orthopedic',
  gynecology: 'gynecology', gynaecology: 'gynecology',
  surgical: 'surgical', surgery: 'surgical',
  familyplanning: 'familyPlanning',
};

// 'Heart (Cardiology) Clinic' → 'heartcardiology' for alias lookup.
const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/clinic/g, '')
    .replace(/[^a-z]/g, '');

// Value → clinic-type key via the alias map (null if unknown).
const findTypeKey = (value) => {
  const normalized = normalize(value);
  return normalized ? ALIASES[normalized] || null : null;
};

// Resolve a stored departmentType (or clinic name) to its clinic-type key,
// e.g. "Eye Clinic" → 'eye'. Returns null for unrecognised free-text values.
export const clinicTypeKey = findTypeKey;

// Translate a stored departmentType value; falls back to the raw value
// so unrecognised free-text clinic types still display.
export const clinicTypeLabel = (value, t) => {
  const key = findTypeKey(value);
  return key ? t(`clinicTypes.${key}`) : value;
};

// Translate a clinic name for display (accepts a clinic object or a string).
// Names matching a known clinic type show in the active language.
export const clinicDisplayName = (clinicOrName, t) => {
  const name = typeof clinicOrName === 'string' ? clinicOrName : clinicOrName?.clinicName;
  if (!name) return '';
  const key = findTypeKey(name);
  return key ? t(`clinicTypes.${key}`) : name;
};
