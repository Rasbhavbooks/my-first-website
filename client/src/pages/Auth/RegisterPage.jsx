import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useLanguage } from "../../hooks/useLanguage.js";
import { registerReader, resendReaderVerification, verifyReaderEmail } from "../../services/authService.js";

const pageStyles = `
.register-shell{min-height:calc(100vh - 82px);padding:64px 20px 80px;background:radial-gradient(ellipse at 10% 10%,#eee7da 0,transparent 38%),#f8f6f1;display:grid;place-items:center}
.register-layout{width:min(100%,980px);display:grid;grid-template-columns:1fr 1fr;background:#fffdfa;border:1px solid #e4ddd1;box-shadow:0 24px 70px #30252c12}
.register-story{padding:54px 48px;background:#30252c;color:#fff8ef;display:flex;flex-direction:column;justify-content:space-between;min-height:620px}
.register-brand{font:600 18px/1 var(--serif);letter-spacing:-.4px}.register-brand span{color:#d6ae68}
.register-story-copy{max-width:350px}.register-kicker{color:#dfbd7a;font-size:10px;letter-spacing:1.8px;text-transform:uppercase}
.register-story h2{font:500 clamp(36px,4vw,52px)/1.08 var(--serif);margin:17px 0}
.register-story p{color:#d4c9c3;font-size:13px;line-height:1.9}
.register-decoration{border-top:1px solid #ffffff30;padding-top:17px;color:#d9c9bc;font:italic 13px/1.7 var(--serif)}
.register-form-panel{padding:56px 58px;display:flex;flex-direction:column;justify-content:center}
.register-form-panel h1{margin:13px 0 8px;font:500 clamp(30px,3vw,40px)/1.15 var(--serif);color:#30252c}
.register-lead{margin:0 0 25px;color:#77716a;font-size:12px;line-height:1.8}
.register-form{display:grid;gap:16px}
.register-field{display:grid;gap:7px}.register-field>span{font-size:10px;letter-spacing:.35px;color:#514a44;font-weight:600}
.register-field input{width:100%;height:46px;border:1px solid #d8d0c4;background:#fff;padding:0 13px;color:#30252c;font-size:12px;outline:none;transition:border-color .18s,box-shadow .18s}
.register-field input:focus{border-color:#a8844b;box-shadow:0 0 0 3px #d6ae682b}
.register-password{position:relative}.register-password input{padding-right:82px}
.register-reveal{position:absolute;right:8px;top:50%;transform:translateY(-50%);border:0;background:transparent;padding:7px;color:#796747;font-size:10px;font-weight:600;cursor:pointer}
.register-reveal:hover{text-decoration:underline}.register-hint{margin:-9px 0 0;color:#82796e;font-size:10px;line-height:1.6}
.register-submit{width:100%;min-height:48px;margin-top:5px;border:0;background:#30252c;color:white;font-size:11px;font-weight:600;letter-spacing:.4px;cursor:pointer;transition:background .18s,transform .18s}
.register-submit:hover{background:#493944;transform:translateY(-1px)}.register-submit:disabled{opacity:.65;cursor:wait;transform:none}
.register-back{margin-top:21px;text-align:center;color:#716b63;font-size:10px;text-decoration:underline;text-underline-offset:3px}
.register-message{padding:12px 14px;margin:0 0 14px;font-size:11px;line-height:1.6}.register-message.success{background:#edf3e9;color:#39513d}.register-message.error{background:#f8ece8;color:#863d32}
@media(max-width:700px){.register-shell{min-height:70vh;padding:28px 16px 48px}.register-layout{max-width:500px;grid-template-columns:1fr}.register-story{min-height:auto;padding:25px 26px}.register-story-copy{margin:35px 0 15px}.register-story h2{font-size:34px}.register-decoration{display:none}.register-form-panel{padding:32px 25px 36px}}
`;

