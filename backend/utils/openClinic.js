/**
 * General OPD is an "open" clinic — walk-in outpatient care for everyone.
 * Any patient may see and book its sessions without being registered to it,
 * unlike speciality clinics (diabetic/cardiology/eye) which stay
 * registration-only.
 */
const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z]/g, '');

// True when this clinic is the open-to-everyone General OPD.
const isOpenClinic = (clinic) => {
  const type = normalize(clinic?.departmentType);
  const name = normalize(clinic?.clinicName);
  return type.includes('opd') || type.includes('outpatient') || name.includes('opd');
};

module.exports = isOpenClinic;
