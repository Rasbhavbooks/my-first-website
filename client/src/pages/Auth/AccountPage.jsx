import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { changeReaderPassword, downloadReaderAccountData, getReaderSessions, revokeReaderSession, updateReaderProfile } from "../../services/authService.js";
import FollowedAuthorsPanel from "../../components/account/FollowedAuthorsPanel.jsx";

const accountStyles = `
.account-page{max-width:900px;min-height:70vh;margin:auto;padding:65px 24px 90px}
.account-page h1{margin:14px 0 8px;font:500 clamp(36px,5vw,52px)/1.1 var(--serif)}
.account-intro{margin:0 0 30px;color:#77716a;font-size:12px;line-height:1.8}
.account-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.account-panel{padding:26px;border:1px solid var(--line);background:#fffdfa}
.account-panel h2{margin:0 0 19px;font:500 25px var(--serif)}
.account-form{display:grid;gap:14px}
.account-field{display:grid;gap:7px}.account-field span{font-size:10px;color:#5f584f}
.account-field input{width:100%;min-height:43px;padding:10px 12px;border:1px solid #d7cec0;background:#fff;font-size:12px}
.account-field input:focus{outline:2px solid #d6ae68;outline-offset:1px}
.account-field input[readonly]{background:#f4f1eb;color:#82796e}
.account-field textarea{width:100%;min-height:94px;resize:vertical;padding:10px 12px;border:1px solid #d7cec0;background:#fff;font:12px/1.6 var(--sans)}
.account-field textarea:focus{outline:2px solid #d6ae68;outline-offset:1px}
.account-photo-preview{width:96px;height:96px;margin:2px 0 4px;border:1px solid #ded7ce;border-radius:50%;object-fit:cover;background:#eee8de}
.account-photo-fallback{display:grid;place-items:center;color:#493944;font:500 32px var(--serif)}
.account-submit{min-height:43px;margin-top:3px;border:0;background:#30252c;color:#fff;font-size:10px;letter-spacing:.4px;cursor:pointer}
.account-submit:disabled{opacity:.6;cursor:wait}
.account-message{margin:0 0 18px;padding:12px 14px;font-size:11px;line-height:1.6;background:#edf3e9;color:#39513d}
.account-error{margin:0;padding:10px 12px;font-size:10px;background:#f8ece8;color:#863d32}
.account-back{display:inline-block;margin-top:24px;font-size:10px;color:#716b63;text-decoration:underline;text-underline-offset:3px}
.account-success{max-width:500px;margin:70px auto;padding:40px;border:1px solid var(--line);background:#fffdfa;text-align:center}
.account-success h1{font:500 36px var(--serif)}.account-success p{color:#77716a;font-size:12px;line-height:1.8}
.account-session-list{display:grid;gap:10px;margin:18px 0 0;padding:0;list-style:none}
.account-session-row{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px;border:1px solid var(--line);background:#fff}
.account-session-details{display:grid;gap:5px;min-width:0;font-size:11px;color:#77716a}
.account-session-details strong{color:#30252c;font-weight:600}
.account-session-details code{font-size:10px}
.account-session-current{color:#316342!important}
.account-session-revoke{min-height:36px;padding:0 12px;border:1px solid #d7cec0;background:#fff;color:#30252c;font-size:10px;cursor:pointer}
.account-session-revoke:disabled{opacity:.55;cursor:wait}
@media(max-width:500px){.account-session-row{align-items:flex-start;flex-direction:column}}
@media(max-width:700px){.account-page{padding:45px 19px 70px}.account-grid{grid-template-columns:1fr}.account-panel{padding:22px}}
`;

