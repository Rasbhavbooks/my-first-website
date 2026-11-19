import { useState } from "react";
import { Link } from "react-router";
import { useLanguage } from "../../hooks/useLanguage.js";
import { requestReaderPasswordReset, resetReaderPassword } from "../../services/authService.js";

const styles = `
.reset-shell{min-height:65vh;padding:60px 20px;display:grid;place-items:center;background:#f8f6f1}
.reset-card{width:min(100%,480px);padding:42px;background:#fffdfa;border:1px solid #e4ddd1;box-shadow:0 20px 60px #30252c12}
.reset-card h1{font:500 clamp(30px,5vw,42px)/1.15 var(--serif);color:#30252c}
.reset-card p{color:#77716a;font-size:12px;line-height:1.8}
.reset-form{display:grid;gap:14px}.reset-field{display:grid;gap:7px;font-size:11px;color:#514a44}
.reset-field input{height:45px;padding:0 12px;border:1px solid #d8d0c4;background:white}
.reset-submit{min-height:46px;border:0;background:#30252c;color:white;cursor:pointer}
.reset-submit:disabled{opacity:.6}.reset-error{padding:10px;background:#f8ece8;color:#863d32}
.reset-notice{padding:10px;background:#edf3e9;color:#39513d;overflow-wrap:anywhere}
.reset-back{display:block;margin-top:20px;text-align:center;color:#796747;font-size:11px;text-decoration:underline}
`;

export default function PasswordResetPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function requestReset(event) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await requestReaderPasswordReset(email);
      setNotice(t.resetRequested);
      if (result.resetToken) setToken(result.resetToken);
    } catch (err) {
      setError(err.code === "RESET_EMAIL_UNAVAILABLE" ? t.resetUnavailable : t.resetError);
    } finally { setBusy(false); }
  }

  async function confirmReset(event) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      await resetReaderPassword({ token, newPassword: password });
      setComplete(true); setPassword(""); setToken(""); setNotice(t.resetComplete);
    } catch {
      setError(t.resetError);
    } finally { setBusy(false); }
  }

  return (
    <main className="reset-shell">
      <style>{styles}</style>
      <section className="reset-card">
        <div className="eyebrow"><i />{t.readerSpace}</div>
        <h1>{complete ? t.resetCompleteTitle : t.resetTitle}</h1>
        <p>{complete ? t.resetComplete : t.resetIntro}</p>
        {notice && <p className="reset-notice" role="status">{notice}</p>}
        {error && <p className="reset-error" role="alert">{error}</p>}
        {!complete && !token && (
          <form className="reset-form" onSubmit={requestReset}>
            <label className="reset-field">{t.emailAddress}<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <button className="reset-submit" disabled={busy}>{busy ? t.savingChanges : t.requestReset}</button>
          </form>
        )}
        {!complete && token && (
          <form className="reset-form" onSubmit={confirmReset}>
            <label className="reset-field">{t.resetToken}<input value={token} onChange={(event) => setToken(event.target.value)} required minLength={32} maxLength={100} /></label>
            <p>{t.resetTokenHint}</p>
            <label className="reset-field">{t.newPassword}<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <p>{t.passwordHint}</p>
            <button className="reset-submit" disabled={busy}>{busy ? t.savingChanges : t.resetPassword}</button>
          </form>
        )}
        <Link className="reset-back" to="/login">{t.backToSignIn}</Link>
      </section>
    </main>
  );
}
