/**
 * i18n/index.js — language setup (English + Sinhala).
 *
 * Every visible string in the app comes from en.json / si.json via the
 * t('key') function. The chosen language is remembered in localStorage
 * ('ms_lang'); English is the fallback when a key is missing in Sinhala.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import si from './si.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    si: { translation: si },
  },
  lng: localStorage.getItem('ms_lang') || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
