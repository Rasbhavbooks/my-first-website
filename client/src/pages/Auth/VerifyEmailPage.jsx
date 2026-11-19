import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useLanguage } from "../../hooks/useLanguage.js";
import { verifyReaderEmail } from "../../services/authService.js";

const styles = ".reset-shell{min-height:65vh;padding:60px 20px;display:grid;place-items:center;background:#f8f6f1}.reset-card{width:min(100%,480px);padding:42px;background:#fffdfa;border:1px solid #e4ddd1}.reset-card h1{font:500 clamp(30px,5vw,42px)/1.15 var(--serif);color:#30252c}.reset-card p{color:#77716a;font-size:12px;line-height:1.8}";\n\nexport default function VerifyEmailPage() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const token = searchParams.get("token") || "";
    window.history.replaceState({}, "", "/verify-email");
    let active = true;
    if (!token) {
      setStatus("invalid");
      return () => { active = false; };
    }
    verifyReaderEmail(token)
      .then(() => { if (active) setStatus("success"); })
      .catch(() => { if (active) setStatus("invalid"); });
    return () => { active = false; };
  }, [searchParams]);

  return (
    <main className="reset-shell">
      <section className="reset-card" aria-live="polite">
        <div className="eyebrow"><i />{t.readerSpace}</div>
        <h1>{status === "loading" ? t.verifyingEmail : status === "success" ? t.emailVerified : t.verificationLinkInvalid}</h1>
        <p>{status === "loading" ? t.verifyingEmail : status === "success" ? t.emailVerified : t.verificationLinkInvalid}</p>
        {status === "success" && <Link className="button button-dark" to="/login">{t.signIn}</Link>}
        {status === "invalid" && <Link className="button button-dark" to="/register?resend=1">{t.resendVerification}</Link>}
      </section>
    </main>
  );
}
