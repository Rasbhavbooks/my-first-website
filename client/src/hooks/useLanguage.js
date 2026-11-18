import { useContext } from "react";
import { LanguageContext } from "../context/LanguageContext.jsx";

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be rendered inside LanguageProvider.");
  return value;
}
