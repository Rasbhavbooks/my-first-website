import { createContext, useEffect, useMemo, useState } from "react";
import { messages } from "../i18n/messages.js";

export const LanguageContext = createContext(null);

const supportedLanguages = ["en", "gu", "hi"];

function getInitialLanguage() {
  const saved = window.localStorage.getItem("rasbhav-language");
  return supportedLanguages.includes(saved) ? saved : "en";
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(getInitialLanguage);

  useEffect(() => {
    window.localStorage.setItem("rasbhav-language", language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: messages[language],
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
