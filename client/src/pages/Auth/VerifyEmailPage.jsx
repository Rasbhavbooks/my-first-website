import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useLanguage } from "../../hooks/useLanguage.js";
import { verifyReaderEmail } from "../../services/authService.js";

const styles = ".reset-shell{min-height:65vh;padding:60px 20px;display:grid;place-items:center;background:#f8f6f1}.reset-card{width:min(100%,480px);padding:42px;background:#fffdfa;border:1px solid #e4ddd1}.reset-card h1{font:500 clamp(30px,5vw,42px)/1.15 var(--serif);color:#30252c}.reset-card p{color:#77716a;font-size:12px;line-height:1.8}.reset-submit{min-height:44px;padding:0 18px;border:0;background:#30252c;color:white;cursor:pointer}.reset-submit:disabled{opacity:.6}";

export default function VerifyEmailPage() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(() => searchParams.get("token") || "");
  const [status, setStatus] = useState(token ? "ready" : "invalid");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (searchParams.has("token")) window.history.replaceState({}, "", "/verify-email");
  }, [searchParams]);

  async function handleVerify() {
    setBusy(true);
    setStatus("loading");
    try {
      await verifyReaderEmail(token);
      setToken("");
      setStatus("success");
    } catch {
      setStatus("invalid");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="reset-shell">
      <style>{styles}</style>
      <section className="reset-card" aria-live="polite">
        <div className="eyebrow"><i />{t.readerSpace}</div>
        <h1>{status === "success" ? t.emailVerified : status === "invalid" ? t.verificationLinkInvalid : t.verifyEmail}</h1>
        <p>{status === "success" ? t.emailVerified : status === "invalid" ? t.verificationLinkInvalid : t.verificationConfirmIntro}</p>
        {status === "ready" && <button className="reset-submit" type="button" disabled={busy} onClick={handleVerify}>{busy ? t.verifyingEmail : t.verifyEmail}</button>}
        {status === "loading" && <p role="status">{t.verifyingEmail}</p>}
        {status === "success" && <Link className="button button-dark" to="/login">{t.signIn}</Link>}
        {status === "invalid" && <Link className="button button-dark" to="/register?resend=1">{t.resendVerification}</Link>}
      </section>
    </main>
  );
}
