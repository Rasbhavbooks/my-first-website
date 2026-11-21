import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLanguage } from "./useLanguage.js";
import { getCategories } from "../services/categoryService.js";

const CategoryContext = createContext(null);

export function CategoryProvider({ children }) {
  const { language, t } = useLanguage();
  const [categories, setCategories] = useState([{ key: "All", labels: {} }]);

  const refreshCategories = useCallback(async () => {
    const result = await getCategories();
    setCategories(result);
    return result;
  }, []);

  useEffect(() => { refreshCategories(); }, [refreshCategories]);

  const getCategoryLabel = useCallback((key) => {
    const category = categories.find((item) => item.key === key);
    return category?.labels?.[language] || t.categories[key] || key;
  }, [categories, language, t.categories]);

  const value = useMemo(() => ({ categories, refreshCategories, getCategoryLabel }), [categories, refreshCategories, getCategoryLabel]);
  return <CategoryContext.Provider value={value}>{children}</CategoryContext.Provider>;
}

export function useCategories() {
  const context = useContext(CategoryContext);
  if (!context) throw new Error("useCategories must be used within CategoryProvider.");
  return context;
}
