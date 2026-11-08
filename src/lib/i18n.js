// Pick the right language from { en, hi }, fall back to English
export const tx = (obj, lang) => (obj ? obj[lang] || obj.en || "" : "");