/* ============================================
   AARAA i18n – Language Configuration
   ============================================ */

window.AARAA_LANGS = [
  { code: 'en', label: 'English',   flag: '🇬🇧', dir: 'ltr', isDefault: true  },
  { code: 'hi', label: 'हिन्दी',     flag: '🇮🇳', dir: 'ltr', isDefault: false },
  { code: 'ta', label: 'தமிழ்',      flag: '🇮🇳', dir: 'ltr', isDefault: false },
  { code: 'te', label: 'తెలుగు',     flag: '🇮🇳', dir: 'ltr', isDefault: false },
  { code: 'kn', label: 'ಕನ್ನಡ',      flag: '🇮🇳', dir: 'ltr', isDefault: false },
  { code: 'ml', label: 'മലയാളം',    flag: '🇮🇳', dir: 'ltr', isDefault: false },
  { code: 'mr', label: 'मराठी',      flag: '🇮🇳', dir: 'ltr', isDefault: false }
];

window.AARAA_DEFAULT_LANG = 'en';

window.AARAA_LANG_MAP = {};
window.AARAA_LANGS.forEach(function (l) {
  window.AARAA_LANG_MAP[l.code] = l;
});
