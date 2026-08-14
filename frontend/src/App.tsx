import { useEffect, useState } from "react";
import Header from "./components/Header.js";
import HomePage from "./components/HomePage.js";
import ChatWindow from "./components/ChatWindow.js";
import KraKpiPage from "./components/KraKpiPage.js";
import LoginPage from "./components/LoginPage.js";
import { getMe, logout, type SessionUser } from "./api/authClient.js";
import "./index.css";

type View = "home" | "workforce-planning" | "kra-kpi";

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

  if (checkingAuth) {
    return <div className="app" />;
  }

  if (!user) {
    return <LoginPage onLoginSuccess={setUser} />;
  }

  return (
    <div className="app">
      <Header view={view} onNavigate={setView} user={user} onLogout={handleLogout} />
      <main className={`app-main${view === "workforce-planning" ? " app-main--full" : ""}`}>
        {view === "home" && <HomePage onNavigate={setView} />}
        {view === "workforce-planning" && <ChatWindow onBackHome={() => setView("home")} />}
        {view === "kra-kpi" && <KraKpiPage />}
      </main>
    </div>
  );
}
