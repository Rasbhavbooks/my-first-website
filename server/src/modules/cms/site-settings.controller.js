import { isValidAuthorUploadLimits } from "../../../../shared/author-upload-limits.js";
import { defaultSiteContent } from "../../../../shared/site-content.js";
import { isDatabaseConnected } from "../../config/database.js";
import SiteSettings from "./site-settings.model.js";
import Book from "../books/book.model.js";
import { invalidateMaintenanceModeCache } from "../../middleware/maintenanceMode.js";

const LANGUAGES = ["en", "gu", "hi"];
const HOME_SECTION_IDS = ["hero", "trust", "discovery", "featured", "languages", "authors", "community"];
const LEGACY_HOME_SECTION_IDS = ["hero", "trust", "discovery", "languages", "authors", "community"];
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
  if (!Array.isArray(value) || value.length < LEGACY_HOME_SECTION_IDS.length || value.length > HOME_SECTION_IDS.length + 4) return null;
  let input = value;
  if (!input.some((item) => item?.id === "featured")) {
    const existingBuiltIns = input.filter((item) => LEGACY_HOME_SECTION_IDS.includes(item?.id)).map((item) => item.id);
    if (LEGACY_HOME_SECTION_IDS.every((id) => existingBuiltIns.includes(id))) {
      const insertAt = Math.max(0, input.findIndex((item) => item?.id === "languages"));
      input = [...input.slice(0, insertAt), { id: "featured", enabled: false }, ...input.slice(insertAt)];
    }
  }
  const builtInIds = HOME_SECTION_IDS;
  if (input.length < builtInIds.length || input.length > builtInIds.length + 4) return null;
  const sections = input.map((item) => {
    if (!item || typeof item.id !== "string" || typeof item.enabled !== "boolean") return null;
    if (builtInIds.includes(item.id)) return { id: item.id, enabled: item.enabled };
    if (!/^custom-[a-z0-9-]{1,48}$/.test(item.id)) return null;
    const title = localizedGroup(item.title, 120);
    const description = localizedGroup(item.description, 500, true);
    const linkLabel = localizedGroup(item.linkLabel, 80, true);
    const imageUrl = item.imageUrl || "";
    const imageAlt = localizedGroup(item.imageAlt || { en: "", gu: "", hi: "" }, 300, true);
    const validImageUrl = imageUrl === "" || /^\/api\/v1\/media\/[a-f0-9]{24}$/i.test(imageUrl);
    if (!title || !description || !linkLabel || !imageAlt || !validHref(item.href || "") || typeof imageUrl !== "string" || !validImageUrl) return null;
    if (imageUrl && Object.values(imageAlt).some((text) => text.length < 2)) return null;
    if (Object.values(linkLabel).some((label) => label.trim()) && !item.href) return null;
    return { id: item.id, enabled: item.enabled, title, description, linkLabel, href: (item.href || "").trim(), imageUrl, imageAlt };
  });
  const builtIns = sections.filter((item) => item && builtInIds.includes(item.id)).map((item) => item.id);
  const ids = sections.filter(Boolean).map((item) => item.id);
  if (sections.some((item) => item === null) || new Set(ids).size !== ids.length
    || builtIns.length !== builtInIds.length || builtInIds.some((id) => !builtIns.includes(id))
    || !sections.some((item) => item?.id === "discovery" && item.enabled)) return null;
  return sections;
}
function normalizeSettings(body) {
  const platform = body?.platform;
  const uploads = body?.uploads;
  const maintenance = body?.maintenance;
  const announcement = body?.announcement;
  const hero = body?.homepage?.hero;
  const seo = body?.homepage?.seo;
  const sections = normalizeHomeSections(body?.homepage?.sections);
  const featuredBookIds = body?.homepage?.featuredBookIds;
  const validFeaturedBookIds = Array.isArray(featuredBookIds) && featuredBookIds.length <= 4
    && featuredBookIds.every((id) => typeof id === "string" && id.trim().length > 0 && id.trim().length <= 100)
    && new Set(featuredBookIds.map((id) => id.trim())).size === featuredBookIds.length
    ? featuredBookIds.map((id) => id.trim())
    : null;
  const navigation = normalizeLinks(body?.navigation);
  const tagline = localizedGroup(body?.footer?.tagline, 300);
  const browseLinks = normalizeLinks(body?.footer?.browseLinks);
  const communityTitle = localizedGroup(body?.footer?.communityTitle, 120);
  const communityLinks = normalizeLinks(body?.footer?.communityLinks);
  const siteName = typeof platform?.siteName === "string" ? platform.siteName.trim() : "";
  const supportEmail = typeof platform?.supportEmail === "string" ? platform.supportEmail.trim().toLowerCase() : "";
  const validSupportEmail = supportEmail.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail);
  if (!platform || !["en", "gu", "hi"].includes(platform.defaultLanguage)
    || siteName.length < 2 || siteName.length > 80 || !validSupportEmail
    || !isValidAuthorUploadLimits(uploads)
    || !maintenance || typeof maintenance.enabled !== "boolean"
    || !announcement || typeof announcement.enabled !== "boolean" || !validHref(announcement.href)
    || !navigation || !tagline || !browseLinks || !communityTitle || !communityLinks || !sections || !validFeaturedBookIds) return null;
  const cleanAnnouncement = {
    enabled: announcement.enabled,
    text: localizedGroup(announcement.text, 300, true),
    linkLabel: localizedGroup(announcement.linkLabel, 80, true),
    href: announcement.href.trim(),
  };
  const cleanMaintenance = {
    enabled: maintenance.enabled,
    message: localizedGroup(maintenance.message, 300),
  };
  const cleanSeo = {
    title: localizedGroup(seo?.title, 70),
    description: localizedGroup(seo?.description, 200),
  };
  const cleanHero = {
    eyebrow: localizedGroup(hero?.eyebrow, 150),
    title: localizedGroup(hero?.title, 120),
    description: localizedGroup(hero?.description, 600),
    primaryCta: localizedGroup(hero?.primaryCta, 80),
    secondaryCta: localizedGroup(hero?.secondaryCta, 80),
  };
  if (Object.values(cleanAnnouncement).some((value) => value === null)
    || Object.values(cleanMaintenance).some((value) => value === null)
    || Object.values(cleanSeo).some((value) => value === null)
    || Object.values(cleanHero).some((value) => value === null)) return null;
  return {
    platform: { defaultLanguage: platform.defaultLanguage, siteName, supportEmail },
    uploads: { coverMaxMb: uploads.coverMaxMb, manuscriptMaxMb: uploads.manuscriptMaxMb },
    maintenance: cleanMaintenance,
    announcement: cleanAnnouncement,
    navigation,
    footer: { tagline, browseLinks, communityTitle, communityLinks },
    homepage: { hero: cleanHero, seo: cleanSeo, sections, featuredBookIds: validFeaturedBookIds },
  };
}