export default function RegisterPage() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ displayName: "", email: "", password: "", confirmPassword: "" });
  const [verificationToken, setVerificationToken] = useState("");
  const [verificationPending, setVerificationPending] = useState(false);
  const [resendMode, setResendMode] = useState(() => searchParams.get("resend") === "1");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setNotice("");
    setError("");

    if (form.password !== form.confirmPassword) {
      setError(t.passwordsDoNotMatch);
      return;
    }

    setBusy(true);
    try {
      const result = await registerReader({
        displayName: form.displayName,
        email: form.email,
        password: form.password,
      });
      setNotice(t.registrationSuccess);
      setVerificationToken(result.verificationToken || "");
      setVerificationPending(true);
      setForm((current) => ({ ...current, password: "", confirmPassword: "" }));
    } catch (requestError) {
      setError(requestError.code === "ACCOUNT_EXISTS" ? t.accountExists : t.registrationError);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    setBusy(true);
    setError("");
    try {
      await verifyReaderEmail(verificationToken);
      setVerificationToken("");
      setVerificationPending(false);
      setNotice(t.emailVerified);
    } catch {
      setError(t.registrationError);
    } finally {
      setBusy(false);
    }
  }

  async function handleResendVerification(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await resendReaderVerification(form.email);
      setVerificationToken(result.verificationToken || "");
      setNotice(result.verificationToken ? t.developmentVerificationToken : t.verificationEmailSent);
    } catch {
      setError(t.verificationEmailError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="register-shell">
      <style>{pageStyles}</style>
      <div className="register-layout">
        <aside className="register-story">
          <div className="register-brand">rasbhav<span>books</span></div>
          <div className="register-story-copy">
            <div className="register-kicker">{t.readerSpace}</div>
            <h2>{t.registerTitle}</h2>
            <p>{t.registerIntro}</p>
          </div>
          <div className="register-decoration">“A home for stories that stay with you.”</div>
        </aside>
        <section className="register-form-panel" aria-labelledby="register-heading">
          <div className="eyebrow"><i />{t.readerSpace}</div>
          <h1 id="register-heading">{t.registerTitle}</h1>
          <p className="register-lead">{t.registerIntro}</p>

          {notice && <p className="register-message success" role="status">{notice}</p>}
          {error && <p className="register-message error" role="alert">{error}</p>}

          {verificationToken ? (
            <button className="register-submit" type="button" disabled={busy} onClick={handleVerify}>
              {busy ? t.verifyingEmail : t.verifyEmail}
            </button>
          ) : verificationPending ? (
            <button className="register-submit" type="button" disabled={busy} onClick={() => setResendMode(true)}>
              {t.resendVerification}
            </button>
          ) : resendMode ? (
            <form className="register-form" onSubmit={handleResendVerification}>
              <label className="register-field">
                <span>{t.emailAddress}</span>
                <input name="email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={updateField} />
              </label>
              <button className="register-submit" type="submit" disabled={busy}>
                {busy ? t.savingChanges : t.resendVerification}
              </button>
              <button className="register-back" type="button" onClick={() => setResendMode(false)}>{t.backToRegister}</button>
            </form>
          ) : (
            <>
            <form className="register-form" onSubmit={handleSubmit}>
              <label className="register-field">
                <span>{t.displayName}</span>
                <input name="displayName" autoComplete="name" required minLength={2} maxLength={80} value={form.displayName} onChange={updateField} />
              </label>
              <label className="register-field">
                <span>{t.emailAddress}</span>
                <input name="email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={updateField} />
              </label>
              <label className="register-field">
                <span>{t.password}</span>
                <div className="register-password">
                  <input name="password" type={showPasswords ? "text" : "password"} autoComplete="new-password" required minLength={12} maxLength={128} value={form.password} onChange={updateField} />
                  <button className="register-reveal" type="button" aria-pressed={showPasswords} onClick={() => setShowPasswords((visible) => !visible)}>
                    {showPasswords ? t.hidePassword : t.showPassword}
                  </button>
                </div>
              </label>
              <p className="register-hint">{t.passwordHint}</p>
              <label className="register-field">
                <span>{t.confirmPassword}</span>
                <div className="register-password">
                  <input name="confirmPassword" type={showPasswords ? "text" : "password"} autoComplete="new-password" required minLength={12} maxLength={128} value={form.confirmPassword} onChange={updateField} />
                  <button className="register-reveal" type="button" aria-pressed={showPasswords} onClick={() => setShowPasswords((visible) => !visible)}>
                    {showPasswords ? t.hidePassword : t.showPassword}
                  </button>
                </div>
              </label>
              <button className="register-submit" type="submit" disabled={busy}>
                {busy ? t.creatingAccount : t.createAccount}
              </button>
            </form>
            <button className="register-back" type="button" onClick={() => setResendMode(true)}>{t.resendVerification}</button>
            </>
          )}

          <Link className="register-back" to="/">{t.backHome}</Link>
        </section>
      </div>
    </main>
  );
}
