import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { confirmAdminMfaSetup, getAdminMfaStatus, startAdminMfaSetup } from "../../services/authService.js";

const styles = `
.admin-mfa-page{max-width:760px;min-height:70vh;margin:auto;padding:54px 22px 90px}
.admin-mfa-page h1{font:500 clamp(34px,5vw,48px)/1.1 var(--serif);color:#30252c}
.admin-mfa-intro,.admin-mfa-help{color:#77716a;font-size:12px;line-height:1.8}
.admin-mfa-panel{margin:20px 0;padding:24px;border:1px solid #e4ddd1;background:#fffdfa}
.admin-mfa-panel h2{font:500 23px var(--serif);color:#30252c}
.admin-mfa-field{display:grid;gap:7px;margin:14px 0;color:#514a44;font-size:11px}
.admin-mfa-field input{width:100%;height:44px;padding:0 12px;border:1px solid #d8d0c4;background:#fff;color:#30252c}
.admin-mfa-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
.admin-mfa-actions button{min-height:42px;padding:0 16px;border:1px solid #30252c;background:#30252c;color:white;cursor:pointer}
.admin-mfa-actions button:disabled{opacity:.55}
.admin-mfa-secret,.admin-mfa-recovery{padding:14px;background:#f6f3ee;color:#30252c;overflow-wrap:anywhere;font:600 13px/1.9 ui-monospace,monospace}
.admin-mfa-error{padding:12px;background:#f8ece8;color:#863d32;font-size:11px}
.admin-mfa-success{padding:12px;background:#eef5ed;color:#426c50;font-size:11px}
`;

export default function AdminMfaSetupPage() {
  const { user, loading, refreshSession } = useAuth();
  const { t } = useLanguage();
  const [status, setStatus] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadStatus() {
    try {
      setStatus(await getAdminMfaStatus());
    } catch {
      setError(t.adminMfaUnavailable);
    }
  }

  useEffect(() => {
    if (user?.role === "admin") loadStatus();
  }, [user?.id, user?.role]);

  if (loading) return <main className="admin-mfa-page"><p>{t.loadingAccount}</p></main>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") return <main className="admin-mfa-page"><h1>{t.adminOnly}</h1><Link to="/">{t.backHome}</Link></main>;

  async function beginSetup(event) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      setEnrollment(await startAdminMfaSetup(password));
      setPassword("");
    } catch (requestError) {
      setError(requestError.code === "MFA_SETUP_NOT_CONFIGURED" ? t.adminMfaKeyMissing : t.adminMfaError);
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup(event) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await confirmAdminMfaSetup(code);
      setRecoveryCodes(result.recoveryCodes || []);
      setEnrollment(null);
      setCode("");
      setStatus({ enabled: true, recoveryCodesRemaining: result.recoveryCodes?.length || 0, setupAvailable: true });
      await refreshSession();
      setNotice(t.adminMfaEnabledNotice);
    } catch (requestError) {
      setError(requestError.code === "INVALID_MFA_CODE" ? t.adminMfaInvalid : t.adminMfaError);
    } finally {
      setBusy(false);
    }
  }

  async function copyRecoveryCodes() {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      setNotice(t.adminMfaCopied);
    } catch {
      setError(t.adminMfaCopyError);
    }
  }

  return (
    <main className="admin-mfa-page">
      <style>{styles}</style>
      <div className="eyebrow"><i />{t.adminPortal}</div>
      <h1>{t.adminMfaSetupTitle}</h1>
      <p className="admin-mfa-intro">{t.adminMfaIntro}</p>
      <p><Link to="/admin">{t.adminDashboardTitle}</Link></p>
      {error && <p className="admin-mfa-error" role="alert">{error}</p>}
      {notice && <p className="admin-mfa-success" role="status">{notice}</p>}
      {status?.enabled && !recoveryCodes.length ? (
        <section className="admin-mfa-panel">
          <h2>{t.adminMfaEnabledTitle}</h2>
          <p className="admin-mfa-intro">{t.adminMfaEnabledDescription}</p>
          <p className="admin-mfa-help">{t.adminMfaRecoveryCount}: {status.recoveryCodesRemaining}</p>
        </section>
      ) : recoveryCodes.length ? (
        <section className="admin-mfa-panel">
          <h2>{t.adminMfaRecoveryTitle}</h2>
          <p className="admin-mfa-help">{t.adminMfaRecoveryWarning}</p>
          <pre className="admin-mfa-recovery">{recoveryCodes.join("\n")}</pre>
          <div className="admin-mfa-actions"><button type="button" onClick={copyRecoveryCodes}>{t.adminMfaCopyCodes}</button></div>
          <p><Link to="/admin">{t.adminDashboardTitle}</Link></p>
        </section>
      ) : enrollment ? (
        <section className="admin-mfa-panel">
          <h2>{t.adminMfaAuthenticatorTitle}</h2>
          <p className="admin-mfa-help">{t.adminMfaAuthenticatorHelp}</p>
          <p><a href={enrollment.otpauthUrl}>{t.adminMfaOpenAuthenticator}</a></p>
          <label className="admin-mfa-field">{t.adminMfaManualKey}<code className="admin-mfa-secret">{enrollment.secret}</code></label>
          <form onSubmit={confirmSetup}>
            <label className="admin-mfa-field">{t.adminMfaCode}<input inputMode="numeric" autoComplete="one-time-code" required maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /></label>
            <div className="admin-mfa-actions"><button type="submit" disabled={busy || code.length !== 6}>{busy ? t.savingChanges : t.adminMfaVerify}</button></div>
          </form>
        </section>
      ) : !status?.setupAvailable ? (
        <section className="admin-mfa-panel"><h2>{t.adminMfaKeyMissing}</h2><p className="admin-mfa-help">{t.adminMfaKeyInstructions}</p></section>
      ) : (
        <section className="admin-mfa-panel">
          <h2>{t.adminMfaStartTitle}</h2>
          <p className="admin-mfa-help">{t.adminMfaStartHelp}</p>
          <form onSubmit={beginSetup}>
            <label className="admin-mfa-field">{t.password}<input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <div className="admin-mfa-actions"><button type="submit" disabled={busy}>{busy ? t.savingChanges : t.adminMfaStart}</button></div>
          </form>
        </section>
      )}
    </main>
  );
}
