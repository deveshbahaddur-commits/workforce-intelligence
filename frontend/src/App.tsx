import { useEffect, useState } from "react";
import { ThemeProvider, CssBaseline, Box } from "@mui/material";
import { theme } from "./theme/theme.js";
import Sidebar, { type View } from "./shared/components/Sidebar.js";
import HomePage from "./components/HomePage.js";
import ChatWindow from "./components/ChatWindow.js";
import KraKpiPage from "./components/KraKpiPage.js";
import LoginPage from "./components/LoginPage.js";
import { getMe, logout, type SessionUser } from "./api/authClient.js";

export default function App() {
  const [view, setView] = useState<View>("home");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    getMe()
      .then(setUser)
      .finally(() => setCheckingAuth(false));
  }, []);

  async function handleLogout() {
    await logout();
    setUser(null);
    setView("home");
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {checkingAuth ? (
        <Box />
      ) : !user ? (
        <LoginPage onLoginSuccess={setUser} />
      ) : (
        <Box sx={{ display: "flex", height: "100vh" }}>
          <Sidebar view={view} onNavigate={setView} user={user} onLogout={handleLogout} />
          <Box sx={{ flex: 1, minWidth: 0, height: "100vh", overflow: "hidden" }}>
            {view === "home" && <HomePage onNavigate={setView} />}
            {view === "workforce-planning" && <ChatWindow />}
            {view === "kra-kpi" && <KraKpiPage user={user} />}
          </Box>
        </Box>
      )}
    </ThemeProvider>
  );
}
