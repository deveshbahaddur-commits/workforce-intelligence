import type { KpiItem } from "../api/kraKpiClient.js";

interface ScorecardEmployee {
  name: string;
  role: string;
  team?: string;
}

interface ScorecardMeta {
  employee: ScorecardEmployee;
  managerName: string;
  createdAt: string;
}

const RATING_BANDS: Array<{ field: keyof KpiItem; label: string }> = [
  { field: "ratingNeedsImprovement", label: "1 · Needs Improvement" },
  { field: "ratingBelowExpectation", label: "2 · Below Expectation" },
  { field: "ratingMeetsExpectation", label: "3 · Meets Expectation" },
  { field: "ratingAboveExpectation", label: "4 · Above Expectation" },
  { field: "ratingExceedsExpectation", label: "5 · Exceeds Expectation" },
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function kraCard(item: KpiItem, index: number): string {
  const ratingRows = RATING_BANDS.map(
    (band) => `
        <tr>
          <td class="band-label">${escapeHtml(band.label)}</td>
          <td>${escapeHtml(item[band.field] as string) || "—"}</td>
        </tr>`,
  ).join("");

  return `
    <section class="kra-card">
      <div class="kra-card-head">
        <span class="kra-index">KRA ${index + 1}</span>
        <h2>${escapeHtml(item.kra) || "Untitled KRA"}</h2>
        <span class="kra-weightage">${item.weightagePercent}%</span>
      </div>
      <p class="kra-kpi"><strong>KPI:</strong> ${escapeHtml(item.kpi)}</p>
      <p class="kra-goal">${escapeHtml(item.goalDescription)}</p>
      <div class="kra-meta">
        <span><strong>Role</strong> ${escapeHtml(item.role)}</span>
        <span><strong>Source of tracking</strong> ${escapeHtml(item.sourceOfTracking)}</span>
      </div>
      <table class="rating-table">
        <thead><tr><th>Rating band</th><th>What it looks like</th></tr></thead>
        <tbody>${ratingRows}</tbody>
      </table>
    </section>`;
}

export function generateScorecardHtml(items: KpiItem[], meta: ScorecardMeta): string {
  const totalWeightage = items.reduce((sum, item) => sum + (Number(item.weightagePercent) || 0), 0);
  const generatedOn = new Date(meta.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const cards = items.map(kraCard).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(meta.employee.name)} — KRA/KPI Scorecard</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet" />
<style>
  :root {
    --ink: #0b0f0d;
    --ink-soft: #17211b;
    --paper: #f6f7f5;
    --card: #ffffff;
    --border: #e3e6e2;
    --text: #14171a;
    --text-muted: #5b6560;
    --accent: #1f9d5a;
    --accent-dark: #157a45;
    --accent-soft: #e5f6ec;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: var(--paper);
    color: var(--text);
  }
  .header {
    background: linear-gradient(135deg, var(--ink) 0%, var(--ink-soft) 60%, #133024 100%);
    color: #fff;
    padding: 40px 48px;
  }
  .header-eyebrow {
    color: #3ed598;
    font-weight: 700;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 10px;
  }
  .header h1 {
    margin: 0 0 6px;
    font-size: 2rem;
    letter-spacing: -0.01em;
  }
  .header-sub {
    color: #cdd9d2;
    font-size: 0.95rem;
    margin: 0;
  }
  .header-facts {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    margin-top: 24px;
  }
  .header-facts div {
    font-size: 0.85rem;
    color: #b7c4bc;
  }
  .header-facts strong {
    display: block;
    color: #fff;
    font-size: 0.95rem;
    margin-top: 2px;
  }
  main {
    max-width: 900px;
    margin: 0 auto;
    padding: 32px 24px 64px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .weightage-banner {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 14px 20px;
    font-size: 0.88rem;
    font-weight: 700;
    color: ${totalWeightage === 100 ? "var(--accent-dark)" : "#8a5a10"};
  }
  .kra-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px 26px;
  }
  .kra-card-head {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 10px;
  }
  .kra-index {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--accent-dark);
    background: var(--accent-soft);
    padding: 3px 8px;
    border-radius: 999px;
  }
  .kra-card-head h2 {
    margin: 0;
    font-size: 1.15rem;
    flex: 1;
  }
  .kra-weightage {
    font-weight: 800;
    color: var(--accent-dark);
    font-size: 1rem;
  }
  .kra-kpi {
    margin: 0 0 8px;
    font-size: 0.92rem;
  }
  .kra-goal {
    margin: 0 0 14px;
    color: var(--text-muted);
    font-size: 0.9rem;
    line-height: 1.5;
  }
  .kra-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    font-size: 0.82rem;
    color: var(--text-muted);
    margin-bottom: 16px;
  }
  .kra-meta strong {
    display: block;
    color: var(--text);
    font-size: 0.78rem;
  }
  .rating-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
  }
  .rating-table th {
    text-align: left;
    background: var(--paper);
    padding: 8px 10px;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
  }
  .rating-table td {
    padding: 8px 10px;
    border-bottom: 1px solid #f0f0ef;
    vertical-align: top;
  }
  .band-label {
    font-weight: 700;
    white-space: nowrap;
    width: 190px;
  }
  @media print {
    body { background: #fff; }
    .kra-card { break-inside: avoid; }
  }
</style>
</head>
<body>
  <header class="header">
    <p class="header-eyebrow">recykal · Workforce Intelligence</p>
    <h1>${escapeHtml(meta.employee.name)}</h1>
    <p class="header-sub">${escapeHtml(meta.employee.role)}${meta.employee.team ? ` · ${escapeHtml(meta.employee.team)}` : ""}</p>
    <div class="header-facts">
      <div>Manager<strong>${escapeHtml(meta.managerName)}</strong></div>
      <div>Generated<strong>${escapeHtml(generatedOn)}</strong></div>
      <div>KRAs<strong>${items.length}</strong></div>
    </div>
  </header>
  <main>
    <div class="weightage-banner">Total weightage: ${totalWeightage}%${totalWeightage !== 100 ? " (should total 100%)" : ""}</div>
    ${cards}
  </main>
</body>
</html>`;
}

export function downloadScorecard(items: KpiItem[], meta: ScorecardMeta): void {
  const html = generateScorecardHtml(items, meta);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = meta.employee.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  a.href = url;
  a.download = `${safeName}-kra-kpi-scorecard.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
