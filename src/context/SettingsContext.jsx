import { createContext, useContext, useEffect, useState } from "react";

const SettingsContext = createContext(null);

const load = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};

export function SettingsProvider({ children }) {
  const [theme, setTheme] = useState(() => load("theme", "light"));
  const [lang, setLang] = useState(() => load("lang", "en"));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", JSON.stringify(theme));
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem("lang", JSON.stringify(lang));
  }, [lang]);

  return (
    <SettingsContext.Provider value={{ theme, setTheme, lang, setLang }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);