import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useAuth } from "../../context/AuthContext.jsx";

const loginStyles = `
.login-page{min-height:calc(100vh - 82px);padding:58px 20px;display:grid;place-items:center;background:radial-gradient(ellipse at 80% 15%,#eee7da 0,transparent 38%),#f8f6f1}
.login-card{width:min(100%,470px);padding:48px;background:#fffdfa;border:1px solid #e4ddd1;box-shadow:0 24px 70px #30252c12}
.login-eyebrow{display:flex;align-items:center;gap:9px;color:#927646;font-size:9px;letter-spacing:1.6px;text-transform:uppercase}.login-eyebrow i{width:20px;height:1px;background:#927646}
.login-card h1{margin:18px 0 9px;font:500 clamp(34px,5vw,48px)/1.1 var(--serif);color:#30252c}
.login-intro{margin:0 0 27px;color:#77716a;font-size:12px;line-height:1.8}
.login-form{display:grid;gap:17px}.login-field{display:grid;gap:7px}.login-field>span{font-size:10px;font-weight:600;color:#514a44}
.login-field input{width:100%;height:47px;padding:0 13px;border:1px solid #d8d0c4;background:white;color:#30252c;font-size:12px;outline:none}
.login-field input:focus{border-color:#a8844b;box-shadow:0 0 0 3px #d6ae682b}.login-password{position:relative}.login-password input{padding-right:75px}
.login-reveal{position:absolute;right:8px;top:50%;transform:translateY(-50%);border:0;background:transparent;padding:7px;color:#796747;font-size:10px;font-weight:600;cursor:pointer}
.login-submit{width:100%;min-height:48px;margin-top:6px;border:0;background:#30252c;color:white;font-size:11px;font-weight:600;letter-spacing:.4px;cursor:pointer}
.login-submit:hover{background:#493944}.login-submit:disabled{opacity:.65;cursor:wait}
.login-message{padding:12px 14px;margin:0 0 16px;font-size:11px;line-height:1.6}.login-message.error{background:#f8ece8;color:#863d32}
.login-foot{margin-top:24px;text-align:center;color:#716b63;font-size:11px}.login-foot a{color:#795f39;text-decoration:underline;text-underline-offset:3px}
.login-home{display:block;margin-top:21px;text-align:center;color:#716b63;font-size:10px;text-decoration:underline;text-underline-offset:3px}
.login-welcome{text-align:center;padding:16px 0}.login-welcome p{color:#77716a;font-size:12px;line-height:1.8}.login-welcome a{display:block;margin-top:15px;font-size:11px;text-decoration:underline}
@media(max-width:620px){.login-page{min-height:68vh;padding:35px 17px}.login-card{padding:32px 24px}}
`;

export default function LoginPage({ expectedRole = "reader" }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user, loading, signIn, signOut } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const signedInUser = await signIn(form);
      setForm((current) => ({ ...current, password: "" }));
      if (signedInUser.role !== expectedRole) {
        await signOut();
        setError(t.roleLoginMismatch);
        return;
      }
      navigate(expectedRole === "author" ? "/author/studio" : expectedRole === "admin" ? "/admin" : "/", { replace: true });
    } catch (requestError) {
      if (requestError.code === "EMAIL_NOT_VERIFIED") setError(t.verifyFirst);
      else setError(requestError.code === "INVALID_CREDENTIALS" ? t.loginError : t.registrationError);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    setError("");
    try {
      await signOut();
      setForm({ email: "", password: "" });
    } catch {
      setError(t.registrationError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <style>{loginStyles}</style>
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-eyebrow"><i />{expectedRole === "author" ? t.authorPortal : expectedRole === "admin" ? t.adminPortal : t.readerPortal}</div>
        <h1 id="login-title">{user ? t.welcomeBack : expectedRole === "author" ? t.authorLoginTitle : expectedRole === "admin" ? t.adminLoginTitle : t.loginTitle}</h1>
        <p className="login-intro">{expectedRole === "author" ? t.authorLoginIntro : expectedRole === "admin" ? t.adminLoginIntro : t.loginIntro}</p>
        {error && <p className="login-message error" role="alert">{error}</p>}
        {loading ? (
          <p className="login-intro" role="status">{t.loadingAccount}</p>
        ) : user ? (
          <div className="login-welcome">
            <p>{user.displayName}</p>
            <p>{user.email}</p>
            {user.role === expectedRole
              ? <Link to={expectedRole === "author" ? "/author/studio" : expectedRole === "admin" ? "/admin" : "/account"}>{expectedRole === "author" ? t.authorStudio : expectedRole === "admin" ? t.adminDashboardTitle : t.accountPage}</Link>
              : <><p className="login-message error">{t.roleLoginMismatch}</p><Link to="/login">{t.chooseLoginPortal}</Link></>}
            <button className="login-submit" type="button" disabled={busy} onClick={handleLogout}>
              {busy ? t.signingOut : t.signOut}
            </button>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-field">
              <span>{t.emailAddress}</span>
              <input name="email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={updateField} />
            </label>
            <label className="login-field">
              <span>{t.password}</span>
              <div className="login-password">
                <input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required maxLength={128} value={form.password} onChange={updateField} />
                <button className="login-reveal" type="button" aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
                  {showPassword ? t.hidePassword : t.showPassword}
                </button>
              </div>
            </label>
            <Link className="login-foot" style={{ marginTop: 0, textAlign: "right" }} to="/password-reset">{t.forgotPassword}</Link>
            <button className="login-submit" type="submit" disabled={busy}>
              {busy ? t.signingIn : t.signIn}
            </button>
          </form>
        )}
        {!user && !loading && <p className="login-foot">{t.newReader} <Link to="/register">{t.createAccount}</Link></p>}
        <Link className="login-home" to="/">{t.backHome}</Link>
      </section>
    </main>
  );
}
