import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { deleteAdminMedia, getAdminMedia, updateAdminMedia, uploadAdminMedia } from "../../services/mediaService.js";

const LANGUAGES = ["en", "gu", "hi"];
const blankAlt = () => ({ en: "", gu: "", hi: "" });
const styles = `
.admin-media{max-width:1100px;min-height:70vh;margin:auto;padding:54px 22px 90px}
.admin-media h1{font:500 clamp(34px,5vw,48px)/1.1 var(--serif);color:#30252c}
.admin-media-intro,.admin-media-hint{color:#77716a;font-size:11px;line-height:1.8}
.admin-media-panel{margin:18px 0;padding:22px;border:1px solid #e4ddd1;background:#fffdfa}
.admin-media-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.admin-media-field{display:grid;gap:6px;color:#77716a;font-size:11px}
.admin-media-field input,.admin-media-field textarea{width:100%;min-height:40px;padding:9px 11px;border:1px solid #d8d0c4;background:white;color:#30252c;font:12px/1.6 var(--sans)}
.admin-media-field textarea{min-height:80px;resize:vertical}
.admin-media-item{display:grid;grid-template-columns:150px minmax(0,1fr);gap:18px;margin:14px 0;padding:16px;border:1px solid #e4ddd1;background:#fff}
.admin-media-thumb{width:150px;aspect-ratio:4/3;object-fit:cover;background:#f6f3ee}
.admin-media-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}
.admin-media-actions button{min-height:38px;padding:0 13px;border:1px solid #30252c;background:#30252c;color:white;cursor:pointer}
.admin-media-error{padding:12px;background:#f8ece8;color:#863d32;font-size:11px}
.admin-media-success{padding:12px;background:#eef5ed;color:#426c50;font-size:11px}
@media(max-width:700px){.admin-media-grid{grid-template-columns:1fr}.admin-media-item{grid-template-columns:1fr}.admin-media-thumb{width:100%;max-height:260px}}
`;

export default function AdminMediaLibraryPage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const [assets, setAssets] = useState([]);
  const [file, setFile] = useState(null);
  const [altText, setAltText] = useState(blankAlt);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    try { setAssets(await getAdminMedia()); }
    catch { setError(t.mediaLibraryError); }
  }
  useEffect(() => { if (user?.role === "admin") load(); }, [user?.id, user?.role]);

  if (loading) return <main className="admin-media"><p>{t.loadingAccount}</p></main>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") return <main className="admin-media"><h1>{t.adminOnly}</h1><Link to="/">{t.backHome}</Link></main>;

  function selectAsset(asset) {
    setSelectedId(asset.id);
    setAltText(asset.altText || blankAlt());
    setNotice("");
  }
  function resetUpload() { setFile(null); setAltText(blankAlt()); setSelectedId(""); setNotice(""); setError(""); }

  async function upload(event) {
    event.preventDefault();
    if (!file) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const asset = await uploadAdminMedia(file, altText);
      setAssets((current) => [asset, ...current]);
      setSelectedId(asset.id);
      setFile(null);
      setNotice(t.mediaLibraryUploaded);
    } catch {
      setError(t.mediaLibraryError);
    } finally { setBusy(false); }
  }

  async function saveMetadata(event) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const asset = assets.find((item) => item.id === selectedId);
      const updated = await updateAdminMedia(selectedId, { altText, published: !asset.published });
      setAssets((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice(t.mediaLibrarySaved);
    } catch {
      setError(t.mediaLibraryError);
    } finally { setBusy(false); }
  }

  async function removeAsset(asset) {
    if (!window.confirm(t.mediaLibraryDeleteConfirm)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await deleteAdminMedia(asset.id);
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      if (selectedId === asset.id) setSelectedId("");
      setNotice(t.mediaLibraryDeleted);
    } catch {
      setError(t.mediaLibraryError);
    } finally { setBusy(false); }
  }

  async function copyUrl(asset) {
    try { await navigator.clipboard.writeText(new URL(asset.url, window.location.origin).toString()); setNotice(t.mediaLibraryCopied); }
    catch { setError(t.mediaLibraryError); }
  }

  return (
    <main className="admin-media">
      <style>{styles}</style>
      <div className="eyebrow"><i />{t.adminPortal}</div>
      <h1>{t.mediaLibraryTitle}</h1>
      <p className="admin-media-intro">{t.mediaLibraryIntro}</p>
      <p><Link to="/admin">{t.adminDashboardTitle}</Link></p>
      {error && <p className="admin-media-error" role="alert">{error}</p>}
      {notice && <p className="admin-media-success" role="status">{notice}</p>}
      <section className="admin-media-panel">
        <h2>{t.mediaLibraryUpload}</h2>
        <p className="admin-media-hint">{t.mediaLibraryScanNotice}</p>
        <form onSubmit={upload}>
          <label className="admin-media-field">{t.mediaLibraryFile}<input type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
          <h3>{t.mediaLibraryAlt}</h3>
          <div className="admin-media-grid">{LANGUAGES.map((language) => <label className="admin-media-field" key={language}>{language.toUpperCase()}<textarea required maxLength={300} value={altText[language]} onChange={(event) => setAltText((current) => ({ ...current, [language]: event.target.value }))} /></label>)}</div>
          <div className="admin-media-actions"><button type="submit" disabled={busy || !file}>{busy ? t.savingChanges : t.mediaLibraryUpload}</button></div>
        </form>
      </section>
      <section className="admin-media-panel">
        <h2>{t.mediaLibraryAssets}</h2>
        {!assets.length && <p>{t.mediaLibraryEmpty}</p>}
        {assets.map((asset) => <article className="admin-media-item" key={asset.id}>
          {asset.published ? <img className="admin-media-thumb" src={asset.url} alt={asset.altText?.en || ""} /> : <div className="admin-media-thumb" aria-hidden="true" />}
          <div>
            <strong>{asset.fileName}</strong>
            <p className="admin-media-hint">{Math.ceil(asset.size / 1024)} KB · {asset.published ? t.mediaLibraryPublished : t.mediaLibraryDraft}</p>
            {selectedId === asset.id ? (
              <form onSubmit={saveMetadata}>
                <div className="admin-media-grid">{LANGUAGES.map((language) => <label className="admin-media-field" key={language}>{language.toUpperCase()}<textarea required maxLength={300} value={altText[language]} onChange={(event) => setAltText((current) => ({ ...current, [language]: event.target.value }))} /></label>)}</div>
                <div className="admin-media-actions">
                  <button type="submit" disabled={busy}>{asset.published ? t.mediaLibraryUnpublish : t.mediaLibraryPublish}</button>
                  <button type="button" disabled={busy} onClick={() => removeAsset(asset)}>{t.delete}</button>
                  <button type="button" disabled={busy} onClick={resetUpload}>{t.cancel}</button>
                </div>
                {asset.published && <p className="admin-media-hint">{t.mediaLibraryUrl}: <code>{asset.url}</code> <button type="button" onClick={() => copyUrl(asset)}>{t.mediaLibraryCopyUrl}</button></p>}
              </form>
            ) : <div className="admin-media-actions"><button type="button" onClick={() => selectAsset(asset)}>{t.edit}</button>{asset.published && <button type="button" onClick={() => copyUrl(asset)}>{t.mediaLibraryCopyUrl}</button>}</div>}
          </div>
        </article>)}
      </section>
    </main>
  );
}
