import { useState, type FormEvent } from "react";
import { login, type SessionUser } from "../api/authClient.js";

interface LoginPageProps {
  onLoginSuccess: (user: SessionUser) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || loading) return;
    setLoading(true);
    setError(null);
    try {
      const user = await login(email.trim(), password);
      onLoginSuccess(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <p className="hero-eyebrow">For every manager at Recykal</p>
        <h1 className="login-title">Sign in to continue</h1>
        <p className="login-subtitle">Use your work email and the password you were given to access workforce planning and KRA/KPIs.</p>
        {error && <p className="login-error">{error}</p>}
        <label className="login-field">
          Work email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="login-field">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit" className="login-submit" disabled={loading || !email.trim() || !password}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="login-hint">Don't have a password yet? Ask your admin to set one for you.</p>
      </form>
    </div>
  );
}
