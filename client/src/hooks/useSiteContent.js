import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { defaultSiteContent } from "../../../shared/site-content.js";
import { getPublicSiteContent } from "../services/siteContentService.js";

const SiteContentContext = createContext(null);

export function SiteContentProvider({ children }) {
  const [settings, setSettings] = useState(defaultSiteContent);
  const [loaded, setLoaded] = useState(false);
  const refreshSiteContent = useCallback(async () => {
    const next = await getPublicSiteContent();
    setSettings(next);
    setLoaded(true);
    return next;
  }, []);
  useEffect(() => { refreshSiteContent(); }, [refreshSiteContent]);
  const value = useMemo(() => ({ settings, loaded, refreshSiteContent }), [settings, refreshSiteContent]);
  return createElement(SiteContentContext.Provider, { value }, children);
}

export function useSiteContent() {
  const value = useContext(SiteContentContext);
  if (!value) throw new Error("useSiteContent must be used within SiteContentProvider.");
  return value;
}
