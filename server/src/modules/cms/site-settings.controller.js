import { defaultSiteContent } from "../../../../shared/site-content.js";
import { isDatabaseConnected } from "../../config/database.js";
import SiteSettings from "./site-settings.model.js";

const LANGUAGES = ["en", "gu", "hi"];
const HOME_SECTION_IDS = ["hero", "trust", "discovery", "languages", "authors", "community"];
const DEFAULT_SETTINGS = { key: "global", ...defaultSiteContent };

function errorResponse(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

function localizedGroup(value, maximum, allowEmpty = false) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const group = {};
  for (const language of LANGUAGES) {
    const text = value[language];
    if (typeof text !== "string" || text.trim().length > maximum || (!allowEmpty && !text.trim())) return null;
    group[language] = text.trim();
  }
  return group;
}

function validHref(value) {
  if (typeof value !== "string" || value.length > 300 || /[\\\\\u0000-\u001f\u007f]/.test(value)) return false;
  if (!value) return true;
  if (value.startsWith("#")) return /^#[A-Za-z0-9_-]+$/.test(value);
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  try {
    return new URL(value, "https://rasbhav.invalid").origin === "https://rasbhav.invalid";
  } catch {
    return false;
  }
}

function normalizeLinks(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) return null;
  const items = value.map((item) => {
    if (!item || typeof item.enabled !== "boolean" || !validHref(item.href) || !item.href) return null;
    const label = localizedGroup(item.label, 80);
    return label ? { enabled: item.enabled, href: item.href.trim(), label } : null;
  });
  return items.some((item) => item === null) ? null : items;
}

function normalizeHomeSections(value) {
  if (!Array.isArray(value) || value.length !== HOME_SECTION_IDS.length) return null;
  const sections = value.map((item) => {
    if (!item || !HOME_SECTION_IDS.includes(item.id) || typeof item.enabled !== "boolean") return null;
    return { id: item.id, enabled: item.enabled };
  });
  const ids = sections.filter(Boolean).map((item) => item.id);
  if (sections.some((item) => item === null)
    || new Set(ids).size !== HOME_SECTION_IDS.length
    || HOME_SECTION_IDS.some((id) => !ids.includes(id))
    || !sections.some((item) => item.id === "discovery" && item.enabled)) return null;
  return sections;
}
function normalizeSettings(body) {
  const announcement = body?.announcement;
  const hero = body?.homepage?.hero;
  const sections = normalizeHomeSections(body?.homepage?.sections);
  const navigation = normalizeLinks(body?.navigation);
  const tagline = localizedGroup(body?.footer?.tagline, 300);
  const browseLinks = normalizeLinks(body?.footer?.browseLinks);
  if (!announcement || typeof announcement.enabled !== "boolean" || !validHref(announcement.href)
    || !navigation || !tagline || !browseLinks || !sections) return null;
  const cleanAnnouncement = {
    enabled: announcement.enabled,
    text: localizedGroup(announcement.text, 300, true),
    linkLabel: localizedGroup(announcement.linkLabel, 80, true),
    href: announcement.href.trim(),
  };
  const cleanHero = {
    eyebrow: localizedGroup(hero?.eyebrow, 150),
    title: localizedGroup(hero?.title, 120),
    description: localizedGroup(hero?.description, 600),
    primaryCta: localizedGroup(hero?.primaryCta, 80),
    secondaryCta: localizedGroup(hero?.secondaryCta, 80),
  };
  if (Object.values(cleanAnnouncement).some((value) => value === null)
    || Object.values(cleanHero).some((value) => value === null)) return null;
  return {
    announcement: cleanAnnouncement,
    navigation,
    footer: { tagline, browseLinks },
    homepage: { hero: cleanHero, sections },
  };
}

function mergeDefaults(settings) {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    announcement: { ...DEFAULT_SETTINGS.announcement, ...settings?.announcement },
    navigation: Array.isArray(settings?.navigation) && settings.navigation.length
      ? settings.navigation
      : DEFAULT_SETTINGS.navigation,
    footer: {
      ...DEFAULT_SETTINGS.footer,
      ...settings?.footer,
      tagline: { ...DEFAULT_SETTINGS.footer.tagline, ...settings?.footer?.tagline },
      browseLinks: Array.isArray(settings?.footer?.browseLinks) && settings.footer.browseLinks.length
        ? settings.footer.browseLinks
        : DEFAULT_SETTINGS.footer.browseLinks,
    },
    homepage: {
      ...DEFAULT_SETTINGS.homepage,
      ...settings?.homepage,
      sections: normalizeHomeSections(settings?.homepage?.sections) || DEFAULT_SETTINGS.homepage.sections,
      hero: { ...DEFAULT_SETTINGS.homepage.hero, ...settings?.homepage?.hero },
    },
  };
}

export async function getPublicSiteContent(_request, response) {
  if (!isDatabaseConnected()) {
    const { announcement, navigation, footer, homepage } = mergeDefaults(null);
    return response.json({ data: { settings: { announcement, navigation, footer, homepage } } });
  }
  const settings = await SiteSettings.findOne({ key: "global" }).select("announcement navigation footer homepage -_id").lean();
  const { announcement, navigation, footer, homepage } = mergeDefaults(settings);
  response.setHeader("Cache-Control", "public, max-age=60");
  return response.json({ data: { settings: { announcement, navigation, footer, homepage } } });
}

export async function getAdminSiteContent(_request, response) {
  const settings = await SiteSettings.findOneAndUpdate(
    { key: "global" },
    { $setOnInsert: DEFAULT_SETTINGS },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { settings: mergeDefaults(settings) } });
}

export async function updateAdminSiteContent(request, response) {
  const normalized = normalizeSettings(request.body);
  if (!normalized) return errorResponse(response, 400, "INVALID_SITE_CONTENT", "Check the homepage sections, hero, navigation, footer and announcement content.");
  const settings = await SiteSettings.findOneAndUpdate(
    { key: "global" },
    { $set: { ...normalized, updatedBy: request.reader._id }, $setOnInsert: { key: "global" } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean();
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { settings: mergeDefaults(settings) } });
}
