/**
 * health.js — health-related helpers shared across patient/doctor views
 * (profile page, consultation form vitals panel).
 */

// BMI = weight(kg) / height(m)^2 — returns { value, label } or null when data is missing.
export const computeBmi = (weight, height) => {
  const w = Number(weight), h = Number(height);
  if (!w || !h) return null;
  const bmi = w / ((h / 100) ** 2);
  if (!isFinite(bmi) || bmi <= 0) return null;
  const label = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
  return { value: bmi.toFixed(1), label };
};
