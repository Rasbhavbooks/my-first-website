import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { defaultSiteContent } from "../../../../shared/site-content.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useSiteContent } from "../../hooks/useSiteContent.js";
import { useLanguage } from "../../hooks/useLanguage.js";
import { getAdminSiteContent, updateAdminSiteContent } from "../../services/siteContentService.js";

const LANGUAGES = ["en", "gu", "hi"];
const styles = `
.admin-site-settings{max-width:1050px;min-height:70vh;margin:auto;padding:54px 22px 90px}
.admin-site-settings h1{font:500 clamp(34px,5vw,48px)/1.1 var(--serif);color:#30252c}
.admin-site-intro,.admin-site-hint{color:#77716a;font-size:11px;line-height:1.8}
.admin-site-panel{margin:18px 0;padding:22px;border:1px solid #e4ddd1;background:#fffdfa}
.admin-site-panel h2{margin:0 0 14px;font:500 23px var(--serif);color:#30252c}
.admin-site-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.admin-site-field{display:grid;gap:6px;color:#77716a;font-size:11px}
.admin-site-field input,.admin-site-field textarea{width:100%;min-height:40px;padding:9px 11px;border:1px solid #d8d0c4;background:white;color:#30252c;font:12px/1.6 var(--sans)}
.admin-site-field textarea{min-height:115px;resize:vertical}
.admin-site-check{display:flex;align-items:center;gap:8px;margin:12px 0;color:#514a44;font-size:12px}
.admin-site-actions button{min-height:42px;padding:0 16px;border:1px solid #30252c;background:#30252c;color:white;cursor:pointer}
.admin-site-actions button:disabled{opacity:.5}
.admin-site-error{padding:12px;background:#f8ece8;color:#863d32;font-size:11px}
.admin-site-success{padding:12px;background:#eef5ed;color:#426c50;font-size:11px}
.admin-site-menu-item{margin:16px 0;padding:16px;border:1px solid #e4ddd1;background:#fff}
.admin-site-item-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.admin-site-item-actions button,.admin-site-add{min-height:36px;padding:0 12px;border:1px solid #d8d0c4;background:#f6f3ee;color:#30252c;cursor:pointer}
.admin-site-add{margin-top:12px}
@media(max-width:700px){.admin-site-grid{grid-template-columns:1fr}}
`;

