import { useState } from "react";
import { Link, Navigate } from "react-router";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { changeReaderPassword, updateReaderProfile } from "../../services/authService.js";

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
.account-submit{min-height:43px;margin-top:3px;border:0;background:#30252c;color:#fff;font-size:10px;letter-spacing:.4px;cursor:pointer}
.account-submit:disabled{opacity:.6;cursor:wait}
.account-message{margin:0 0 18px;padding:12px 14px;font-size:11px;line-height:1.6;background:#edf3e9;color:#39513d}
.account-error{margin:0;padding:10px 12px;font-size:10px;background:#f8ece8;color:#863d32}
.account-back{display:inline-block;margin-top:24px;font-size:10px;color:#716b63;text-decoration:underline;text-underline-offset:3px}
.account-success{max-width:500px;margin:70px auto;padding:40px;border:1px solid var(--line);background:#fffdfa;text-align:center}
.account-success h1{font:500 36px var(--serif)}.account-success p{color:#77716a;font-size:12px;line-height:1.8}
@media(max-width:700px){.account-page{padding:45px 19px 70px}.account-grid{grid-template-columns:1fr}.account-panel{padding:22px}}
`;

export default function AccountPage() {
  const { t } = useLanguage();
  const { user, loading, refreshSession, signOut } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  if (loading) return <main className="account-page"><p>{t.loadingAccount}</p></main>;
  if (!user && !passwordChanged) return <Navigate to="/login" replace />;

  async function handleProfile(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    setBusy(true);
    try {
      await updateReaderProfile({ displayName });
      await refreshSession();
      setNotice(t.profileUpdated);
    } catch {
      setError(t.profileError);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setError("");
    setBusy(true);
    try { await signOut(); } catch { setError(t.profileError); } finally { setBusy(false); }
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
            <label className="account-field"><span>{t.displayName}</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={80} required /></label>
            <label className="account-field"><span>{t.emailAddress}</span><input value={user.email} readOnly /></label>
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
      <button className="account-submit" style={{ width: "min(100%, 260px)", marginTop: 18 }} type="button" disabled={busy} onClick={handleLogout}>{t.signOut}</button>
      <Link className="account-back" to="/">{t.backHome}</Link>
    </main>
  );
}
