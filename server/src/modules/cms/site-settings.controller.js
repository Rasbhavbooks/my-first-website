import { defaultSiteContent } from "../../../../shared/site-content.js";
import { isDatabaseConnected } from "../../config/database.js";
import SiteSettings from "./site-settings.model.js";

const LANGUAGES = ["en", "gu", "hi"];
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
  if (typeof value !== "string" || value.length > 300) return false;
  if (!value) return true;
  return (value.startsWith("/") && !value.startsWith("//"))
    || /^#[A-Za-z0-9_-]*$/.test(value);
}

function normalizeSettings(body) {
  const announcement = body?.announcement;
  const hero = body?.homepage?.hero;
  if (!announcement || typeof announcement.enabled !== "boolean" || !validHref(announcement.href)) return null;
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
  return { announcement: cleanAnnouncement, homepage: { hero: cleanHero } };
}

export async function getPublicSiteContent(_request, response) {
  if (!isDatabaseConnected()) {
    return response.json({ data: { settings: DEFAULT_SETTINGS } });
  }
  const settings = await SiteSettings.findOne({ key: "global" }).select("announcement homepage -_id").lean();
  const publicSettings = settings || { announcement: DEFAULT_SETTINGS.announcement, homepage: DEFAULT_SETTINGS.homepage };
  response.setHeader("Cache-Control", "public, max-age=60");
  return response.json({ data: { settings: publicSettings } });
}

export async function getAdminSiteContent(_request, response) {
  const settings = await SiteSettings.findOneAndUpdate(
    { key: "global" },
    { $setOnInsert: DEFAULT_SETTINGS },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { settings } });
}

export async function updateAdminSiteContent(request, response) {
  const normalized = normalizeSettings(request.body);
  if (!normalized) return errorResponse(response, 400, "INVALID_SITE_CONTENT", "Check the hero translations and announcement content.");
  const settings = await SiteSettings.findOneAndUpdate(
    { key: "global" },
    { $set: { ...normalized, updatedBy: request.reader._id }, $setOnInsert: { key: "global" } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean();
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { settings } });
}
