import { useState } from "react";
import { Link } from "react-router";
import { useLanguage } from "../../hooks/useLanguage.js";
import { registerReader, verifyReaderEmail } from "../../services/authService.js";

export default function RegisterPage() {
  const { t } = useLanguage();
  const [form, setForm] = useState({ displayName: "", email: "", password: "", confirmPassword: "" });
  const [verificationToken, setVerificationToken] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
      setNotice(t.emailVerified);
    } catch {
      setError(t.registrationError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="eyebrow"><i />{t.readerSpace}</div>
        <h1>{t.registerTitle}</h1>
        <p className="auth-intro">{t.registerIntro}</p>

        {notice && <p className="auth-message success" role="status">{notice}</p>}
        {error && <p className="auth-message error" role="alert">{error}</p>}

        {verificationToken ? (
          <button className="button button-dark auth-submit" type="button" disabled={busy} onClick={handleVerify}>
            {busy ? t.verifyingEmail : t.verifyEmail}
          </button>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              <span>{t.displayName}</span>
              <input name="displayName" autoComplete="name" required minLength={2} maxLength={80} value={form.displayName} onChange={updateField} />
            </label>
            <label>
              <span>{t.emailAddress}</span>
              <input name="email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={updateField} />
            </label>
            <label>
              <span>{t.password}</span>
              <input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={form.password} onChange={updateField} />
            </label>
            <p className="password-hint">{t.passwordHint}</p>
            <label>
              <span>{t.confirmPassword}</span>
              <input name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={form.confirmPassword} onChange={updateField} />
            </label>
            <button className="button button-dark auth-submit" type="submit" disabled={busy}>
              {busy ? t.creatingAccount : t.createAccount}
            </button>
          </form>
        )}

        <Link className="auth-back-link" to="/">{t.backHome}</Link>
      </div>
    </main>
  );
}
