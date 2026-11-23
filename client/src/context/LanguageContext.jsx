import { createContext, useEffect, useMemo, useState } from "react";
import { messages } from "../i18n/messages.js";
import { useSiteContent } from "../hooks/useSiteContent.js";

export const LanguageContext = createContext(null);
const supported = ["en", "gu", "hi"];

function getSavedLanguage() {
  const saved = window.localStorage.getItem("rasbhav-language");
  return supported.includes(saved) ? saved : null;
}

export function LanguageProvider({ children }) {
  const { settings, loaded } = useSiteContent();
  const defaultLanguage = settings.platform?.defaultLanguage;
  const [language, setLanguageState] = useState(() => getSavedLanguage() || "en");
  const [hasSavedPreference, setHasSavedPreference] = useState(() => Boolean(getSavedLanguage()));

  useEffect(() => {
    if (!hasSavedPreference && loaded) {
      setLanguageState(supported.includes(defaultLanguage) ? defaultLanguage : "en");
    }
  }, [defaultLanguage, hasSavedPreference, loaded]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  function setLanguage(nextLanguage) {
    if (!supported.includes(nextLanguage)) return;
    window.localStorage.setItem("rasbhav-language", nextLanguage);
    setHasSavedPreference(true);
    setLanguageState(nextLanguage);
  }

  const value = useMemo(() => ({ language, setLanguage, t: messages[language] }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
