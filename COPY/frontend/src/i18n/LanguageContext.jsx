import { createContext, useContext, useEffect, useState } from "react";
import { translations } from "./translations";

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(
    localStorage.getItem("crm_language") || "en"
  );

  useEffect(() => {
    localStorage.setItem("crm_language", language);
  }, [language]);

const t = (key, vars = {}) => {
  let value = translations[language]?.[key];

  if (!value) {
    console.warn(`❌ Missing translation: "${key}" (${language})`);
    return `⚠️ ${key}`;
  }

  // replace {{variables}}
  Object.keys(vars).forEach((k) => {
    value = value.replace(`{{${k}}}`, vars[k]);
  });

  return value;
};


  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}