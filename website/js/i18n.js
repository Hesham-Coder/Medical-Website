const LANG_KEY = "lang";

export function getLang() {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === "ar" ? "ar" : "en";
  } catch (e) {
    return "en";
  }
}

export function setLang(lang) {
  const next = lang === "ar" ? "ar" : "en";
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch (e) {}

  document.documentElement.setAttribute("lang", next);
  document.documentElement.setAttribute("dir", next === "ar" ? "rtl" : "ltr");
  document.documentElement.classList.toggle("lang-ar", next === "ar");
  document.documentElement.classList.toggle("lang-en", next !== "ar");

  window.dispatchEvent(new CustomEvent("app:lang-changed", { detail: { lang: next } }));
}

// Accept localized objects: { en: "...", ar: "..." }
export function i18n(value, fallback = "") {
  const lang = getLang();
  if (value == null) return fallback;
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    const v = value[lang] ?? value.en ?? value.ar;
    if (v == null) return fallback;
    return String(v);
  }
  return fallback;
}

