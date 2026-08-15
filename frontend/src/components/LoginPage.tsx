import { useState, type FormEvent } from "react";
import { Alert, Box, Button, Paper, TextField, Typography } from "@mui/material";
import { login, type SessionUser } from "../api/authClient.js";
import { colors } from "../theme/colors.styles.js";

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
          Sign in to continue
        </Typography>
        <Typography variant="caption2" sx={{ color: colors.text.muted, display: "block", mb: 3 }}>
          Use your work email and the password you were given to access workforce planning and KRA/KPIs.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2.5 }}>
            {error}
          </Alert>
        )}

        <TextField
          label="Work email"
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
          autoComplete="current-password"
          required
          fullWidth
          sx={{ mb: 3 }}
        />

        <Button type="submit" variant="contained" fullWidth disabled={loading || !email.trim() || !password}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>

        <Typography variant="caption2" sx={{ color: colors.text.muted, display: "block", mt: 2.5 }}>
          Don't have a password yet? Ask your admin to set one for you.
        </Typography>
      </Paper>
    </Box>
  );
}
