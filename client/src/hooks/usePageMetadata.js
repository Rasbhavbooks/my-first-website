import { useEffect } from "react";

function publicImageUrl(value) {
  if (!value || typeof window === "undefined") return "";
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol === "https:" || url.origin === window.location.origin) return url.href;
  } catch {
    return "";
  }
  return "";
}

export function usePageMetadata({ title = "", description = "", type = "website", imageUrl = "" }) {
  const pathname = typeof window === "undefined" ? "/" : window.location.pathname;
  useEffect(() => {
    const previousTitle = document.title;
    const canonical = new URL(pathname, window.location.origin).href;
    const image = publicImageUrl(imageUrl);
    const snapshots = [];

    function setMeta(attribute, key, value) {
      let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
      const created = !element;
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, key);
        document.head.appendChild(element);
      }
      snapshots.push({ element, created, previous: element.getAttribute("content") });
      element.setAttribute("content", value);
    }

    const canonicalLink = document.head.querySelector('link[rel="canonical"]');
    const createdCanonical = !canonicalLink;
    const link = canonicalLink || document.createElement("link");
    const previousCanonical = link.getAttribute("href");
    if (createdCanonical) {
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonical;

    if (title) document.title = title;
    setMeta("name", "description", description || "");
    setMeta("property", "og:title", title || previousTitle);
    setMeta("property", "og:description", description || "");
    setMeta("property", "og:type", type);
    setMeta("property", "og:url", canonical);
    setMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
    setMeta("name", "twitter:title", title || previousTitle);
    setMeta("name", "twitter:description", description || "");
    if (image) {
      setMeta("property", "og:image", image);
      setMeta("name", "twitter:image", image);
    }

    return () => {
      document.title = previousTitle;
      for (const item of snapshots.reverse()) {
        if (item.created) item.element.remove();
        else if (item.previous === null) item.element.removeAttribute("content");
        else item.element.setAttribute("content", item.previous);
      }
      if (createdCanonical) link.remove();
      else if (previousCanonical === null) link.removeAttribute("href");
      else link.setAttribute("href", previousCanonical);
    };
  }, [description, imageUrl, pathname, title, type]);
}
