import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useLanguage } from "../../hooks/useLanguage.js";
import { verifyReaderEmail } from "../../services/authService.js";

export default function VerifyEmailPage() {
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
        {status === "invalid" && <Link className="button button-dark" to="/register">{t.resendVerification}</Link>}
      </section>
    </main>
  );
}
