import { useState, type FormEvent } from "react";
import { Alert, Box, Button, Link, Paper, TextField, Typography } from "@mui/material";
import { login, signup, type SessionUser } from "../api/authClient.js";
import { colors } from "../theme/colors.styles.js";

interface LoginPageProps {
  onLoginSuccess: (user: SessionUser) => void;
}

type Mode = "login" | "signup";

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || loading) return;
    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const user = mode === "login" ? await login(email.trim(), password) : await signup(email.trim(), password);
      onLoginSuccess(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: colors.background.default,
        p: 3,
      }}
    >
      <Paper
        component="form"
        onSubmit={handleSubmit}
        variant="outlined"
        sx={{ borderRadius: "0.75rem", p: 5, maxWidth: 420, width: "100%" }}
      >
        <Typography
          variant="overline"
          sx={{ color: colors.primary.main, fontWeight: 600, display: "block", mb: 1 }}
        >
          For every manager at Recykal
        </Typography>
        <Typography variant="h1" sx={{ mb: 1 }}>
          {isLogin ? "Sign in to continue" : "Create your account"}
        </Typography>
        <Typography variant="caption2" sx={{ color: colors.text.muted, display: "block", mb: 3 }}>
          {isLogin
            ? "Use your official work email and password to access workforce planning and KRA/KPIs."
            : "Use your official work email — it's how the app matches you to your reportees. Choose a password to set up your account."}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2.5 }}>
            {error}
          </Alert>
        )}

        <TextField
          label="Official work email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
          fullWidth
          sx={{ mb: 2.5 }}
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isLogin ? "current-password" : "new-password"}
          required
          fullWidth
          sx={{ mb: isLogin ? 3 : 2.5 }}
          helperText={isLogin ? undefined : "At least 8 characters"}
        />
        {!isLogin && (
          <TextField
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
            fullWidth
            sx={{ mb: 3 }}
          />
        )}

        <Button type="submit" variant="contained" fullWidth disabled={loading || !email.trim() || !password}>
          {loading ? (isLogin ? "Signing in…" : "Creating account…") : isLogin ? "Sign in" : "Create account"}
        </Button>

        <Typography variant="caption2" sx={{ color: colors.text.muted, display: "block", mt: 2.5 }}>
          {isLogin ? (
            <>
              Don't have an account yet?{" "}
              <Link component="button" type="button" onClick={() => switchMode("signup")} sx={{ fontWeight: 600 }}>
                Create one
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link component="button" type="button" onClick={() => switchMode("login")} sx={{ fontWeight: 600 }}>
                Sign in
              </Link>
            </>
          )}
        </Typography>
      </Paper>
    </Box>
  );
}