export default function AdminSiteSettingsPage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const { refreshSiteContent } = useSiteContent();
  const [settings, setSettings] = useState(defaultSiteContent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setError("");
    try {
      const result = await getAdminSiteContent();
      setSettings(result.settings || defaultSiteContent);
    } catch {
      setError(t.siteSettingsError);
    }
  }

  useEffect(() => {
    if (user?.role === "admin") load();
  }, [user?.id, user?.role, t.siteSettingsError]);

  if (loading) return <main className="admin-site-settings"><p>{t.loadingAccount}</p></main>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") return <main className="admin-site-settings"><h1>{t.adminOnly}</h1><Link to="/">{t.backHome}</Link></main>;

  function change(group, field, language, value) {
    setSettings((current) => {
      if (group === "announcement" && field === "enabled") {
        return { ...current, announcement: { ...current.announcement, enabled: value } };
      }
      if (group === "announcement" && field === "href") {
        return { ...current, announcement: { ...current.announcement, href: value } };
      }
      return {
        ...current,
        [group]: {
          ...current[group],
          hero: {
            ...current[group].hero,
            [field]: { ...current[group].hero[field], [language]: value },
          },
        },
      };
    });
  }

  function updateNavigation(index, update) {
    setSettings((current) => ({
      ...current,
      navigation: current.navigation.map((item, itemIndex) => itemIndex === index ? update(item) : item),
    }));
  }

  function moveNavigation(index, offset) {
    setSettings((current) => {
      const navigation = [...current.navigation];
      const destination = index + offset;
      if (destination < 0 || destination >= navigation.length) return current;
      [navigation[index], navigation[destination]] = [navigation[destination], navigation[index]];
      return { ...current, navigation };
    });
  }

  function updateFooterLink(index, update) {
    setSettings((current) => ({
      ...current,
      footer: {
        ...current.footer,
        browseLinks: current.footer.browseLinks.map((item, itemIndex) => itemIndex === index ? update(item) : item),
      },
    }));
  }

  function moveFooterLink(index, offset) {
    setSettings((current) => {
      const browseLinks = [...current.footer.browseLinks];
      const destination = index + offset;
      if (destination < 0 || destination >= browseLinks.length) return current;
      [browseLinks[index], browseLinks[destination]] = [browseLinks[destination], browseLinks[index]];
      return { ...current, footer: { ...current.footer, browseLinks } };
    });
  }

  function addNavigationItem() {
    setSettings((current) => ({
      ...current,
      navigation: [...current.navigation, {
        enabled: true,
        href: "/",
        label: { en: "New link", gu: "નવી લિંક", hi: "नई कड़ी" },
      }],
    }));
  }

  function removeNavigationItem(index) {
    setSettings((current) => ({
      ...current,
      navigation: current.navigation.filter((_item, itemIndex) => itemIndex !== index),
    }));
  }

  async function save() {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await updateAdminSiteContent(settings);
      setSettings(result.settings);
      await refreshSiteContent();
      setNotice(t.siteSettingsSaved);
    } catch {
      setError(t.siteSettingsError);
    } finally {
      setBusy(false);
    }
  }

  function localizedFields(value, onChange, multiline = false, maxLength = 600) {
    return <div className="admin-site-grid">{LANGUAGES.map((language) => <label className="admin-site-field" key={language}>{language.toUpperCase()}
      {multiline
        ? <textarea maxLength={maxLength} value={value[language] || ""} onChange={(event) => onChange(language, event.target.value)} />
        : <input maxLength={maxLength} value={value[language] || ""} onChange={(event) => onChange(language, event.target.value)} />}
    </label>)}</div>;
  }

  return (
    <main className="admin-site-settings">
      <style>{styles}</style>
      <div className="eyebrow"><i />{t.adminPortal}</div>
      <h1>{t.siteSettingsTitle}</h1>
      <p className="admin-site-intro">{t.siteSettingsIntro}</p>
      <p><Link to="/admin">{t.adminDashboardTitle}</Link></p>
      {error && <p className="admin-site-error" role="alert">{error}</p>}
      {notice && <p className="admin-site-success" role="status">{notice}</p>}
      <section className="admin-site-panel">
        <h2>{t.siteAnnouncement}</h2>
        <label className="admin-site-check"><input type="checkbox" checked={settings.announcement.enabled} onChange={(event) => change("announcement", "enabled", "", event.target.checked)} />{t.siteAnnouncementEnabled}</label>
        {localizedFields(settings.announcement.text, (language, value) => setSettings((current) => ({ ...current, announcement: { ...current.announcement, text: { ...current.announcement.text, [language]: value } } })), false, 300)}
        <p className="admin-site-hint">{t.siteAnnouncementLink}</p>
        {localizedFields(settings.announcement.linkLabel, (language, value) => setSettings((current) => ({ ...current, announcement: { ...current.announcement, linkLabel: { ...current.announcement.linkLabel, [language]: value } } })), false, 80)}
        <label className="admin-site-field">{t.siteAnnouncementHref}<input maxLength={300} placeholder="/pages/about or #discover" value={settings.announcement.href} onChange={(event) => change("announcement", "href", "", event.target.value)} /></label>
        <p className="admin-site-hint">{t.siteAnnouncementHrefHint}</p>
      </section>
      <section className="admin-site-panel">
        <h2>{t.navigationMenu}</h2>
        <p className="admin-site-hint">{t.navigationMenuHint}</p>
        {settings.navigation.map((item, index) => <div className="admin-site-menu-item" key={index}>
          <h3>{t.navigationMenu} · {index + 1}</h3>
          <label className="admin-site-check"><input type="checkbox" checked={item.enabled} onChange={(event) => updateNavigation(index, (current) => ({ ...current, enabled: event.target.checked }))} />{t.navigationEnabled}</label>
          {localizedFields(item.label, (language, value) => updateNavigation(index, (current) => ({ ...current, label: { ...current.label, [language]: value } })), false, 80)}
          <label className="admin-site-field">{t.navigationDestination}<input maxLength={300} placeholder="/#discover or /pages/about" value={item.href} onChange={(event) => updateNavigation(index, (current) => ({ ...current, href: event.target.value }))} /></label>
          <div className="admin-site-item-actions">
            <button type="button" disabled={index === 0} onClick={() => moveNavigation(index, -1)}>{t.moveNavigationUp}</button>
            <button type="button" disabled={index === settings.navigation.length - 1} onClick={() => moveNavigation(index, 1)}>{t.moveNavigationDown}</button>
            {settings.navigation.length > 1 && <button type="button" onClick={() => removeNavigationItem(index)}>{t.removeNavigationItem}</button>}
          </div>
        </div>)}
        <button className="admin-site-add" type="button" disabled={settings.navigation.length >= 8} onClick={addNavigationItem}>{t.addNavigationItem}</button>
      </section>
      <section className="admin-site-panel">
        <h2>{t.footerSettings}</h2>
        <h3>{t.footerTagline}</h3>
        {localizedFields(settings.footer.tagline, (language, value) => setSettings((current) => ({ ...current, footer: { ...current.footer, tagline: { ...current.footer.tagline, [language]: value } } })), false, 300)}
        <h3>{t.footerBrowseLinks}</h3>
        <p className="admin-site-hint">{t.footerMenuHint}</p>
        {settings.footer.browseLinks.map((item, index) => <div className="admin-site-menu-item" key={index}>
          <h3>{t.footerBrowseLinks} · {index + 1}</h3>
          <label className="admin-site-check"><input type="checkbox" checked={item.enabled} onChange={(event) => updateFooterLink(index, (current) => ({ ...current, enabled: event.target.checked }))} />{t.navigationEnabled}</label>
          {localizedFields(item.label, (language, value) => updateFooterLink(index, (current) => ({ ...current, label: { ...current.label, [language]: value } })), false, 80)}
          <label className="admin-site-field">{t.navigationDestination}<input maxLength={300} placeholder="/#discover or /pages/about" value={item.href} onChange={(event) => updateFooterLink(index, (current) => ({ ...current, href: event.target.value }))} /></label>
          <div className="admin-site-item-actions">
            <button type="button" disabled={index === 0} onClick={() => moveFooterLink(index, -1)}>{t.moveNavigationUp}</button>
            <button type="button" disabled={index === settings.footer.browseLinks.length - 1} onClick={() => moveFooterLink(index, 1)}>{t.moveNavigationDown}</button>
            {settings.footer.browseLinks.length > 1 && <button type="button" onClick={() => setSettings((current) => ({ ...current, footer: { ...current.footer, browseLinks: current.footer.browseLinks.filter((_link, linkIndex) => linkIndex !== index) } }))}>{t.removeNavigationItem}</button>}
          </div>
        </div>)}
        <button className="admin-site-add" type="button" disabled={settings.footer.browseLinks.length >= 8} onClick={() => setSettings((current) => ({ ...current, footer: { ...current.footer, browseLinks: [...current.footer.browseLinks, { enabled: true, href: "/", label: { en: "New link", gu: "નવી લિંક", hi: "नई कड़ी" } }] } }))}>{t.addNavigationItem}</button>
      </section>
      <section className="admin-site-panel">
        <h2>{t.siteHomepageHero}</h2>
        {[
          ["eyebrow", t.siteHeroEyebrow, 150, false],
          ["title", t.siteHeroTitle, 120, false],
          ["description", t.siteHeroDescription, 600, true],
          ["primaryCta", t.siteHeroPrimaryCta, 80, false],
          ["secondaryCta", t.siteHeroSecondaryCta, 80, false],
        ].map(([field, label, limit, multiline]) => <div key={field} style={{ marginBottom: 15 }}><h3>{label}</h3>
          {localizedFields(settings.homepage.hero[field], (language, value) => change("homepage", field, language, value), multiline, limit)}
        </div>)}
      </section>
      <div className="admin-site-actions"><button type="button" disabled={busy} onClick={save}>{busy ? t.savingChanges : t.saveChanges}</button></div>
    </main>
  );
}
