import { useState } from "react";
import Header from "./components/Header.js";
import HomePage from "./components/HomePage.js";
import ChatWindow from "./components/ChatWindow.js";
import KraKpiPage from "./components/KraKpiPage.js";
import "./index.css";

type View = "home" | "workforce-planning" | "kra-kpi";

export default function App() {
  const [view, setView] = useState<View>("home");

  return (
    <div className="app">
      <Header view={view} onNavigate={setView} />
      <main className="app-main">
        {view === "home" && <HomePage onNavigate={setView} />}
        {view === "workforce-planning" && <ChatWindow />}
        {view === "kra-kpi" && <KraKpiPage />}
      </main>
    </div>
  );
}
