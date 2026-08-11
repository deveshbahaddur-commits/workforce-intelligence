interface HomePageProps {
  onNavigate: (view: "workforce-planning" | "kra-kpi") => void;
}

const NAV_CARDS = [
  {
    view: "workforce-planning" as const,
    title: "Workforce Planning",
    description:
      "Ask headcount, capacity, and hiring questions — grounded in live HRIS data, guardrail-gated by decision type.",
  },
  {
    view: "kra-kpi" as const,
    title: "Set KRA/KPIs for Team",
    description:
      "Pull your direct and indirect reportees and draft KRA/KPIs with an assistant, in the standard org-wide format.",
  },
];

export default function HomePage({ onNavigate }: HomePageProps) {
  return (
    <div className="home">
      <section className="hero">
        <p className="hero-eyebrow">Internal · People Ops</p>
        <h1 className="hero-title">
          Workforce decisions,
          <br />
          backed by real data.
        </h1>
        <p className="hero-subtitle">
          Plan headcount, set KRA/KPIs, and keep every people decision auditable — in one place.
        </p>
      </section>

      <section className="nav-cards">
        {NAV_CARDS.map((card) => (
          <button key={card.view} className="nav-card" onClick={() => onNavigate(card.view)}>
            <div className="nav-card-body">
              <h2>{card.title}</h2>
              <p>{card.description}</p>
            </div>
            <span className="nav-card-arrow" aria-hidden="true">
              ↗
            </span>
          </button>
        ))}
      </section>
    </div>
  );
}
