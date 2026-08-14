import type { SessionUser } from "../api/authClient.js";

type View = "home" | "workforce-planning" | "kra-kpi";

interface HeaderProps {
  view: View;
  onNavigate: (view: View) => void;
  user: SessionUser;
  onLogout: () => void;
}

const NAV_ITEMS: Array<{ view: View; label: string }> = [
  { view: "workforce-planning", label: "Workforce Planning" },
  { view: "kra-kpi", label: "Set KRA/KPIs" },
];

/**
 * Original abstract mark — not a reproduction of Recykal's real logo, which
 * we don't have a licensed asset file for. Swap <LogoMark /> for an <img>
 * pointing at the real SVG/PNG (e.g. frontend/public/logo.svg) when one is
 * available; the rest of this component doesn't need to change.
 */
function LogoMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="14.5" stroke="#fff" strokeWidth="2.2" />
      <path d="M16 3.5A12.5 12.5 0 0 1 28.5 16" stroke="#3ED598" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="16" cy="16" r="4.5" fill="#fff" />
    </svg>
  );
}

export default function Header({ view, onNavigate, user, onLogout }: HeaderProps) {
  return (
    <header className="site-header">
      <button className="brand" onClick={() => onNavigate("home")} aria-label="Go to home">
        <LogoMark />
        <span className="brand-text">
          <span className="brand-name">recykal</span>
          <span className="brand-tagline">Workforce Intelligence</span>
        </span>
      </button>
      <nav className="site-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            className={`nav-link${view === item.view ? " nav-link--active" : ""}`}
            onClick={() => onNavigate(item.view)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="header-user">
        <span className="header-user-name">{user.name}</span>
        <button type="button" className="header-logout" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </header>
  );
}
