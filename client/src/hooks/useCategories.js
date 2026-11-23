import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLanguage } from "./useLanguage.js";
import { getCategories } from "../services/categoryService.js";

const CategoryContext = createContext(null);

export function CategoryProvider({ children }) {
  const { language, t } = useLanguage();
  const [categories, setCategories] = useState([{ key: "All", labels: {} }]);
  const [loaded, setLoaded] = useState(false);

  const refreshCategories = useCallback(async () => {
    const result = await getCategories();
    setCategories(result);
    setLoaded(true);
    return result;
  }, []);

  useEffect(() => { refreshCategories(); }, [refreshCategories]);

  const getCategoryLabel = useCallback((key) => {
    if (key === "All") return t.all;
    const category = categories.find((item) => item.key === key);
    return category?.labels?.[language] || t.categories[key] || key;
  }, [categories, language, t.categories]);

  const value = useMemo(() => ({ categories, loaded, refreshCategories, getCategoryLabel }), [categories, loaded, refreshCategories, getCategoryLabel]);
  return createElement(CategoryContext.Provider, { value }, children);
}

export function useCategories() {
  const context = useContext(CategoryContext);
  if (!context) throw new Error("useCategories must be used within CategoryProvider.");
  return context;
}
