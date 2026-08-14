import { signInUrl } from "../api/authClient.js";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  not_linked:
    "That Google account isn't linked to an employee record. Check with People & Culture if you think this is wrong.",
  oauth_failed: "Something went wrong signing you in. Please try again.",
  missing_code: "Sign-in was interrupted. Please try again.",
};

interface LoginPageProps {
  authError: string | null;
}

export default function LoginPage({ authError }: LoginPageProps) {
  return (
    <div className="login-page">
      <div className="login-card">
        <p className="hero-eyebrow">For every manager at Recykal</p>
        <h1 className="login-title">Sign in to continue</h1>
        <p className="login-subtitle">Use your @recykal.com Google account to access workforce planning and KRA/KPIs.</p>
        {authError && <p className="login-error">{AUTH_ERROR_MESSAGES[authError] ?? "Sign-in failed. Please try again."}</p>}
        <a className="login-google-button" href={signInUrl()}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.03l3.05-2.33z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.97l3.05 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
          </svg>
          Sign in with Google
        </a>
      </div>
    </div>
  );
}
