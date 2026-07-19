/**
 * Prescription helper data for the consultation form.
 *
 * Medicine names follow the Sri Lanka National Essential Medicines List
 * (generic names used in government hospital clinics). Doctors can always
 * type a medicine that is not listed — these only power the suggestions.
 */

// Common OPD / general medicines (suggested for every clinic)
const COMMON = [
  'Paracetamol 500mg',
  'Ibuprofen 400mg',
  'Diclofenac Sodium 50mg',
  'Amoxicillin 500mg',
  'Amoxicillin + Clavulanic Acid 625mg',
  'Azithromycin 500mg',
  'Cetirizine 10mg',
  'Chlorpheniramine 4mg',
  'Loratadine 10mg',
  'Omeprazole 20mg',
  'Ranitidine 150mg',
  'Domperidone 10mg',
  'Metoclopramide 10mg',
  'Salbutamol 4mg',
  'Salbutamol Inhaler 100mcg',
  'Prednisolone 5mg',
  'Vitamin C 100mg',
  'Folic Acid 1mg',
  'Ferrous Sulphate 200mg',
  'ORS (Jeevani)',
  'Mebendazole 100mg',
  'Metronidazole 400mg',
  'Ciprofloxacin 500mg',
  'Cloxacillin 500mg',
  'Flucloxacillin 250mg',
];

// Extra suggestions per clinic type (keys from utils/clinicTypes.js)
const BY_CLINIC = {
  diabetic: [
    'Metformin 500mg',
    'Metformin 850mg',
    'Gliclazide 80mg',
    'Glibenclamide 5mg',
    'Sitagliptin 50mg',
    'Insulin (Soluble) 100IU/ml',
    'Insulin (Isophane/NPH) 100IU/ml',
    'Pioglitazone 15mg',
    'Atorvastatin 20mg',
    'Aspirin 75mg',
    'Losartan 50mg',
  ],
  cardiology: [
    'Aspirin 75mg',
    'Clopidogrel 75mg',
    'Atorvastatin 20mg',
    'Rosuvastatin 10mg',
    'Losartan 50mg',
    'Enalapril 5mg',
    'Amlodipine 5mg',
    'Atenolol 50mg',
    'Bisoprolol 2.5mg',
    'Carvedilol 6.25mg',
    'Furosemide 40mg',
    'Spironolactone 25mg',
    'Glyceryl Trinitrate (GTN) 0.5mg',
    'Isosorbide Mononitrate 20mg',
    'Warfarin 5mg',
    'Digoxin 0.25mg',
  ],
  eye: [
    'Chloramphenicol Eye Drops 0.5%',
    'Gentamicin Eye Drops 0.3%',
    'Timolol Eye Drops 0.5%',
    'Artificial Tears (Hypromellose 0.3%)',
    'Ciprofloxacin Eye Drops 0.3%',
    'Prednisolone Acetate Eye Drops 1%',
    'Tropicamide Eye Drops 1%',
    'Vitamin A 5000IU',
  ],
  opd: [],
};

// Suggestions for the current clinic: clinic-specific first, then common
export const medicineOptions = (clinicTypeKey) => {
  const specific = BY_CLINIC[clinicTypeKey] || [];
  return [...specific, ...COMMON.filter((m) => !specific.includes(m))];
};

// Tablet / capsule counts the way SL doctors write them (½, 1, 2 …)
export const DOSAGE_OPTIONS = [
  '1/2 tablet',
  '1 tablet',
  '1 1/2 tablets',
  '2 tablets',
  '3 tablets',
  '1 capsule',
  '2 capsules',
  '5 ml',
  '10 ml',
  '15 ml',
  '1 puff',
  '2 puffs',
  '1 drop',
  '2 drops',
];

// How SL prescriptions state frequency: time of day × before/after meals
// (mane = morning, bd = twice a day, tds = 3 times a day, nocte = night)
export const FREQUENCY_OPTIONS = [
  'උදේ පමණයි — කෑමට පෙර (mane, before meals)',
  'උදේ පමණයි — කෑමට පසු (mane, after meals)',
  'උදේ + රෑ — කෑමට පෙර (bd, before meals)',
  'උදේ + රෑ — කෑමට පසු (bd, after meals)',
  'උදේ + දවල් + රෑ — කෑමට පසු (tds, after meals)',
  'උදේ + දවල් + රෑ — කෑමට පෙර (tds, before meals)',
  'රෑ පමණයි — නින්දට පෙර (nocte)',
  'දවසට 4 වරක් (qds)',
  'අවශ්‍ය විටෙක පමණයි (PRN / when needed)',
];

// Common treatment lengths — combined with a frequency they make the
// full "duration" line, e.g. "උදේ + රෑ — කෑමට පසු · දින 5"
export const DURATION_DAYS = ['දින 3', 'දින 5', 'දින 7', 'දින 14', 'මාස 1', 'දිගටම (continuous)'];

// Full suggestion list for the duration field: plain frequencies plus the
// most common frequency × days combinations.
export const durationOptions = () => {
  const combos = [];
  for (const freq of FREQUENCY_OPTIONS.slice(0, 6)) {
    for (const days of DURATION_DAYS.slice(0, 4)) {
      combos.push(`${freq} · ${days}`);
    }
  }
  return [...FREQUENCY_OPTIONS, ...combos];
};