function formatSessionDate(value, language) {
  const locale = { en: "en-IN", gu: "gu-IN", hi: "hi-IN" }[language] || "en-IN";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function AccountPage() {
  const { t } = useLanguage();
  const { user, loading, refreshSession, signOut } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [hobbies, setHobbies] = useState(user?.hobbies?.join(", ") || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionsHasMore, setSessionsHasMore] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsBusyId, setSessionsBusyId] = useState("");
  const [sessionsError, setSessionsError] = useState("");

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName || "");
    setBio(user.bio || "");
    setHobbies(user.hobbies?.join(", ") || "");
    setAvatarUrl(user.avatarUrl || "");
  }, [user?.id, user?.displayName, user?.bio, user?.hobbies?.join(", "), user?.avatarUrl]);

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setSessions([]);
      setSessionsLoading(false);
      return () => { active = false; };
    }
    setSessionsLoading(true);
    getReaderSessions()
      .then((result) => {
        if (active) {
          setSessions(result.sessions || []);
          setSessionsHasMore(Boolean(result.hasMore));
          setSessionsError("");
        }
      })
      .catch(() => { if (active) setSessionsError(t.sessionsError); })
      .finally(() => { if (active) setSessionsLoading(false); });
    return () => { active = false; };
  }, [user?.id, t.sessionsError]);

  if (loading) return <main className="account-page"><p>{t.loadingAccount}</p></main>;
  if (!user && !passwordChanged) return <Navigate to="/reader/login" replace />;

  async function handleProfile(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    setBusy(true);
    try {
      await updateReaderProfile({
        displayName,
        bio,
        hobbies: hobbies.split(",").map((hobby) => hobby.trim()).filter(Boolean),
        avatarUrl,
      });
      await refreshSession();
      setNotice(t.profileUpdated);
    } catch {
      setError(t.profileError);
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    setNotice("");
    setError("");
    setExportBusy(true);
    try {
      const blob = await downloadReaderAccountData();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "rasbhav-books-account-data.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(t.exportDataSuccess);
    } catch {
      setError(t.exportDataError);
    } finally {
      setExportBusy(false);
    }
  }

  async function handleLogout() {
    setError("");
    setBusy(true);
    try { await signOut(); } catch { setError(t.profileError); } finally { setBusy(false); }
  }

  async function handleSessionRevoke(session) {
    if (!window.confirm(t.sessionRevokeConfirm)) return;
    setSessionsBusyId(session.id);
    setSessionsError("");
    try {
      const result = await revokeReaderSession(session.id);
      if (result.current) {
        await refreshSession();
        return;
      }
      const updated = await getReaderSessions();
      setSessions(updated.sessions || []);
      setSessionsHasMore(Boolean(updated.hasMore));
      setNotice(t.sessionRevoked);
    } catch {
      setSessionsError(t.sessionsError);
    } finally {
      setSessionsBusyId("");
    }
  }

  async function handlePassword(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError(t.passwordsDoNotMatch);
      return;
    }
    setBusy(true);
    try {
      await changeReaderPassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      await signOut();
      setPasswordChanged(true);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (requestError) {
      if (requestError.code === "CURRENT_PASSWORD_INCORRECT") setError(t.currentPasswordIncorrect);
      else if (requestError.code === "INVALID_PASSWORD") setError(t.passwordHint);
      else setError(t.profileError);
    } finally {
      setBusy(false);
    }
  }

  if (passwordChanged) {
    return (
      <main className="account-page">
        <style>{accountStyles}</style>
        <section className="account-success">
          <h1>{t.passwordChanged}</h1>
          <p>{t.signInAgain}</p>
          <Link className="button button-dark" to="/login">{t.signIn}</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="account-page">
      <style>{accountStyles}</style>
      <div className="eyebrow"><i />{t.readerSpace}</div>
      <h1>{t.accountPage}</h1>
      <p className="account-intro">{t.accountIntro}</p>
      {notice && <p className="account-message" role="status">{notice}</p>}
      {error && <p className="account-error" role="alert">{error}</p>}
      <div className="account-grid">
        <section className="account-panel">
          <h2>{t.profileTitle}</h2>
          <form className="account-form" onSubmit={handleProfile}>
            {avatarUrl
              ? <img key={avatarUrl} className="account-photo-preview" src={avatarUrl} alt={t.profilePhoto} onError={(event) => { event.currentTarget.hidden = true; }} />
              : <div className="account-photo-preview account-photo-fallback" aria-label={t.profilePhoto}>{displayName.trim().charAt(0).toUpperCase()}</div>}
            <label className="account-field"><span>{t.profilePhotoUrl}</span><input type="url" inputMode="url" autoComplete="url" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} maxLength={500} placeholder="https://…" /></label>
            <label className="account-field"><span>{t.displayName}</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={80} required /></label>
            <label className="account-field"><span>{t.emailAddress}</span><input value={user.email} readOnly /></label>
            <label className="account-field"><span>{t.readerBio}</span><textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={280} rows={4} /></label>
            <label className="account-field"><span>{t.readerHobbies}</span><input value={hobbies} onChange={(event) => setHobbies(event.target.value)} maxLength={420} placeholder={t.hobbiesHint} /></label>
            <p className="password-hint">{t.hobbiesHint}</p>
            <button className="account-submit" disabled={busy}>{busy ? t.savingChanges : t.saveChanges}</button>
          </form>
        </section>
        <section className="account-panel">
          <h2>{t.changePassword}</h2>
          <form className="account-form" onSubmit={handlePassword}>
            <label className="account-field"><span>{t.currentPassword}</span><input type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} required maxLength={128} /></label>
            <label className="account-field"><span>{t.newPassword}</span><input type="password" autoComplete="new-password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} required minLength={12} maxLength={128} /></label>
            <label className="account-field"><span>{t.confirmNewPassword}</span><input type="password" autoComplete="new-password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} required minLength={12} maxLength={128} /></label>
            <button className="account-submit" disabled={busy}>{busy ? t.savingChanges : t.changePassword}</button>
          </form>
        </section>
      </div>
      <section className="account-panel" style={{ marginTop: 20 }}>
        <h2>{t.sessionsTitle}</h2>
        <p className="account-intro">{t.sessionsIntro}</p>
        {sessionsLoading && <p role="status">{t.sessionsLoading}</p>}
        {sessionsError && <p className="account-error" role="alert">{sessionsError}</p>}
        {!sessionsLoading && !sessionsError && sessions.length === 0 && <p>{t.sessionsEmpty}</p>}
        {!sessionsLoading && sessions.length > 0 && <ul className="account-session-list" aria-label={t.sessionsTitle}>
          {sessions.map((session) => (
            <li className="account-session-row" key={session.id}>
              <div className="account-session-details">
                <strong className={session.current ? "account-session-current" : ""}>{session.current ? t.currentSession : t.otherSession}</strong>
                <span>{t.sessionStarted}: {formatSessionDate(session.createdAt, language)}</span>
                <span>{t.sessionExpires}: {formatSessionDate(session.expiresAt, language)}</span>
              </div>
              <button className="account-session-revoke" type="button" disabled={Boolean(sessionsBusyId)} onClick={() => handleSessionRevoke(session)}>
                {sessionsBusyId === session.id ? t.sessionRevoking : t.revokeSession}
              </button>
            </li>
          ))}
        </ul>}
        {sessionsHasMore && <p className="password-hint">{t.sessionsMore}</p>}
      </section>
      <section className="account-panel" style={{ marginTop: 20 }}>
        <h2>{t.exportData}</h2>
        <p className="account-intro">{t.exportDataHint}</p>
        <button className="account-submit" style={{ width: "min(100%, 320px)" }} type="button" disabled={exportBusy} onClick={handleExport}>
          {exportBusy ? t.exportingData : t.exportData}
        </button>
      </section>
      <FollowedAuthorsPanel />
      <button className="account-submit" style={{ width: "min(100%, 260px)", marginTop: 18 }} type="button" disabled={busy} onClick={handleLogout}>{t.signOut}</button>
      <Link className="account-back" to="/">{t.backHome}</Link>
    </main>
  );
}