function mergeDefaults(settings) {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    platform: { ...DEFAULT_SETTINGS.platform, ...settings?.platform },
    uploads: { ...DEFAULT_SETTINGS.uploads, ...settings?.uploads },
    maintenance: {
      ...DEFAULT_SETTINGS.maintenance,
      ...settings?.maintenance,
      message: { ...DEFAULT_SETTINGS.maintenance.message, ...settings?.maintenance?.message },
    },
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
      communityTitle: { ...DEFAULT_SETTINGS.footer.communityTitle, ...settings?.footer?.communityTitle },
      communityLinks: Array.isArray(settings?.footer?.communityLinks) && settings.footer.communityLinks.length
        ? settings.footer.communityLinks
        : DEFAULT_SETTINGS.footer.communityLinks,
    },
    homepage: {
      ...DEFAULT_SETTINGS.homepage,
      ...settings?.homepage,
      sections: normalizeHomeSections(settings?.homepage?.sections) || DEFAULT_SETTINGS.homepage.sections,
      featuredBookIds: Array.isArray(settings?.homepage?.featuredBookIds) && settings.homepage.featuredBookIds.length <= 4
        ? settings.homepage.featuredBookIds
        : DEFAULT_SETTINGS.homepage.featuredBookIds,
      seo: {
        ...DEFAULT_SETTINGS.homepage.seo,
        ...settings?.homepage?.seo,
        title: { ...DEFAULT_SETTINGS.homepage.seo.title, ...settings?.homepage?.seo?.title },
        description: { ...DEFAULT_SETTINGS.homepage.seo.description, ...settings?.homepage?.seo?.description },
      },
      hero: { ...DEFAULT_SETTINGS.homepage.hero, ...settings?.homepage?.hero },
    },
  };
}

export async function getPublicSiteContent(_request, response) {
  if (!isDatabaseConnected()) {
    const { platform, uploads, maintenance, announcement, navigation, footer, homepage } = mergeDefaults(null);
    return response.json({ data: { settings: { platform, uploads, maintenance, announcement, navigation, footer, homepage } } });
  }
  const settings = await SiteSettings.findOne({ key: "global" }).select("platform uploads maintenance announcement navigation footer homepage -_id").lean();
  const { platform, uploads, maintenance, announcement, navigation, footer, homepage } = mergeDefaults(settings);
  response.setHeader("Cache-Control", "public, max-age=60");
  return response.json({ data: { settings: { platform, uploads, maintenance, announcement, navigation, footer, homepage } } });
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
  const featuredIds = normalized.homepage.featuredBookIds;
  if (featuredIds.length) {
    const availableCount = await Book.countDocuments({ catalogueId: { $in: featuredIds } });
    if (availableCount !== featuredIds.length) {
      return errorResponse(response, 400, "INVALID_FEATURED_BOOKS", "Choose only books that are already in the public catalogue.");
    }
  }
  const settings = await SiteSettings.findOneAndUpdate(
    { key: "global" },
    { $set: { ...normalized, updatedBy: request.reader._id }, $setOnInsert: { key: "global" } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean();
  invalidateMaintenanceModeCache();
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { settings: mergeDefaults(settings) } });
}
