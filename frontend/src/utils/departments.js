/**
 * Standard departments found in Sri Lankan government hospitals.
 * The English label is stored in the database (Doctor.department /
 * Doctor.specialization); the key maps to i18n translations
 * (departments.<key> / specializations.<key>) for display.
 *
 * departmentLabel / specializationLabel use alias matching so legacy
 * free-text values ("Cardiology", "General Medicine") still translate
 * when the language is Sinhala.
 */

export const DEPARTMENTS = [
  {
    key: 'generalMedicine',
    en: 'General Medicine',
    specializations: [
      { key: 'generalPhysician', en: 'General Physician' },
      { key: 'internalMedicine', en: 'Internal Medicine' },
      { key: 'cardiology', en: 'Cardiology' },
      { key: 'diabetesEndocrine', en: 'Diabetes & Endocrinology' },
    ],
  },
  {
    key: 'surgery',
    en: 'General Surgery',
    specializations: [
      { key: 'generalSurgery', en: 'General Surgery' },
      { key: 'traumaSurgery', en: 'Trauma Surgery' },
      { key: 'urology', en: 'Urology' },
      { key: 'vascularSurgery', en: 'Vascular Surgery' },
    ],
  },
  {
    key: 'pediatrics',
    en: 'Pediatrics',
    specializations: [
      { key: 'generalPediatrics', en: 'General Pediatrics' },
      { key: 'neonatology', en: 'Neonatology' },
      { key: 'pediatricCardiology', en: 'Pediatric Cardiology' },
    ],
  },
  {
    key: 'obgyn',
    en: 'Obstetrics & Gynecology',
    specializations: [
      { key: 'obstetrics', en: 'Obstetrics' },
      { key: 'gynecology', en: 'Gynecology' },
      { key: 'familyPlanning', en: 'Family Planning' },
    ],
  },
  {
    key: 'ent',
    en: 'ENT',
    specializations: [
      { key: 'generalEnt', en: 'General ENT' },
      { key: 'headNeckSurgery', en: 'Head & Neck Surgery' },
      { key: 'audiology', en: 'Audiology' },
    ],
  },
  {
    key: 'eye',
    en: 'Ophthalmology (Eye)',
    specializations: [
      { key: 'generalOphthalmology', en: 'General Ophthalmology' },
      { key: 'cataractSurgery', en: 'Cataract Surgery' },
      { key: 'retina', en: 'Retina' },
    ],
  },
  {
    key: 'orthopedics',
    en: 'Orthopedics',
    specializations: [
      { key: 'traumaOrthopedics', en: 'Trauma Orthopedics' },
      { key: 'jointReplacement', en: 'Joint Replacement' },
      { key: 'spineSurgery', en: 'Spine Surgery' },
    ],
  },
  {
    key: 'dermatology',
    en: 'Dermatology (Skin)',
    specializations: [
      { key: 'generalDermatology', en: 'General Dermatology' },
      { key: 'pediatricDermatology', en: 'Pediatric Dermatology' },
      { key: 'allergyClinic', en: 'Allergy' },
    ],
  },
  {
    key: 'psychiatry',
    en: 'Psychiatry',
    specializations: [
      { key: 'generalPsychiatry', en: 'General Psychiatry' },
      { key: 'childPsychiatry', en: 'Child Psychiatry' },
      { key: 'addictionPsychiatry', en: 'Addiction Psychiatry' },
    ],
  },
  {
    key: 'dental',
    en: 'Dental',
    specializations: [
      { key: 'generalDental', en: 'General Dental' },
      { key: 'oralSurgery', en: 'Oral & Maxillofacial Surgery' },
      { key: 'orthodontics', en: 'Orthodontics' },
    ],
  },
];

// Lowercased, punctuation stripped → department key (covers legacy free-text values)
const DEPARTMENT_ALIASES = {
  generalmedicine: 'generalMedicine', medicine: 'generalMedicine', medical: 'generalMedicine',
  internalmedicine: 'generalMedicine', cardiology: 'generalMedicine',
  generalsurgery: 'surgery', surgery: 'surgery', surgical: 'surgery', urology: 'surgery',
  pediatrics: 'pediatrics', paediatrics: 'pediatrics', pediatric: 'pediatrics', children: 'pediatrics',
  obstetricsgynecology: 'obgyn', obstetricsandgynecology: 'obgyn', gynecology: 'obgyn',
  gynaecology: 'obgyn', obstetrics: 'obgyn', obgyn: 'obgyn',
  ent: 'ent', earnosethroat: 'ent',
  ophthalmology: 'eye', ophthalmologyeye: 'eye', eye: 'eye',
  orthopedics: 'orthopedics', orthopaedics: 'orthopedics', orthopedic: 'orthopedics',
  dermatology: 'dermatology', dermatologyskin: 'dermatology', skin: 'dermatology',
  psychiatry: 'psychiatry', mentalhealth: 'psychiatry',
  dental: 'dental', dentistry: 'dental',
};

const SPECIALIZATION_BY_NORMALIZED = DEPARTMENTS.reduce((map, dept) => {
  dept.specializations.forEach((spec) => {
    map[spec.en.toLowerCase().replace(/[^a-z]/g, '')] = spec.key;
  });
  return map;
}, {});

// Lowercase + strip punctuation for alias matching.
const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z]/g, '');

// Resolve a stored doctor department value to its department key,
// e.g. "Ophthalmology (Eye)" or legacy "Eye" → 'eye'. Null if unrecognised.
export const departmentKeyOf = (value) => DEPARTMENT_ALIASES[normalize(value)] || null;

// Which doctor department staffs each clinic type (clinicTypes.js keys).
// Used to filter the doctor dropdown when scheduling a clinic session.
const CLINIC_TYPE_TO_DEPARTMENT = {
  opd: 'generalMedicine',
  medical: 'generalMedicine',
  diabetic: 'generalMedicine',
  hypertension: 'generalMedicine',
  cardiology: 'generalMedicine',
  respiratory: 'generalMedicine',
  neurology: 'generalMedicine',
  antenatal: 'obgyn',
  gynecology: 'obgyn',
  familyPlanning: 'obgyn',
  wellBaby: 'pediatrics',
  pediatric: 'pediatrics',
  eye: 'eye',
  ent: 'ent',
  skin: 'dermatology',
  dental: 'dental',
  mentalHealth: 'psychiatry',
  orthopedic: 'orthopedics',
  surgical: 'surgery',
};

// Department key that staffs the given clinic-type key. Null when the
// clinic type is unknown (custom free-text clinics show all doctors).
export const departmentForClinicType = (clinicTypeKey) =>
  CLINIC_TYPE_TO_DEPARTMENT[clinicTypeKey] || null;

// Translate a stored department value; falls back to the raw value
// so unrecognised free-text departments still display.
export const departmentLabel = (value, t) => {
  const key = DEPARTMENT_ALIASES[normalize(value)];
  return key ? t(`departments.${key}`) : value;
};

// Translate a stored specialization value; falls back to the raw value.
export const specializationLabel = (value, t) => {
  const key = SPECIALIZATION_BY_NORMALIZED[normalize(value)];
  return key ? t(`specializations.${key}`) : value;
};
