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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Recykal's FY runs April-March. */
function fyLabel(iso: string): string {
  const d = new Date(iso);
  const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  const endYear = (startYear + 1) % 100;
  return `FY${String(startYear).slice(-2)}-${String(endYear).padStart(2, "0")}`;
}

/**
 * A self-contained interactive scorecard (card/table view toggle,
 * Annual/H1/H2 period toggle, click-to-expand detail panel with progress
 * bars) matching the format Recykal managers actually review against —
 * not a static printout. All rendering below is driven by the KpiItem[]
 * data itself (goalAnnual/H1/H2, metrics[], checklist[], defined), unlike
 * the original reference file this was modeled on, which hardcoded a
 * separate branch of markup per KRA — that doesn't generalize to an
 * arbitrary manager's arbitrary KRA set, so this version has exactly one
 * data-driven render path per section instead.
 */
export function generateScorecardHtml(items: KpiItem[], meta: ScorecardMeta): string {
  const generatedOn = new Date(meta.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const kpisData = items.map((item, index) => ({
    id: index + 1,
    role: item.role,
    kra: item.kra,
    goalAnnual: item.goalAnnual,
    goalH1: item.goalH1,
    goalH2: item.goalH2,
    kpiTask: item.kpiTask,
    weight: item.weightagePercent,
    source: item.sourceOfTracking,
    bands: [
      item.ratingNeedsImprovement,
      item.ratingBelowExpectation,
      item.ratingMeetsExpectation,
      item.ratingAboveExpectation,
      item.ratingExceedsExpectation,
    ],
    metrics: item.metrics ?? [],
    checklist: item.checklist ?? [],
    defined: item.defined,
  }));

  const dataJson = JSON.stringify(kpisData).replace(/</g, "\\u003c");
  const metaJson = JSON.stringify({
    deptName: meta.employee.team || meta.employee.role,
    empName: meta.employee.name,
    role: meta.employee.role,
    managerName: meta.managerName,
    fy: fyLabel(meta.createdAt),
    generatedOn,
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(meta.employee.name)} — KPI Scorecard</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

  :root{
    --ink:#101826;
    --ink-soft:#4b5568;
    --paper:#f6f7f5;
    --card:#ffffff;
    --line:#e2e5e1;
    --teal:#0f6d5f;
    --teal-deep:#0a4e44;
    --amber:#c8862a;
    --amber-soft:#fbeed9;
    --red:#b4462f;
    --teal-soft:#e2f0ec;
    --navy:#12172b;
  }
  *{box-sizing:border-box;}
  body{
    margin:0;
    background:var(--paper);
    font-family:'Inter',sans-serif;
    color:var(--ink);
    min-height:100vh;
  }
  .stage{ max-width:1180px; margin:0 auto; padding:56px 40px 90px; }
  header{
    display:flex; justify-content:space-between; align-items:flex-end;
    border-bottom:2px solid var(--ink); padding-bottom:22px; margin-bottom:36px;
  }
  .eyebrow{
    font-family:'IBM Plex Mono',monospace; font-size:12px; letter-spacing:.12em;
    text-transform:uppercase; color:var(--teal-deep); margin-bottom:8px;
  }
  h1{ font-family:'Space Grotesk',sans-serif; font-size:34px; font-weight:700; margin:0; letter-spacing:-0.01em; }
  .who{ text-align:right; font-size:13px; color:var(--ink-soft); line-height:1.5; }
  .who b{ color:var(--ink); font-weight:600; }

  .toolbar{ display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; margin-bottom:30px; }
  .period-toggle, .view-toggle{ display:flex; gap:8px; }
  .period-toggle button, .view-toggle button{
    font-family:'IBM Plex Mono',monospace; font-size:12px; letter-spacing:.06em; text-transform:uppercase;
    padding:8px 16px; border-radius:20px; border:1px solid var(--line); background:var(--card);
    color:var(--ink-soft); cursor:pointer;
  }
  .period-toggle button.active, .view-toggle button.active{ background:var(--ink); color:#fff; border-color:var(--ink); }
  .view-toggle button.active{ background:var(--teal-deep); border-color:var(--teal-deep); }

  .table-wrap{ display:none; overflow-x:auto; border:1px solid var(--line); border-radius:14px; background:var(--card); }
  .table-wrap.open{ display:block; }
  table.kpitable{ width:100%; border-collapse:collapse; font-size:12.5px; min-width:1180px; }
  table.kpitable th{
    font-family:'IBM Plex Mono',monospace; font-size:10.5px; text-transform:uppercase; letter-spacing:.04em;
    color:#fff; background:var(--navy); text-align:left; padding:12px 14px; white-space:nowrap;
  }
  table.kpitable td{ padding:14px; border-bottom:1px solid var(--line); vertical-align:top; line-height:1.5; }
  table.kpitable tr:last-child td{ border-bottom:none; }
  table.kpitable tr:hover td{ background:#fafbfa; }
  table.kpitable .kra-cell{ font-weight:600; font-family:'Space Grotesk',sans-serif; font-size:13.5px; min-width:170px; }
  table.kpitable .weight-cell{ font-family:'IBM Plex Mono',monospace; text-align:center; }
  table.kpitable .band{ text-align:center; font-family:'IBM Plex Mono',monospace; min-width:90px; }
  table.kpitable .tbd{ color:var(--amber); font-style:italic; }
  table.kpitable .src-cell{ font-family:'IBM Plex Mono',monospace; font-size:11.5px; color:var(--ink-soft); min-width:120px; }

  .grid{ display:grid; grid-template-columns:repeat(auto-fill, minmax(250px,1fr)); gap:16px; }
  .kcard{
    background:var(--card); border:1px solid var(--line); border-radius:14px; padding:20px; cursor:pointer;
    transition:transform .15s ease, box-shadow .15s ease, border-color .15s ease; position:relative;
    display:flex; flex-direction:column; gap:14px; min-height:150px;
  }
  .kcard:hover{ transform:translateY(-3px); box-shadow:0 10px 24px rgba(16,24,38,.08); border-color:var(--teal); }
  .kcard.selected{ border-color:var(--teal); box-shadow:0 0 0 2px var(--teal); }
  .kcard .idx{ font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--ink-soft); }
  .kcard h3{ font-family:'Space Grotesk',sans-serif; font-size:17px; margin:0; line-height:1.25; }
  .kcard .goal{ font-size:12.5px; color:var(--ink-soft); line-height:1.45; flex-grow:1; }
  .kcard .foot{ display:flex; justify-content:space-between; align-items:center; }
  .weight{ font-family:'IBM Plex Mono',monospace; font-size:13px; font-weight:500; }
  .status{ font-size:10.5px; font-weight:600; letter-spacing:.03em; text-transform:uppercase; padding:4px 9px; border-radius:20px; }
  .status.defined{ background:var(--teal-soft); color:var(--teal-deep); }
  .status.pending{ background:var(--amber-soft); color:var(--amber); }

  #detail{ margin-top:34px; background:var(--navy); border-radius:18px; padding:38px 40px; color:#fff; display:none; }
  #detail.open{ display:block; }
  .d-eyebrow{ font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:#7fd8c4; margin-bottom:6px; }
  #detail h2{ font-family:'Space Grotesk',sans-serif; font-size:26px; margin:0 0 6px; }
  #detail .d-goal{ color:#c4c9d8; font-size:14px; max-width:640px; margin-bottom:28px; line-height:1.55; }
  .pending-note{ border:1px dashed rgba(255,255,255,.3); border-radius:12px; padding:22px; font-size:13.5px; color:#dfe2ee; line-height:1.6; }
  .pending-note b{ color:#fff; }

  .units{ display:flex; flex-direction:column; gap:20px; margin-bottom:30px; }
  .unit-row{ display:grid; grid-template-columns:170px 1fr 90px; align-items:center; gap:16px; }
  .unit-name{ font-size:13px; font-weight:500; color:#e7e9f2; display:flex; flex-direction:column; gap:3px; }
  .track{ position:relative; height:26px; background:rgba(255,255,255,.08); border-radius:6px; overflow:visible; }
  .fill{ height:100%; border-radius:6px; background:linear-gradient(90deg,var(--red),#d97a4f); display:flex; align-items:center; transition:width .6s ease; }
  .fill.ok{ background:linear-gradient(90deg,var(--teal),#38a88f); }
  .threshold{ position:absolute; top:-4px; bottom:-4px; width:2px; background:#ffd166; }
  .unit-val{ font-family:'IBM Plex Mono',monospace; font-size:14px; text-align:right; line-height:1.4; }
  .unit-val .current{ font-size:16px; font-weight:500; color:#fff; }
  .unit-val .vs-target{ display:block; font-size:10px; color:#8f96ab; font-weight:400; }

  .scale{ display:grid; grid-template-columns:repeat(5,1fr); gap:2px; border-radius:10px; overflow:hidden; margin-top:8px; }
  .scale div{ background:rgba(255,255,255,.06); padding:14px 10px; font-size:11.5px; line-height:1.4; }
  .scale .label{ font-family:'IBM Plex Mono',monospace; font-size:9.5px; text-transform:uppercase; letter-spacing:.05em; color:#8f96ab; margin-bottom:4px; }
  .scale .n1{ background:rgba(180,70,47,.35); }
  .scale .n2{ background:rgba(200,134,42,.28); }
  .scale .n3{ background:rgba(255,255,255,.08); }
  .scale .n4{ background:rgba(15,109,95,.35); }
  .scale .n5{ background:rgba(15,109,95,.55); }

  .src{ margin-top:22px; font-family:'IBM Plex Mono',monospace; font-size:11px; color:#8f96ab; }

  .org-table-wrap{ margin-bottom:28px; border:1px solid rgba(255,255,255,.1); border-radius:12px; overflow:hidden; }
  .org-table-head{
    font-family:'IBM Plex Mono',monospace; font-size:10.5px; text-transform:uppercase; letter-spacing:.05em;
    color:#7fd8c4; padding:12px 16px; background:rgba(255,255,255,.04); border-bottom:1px solid rgba(255,255,255,.1);
  }
  .org-table{ display:grid; grid-template-columns:repeat(auto-fill, minmax(230px,1fr)); }
  .org-row{ display:flex; justify-content:space-between; align-items:center; padding:11px 16px; border-bottom:1px solid rgba(255,255,255,.06); border-right:1px solid rgba(255,255,255,.06); }
  .org-name{ font-size:12.5px; color:#e7e9f2; }
  .org-status{ font-family:'IBM Plex Mono',monospace; font-size:10px; text-transform:uppercase; letter-spacing:.03em; padding:3px 9px; border-radius:12px; }
  .org-status.done{ background:rgba(15,109,95,.35); color:#7fd8c4; }
  .org-status.pending{ background:rgba(200,134,42,.25); color:#e8b25f; }

  .project-group{ margin-bottom:22px; }
  .project-group .unit-row{ margin-top:10px; }
  .project-name{ font-family:'Space Grotesk',sans-serif; font-size:15px; font-weight:600; color:#fff; padding-bottom:4px; border-bottom:1px solid rgba(255,255,255,.1); }
  .milestone-label{ font-family:'IBM Plex Mono',monospace; font-size:10px; text-transform:uppercase; letter-spacing:.04em; color:#7fd8c4; }

  .hint{ text-align:center; font-size:12.5px; color:var(--ink-soft); margin-top:14px; }

  @media (max-width:640px){
    .stage{ padding:32px 18px 60px; }
    header{ flex-direction:column; align-items:flex-start; gap:10px; }
    .who{ text-align:left; }
    .unit-row{ grid-template-columns:110px 1fr 60px; gap:10px; }
  }
</style>
</head>
<body>
<div class="stage">
  <header>
    <div>
      <div class="eyebrow" id="eyebrow"></div>
      <h1 id="deptName"></h1>
    </div>
    <div class="who" id="who"></div>
  </header>

  <div class="toolbar">
    <div class="period-toggle">
      <button class="active" data-period="annual">Annual</button>
      <button data-period="h1">H1</button>
      <button data-period="h2">H2</button>
    </div>
    <div class="view-toggle">
      <button class="active" data-view="cards">Card view</button>
      <button data-view="table">Table view</button>
    </div>
  </div>

  <div class="grid" id="grid"></div>
  <div class="table-wrap" id="tableWrap"></div>

  <div id="detail"></div>
  <div class="hint" id="hint">Click any KRA above to see current data against target.</div>
</div>

<script>
const kpis = ${dataJson};
const meta = ${metaJson};

function esc(s){
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

document.getElementById('eyebrow').textContent = meta.fy + ' · KPI Scorecard';
document.getElementById('deptName').textContent = meta.deptName;
document.getElementById('who').innerHTML = '<b>' + esc(meta.empName) + '</b><br>' + esc(meta.role);

const grid = document.getElementById('grid');
const detail = document.getElementById('detail');
const hint = document.getElementById('hint');
let currentPeriod = 'annual';
let selectedId = null;

function goalFor(k, period){
  if(period === 'h1') return k.goalH1 || k.goalAnnual;
  if(period === 'h2') return k.goalH2 || k.goalAnnual;
  return k.goalAnnual;
}

function renderGrid(){
  grid.innerHTML = kpis.map(k => \`
    <div class="kcard \${selectedId===k.id ? 'selected' : ''}" data-id="\${k.id}">
      <div class="idx">KRA \${String(k.id).padStart(2,'0')}</div>
      <h3>\${esc(k.kra) || 'Untitled KRA'}</h3>
      <div class="goal">\${esc(k.goalAnnual)}</div>
      <div class="foot">
        <span class="weight">\${k.weight}%</span>
        <span class="status \${k.defined ? 'defined' : 'pending'}">\${k.defined ? 'Target set' : 'Pending input'}</span>
      </div>
    </div>
  \`).join('');
  document.querySelectorAll('.kcard').forEach(c=>{
    c.addEventListener('click', ()=>{
      const id = parseInt(c.dataset.id);
      selectedId = (selectedId === id) ? null : id;
      renderGrid();
      renderDetail();
    });
  });
}

function metricRow(m){
  const max = Math.max(m.baseline, m.target, 1) * 1.25;
  const unit = m.unit || '';
  const decimals = unit === '%' ? 1 : (Number.isInteger(m.baseline) && Number.isInteger(m.target) ? 0 : 2);
  const pct = Math.min(100, (m.baseline/max)*100);
  const targetPct = Math.min(100, (m.target/max)*100);
  const met = m.direction === 'down' ? m.baseline <= m.target : m.baseline >= m.target;
  const nameLabel = m.milestone ? '<span class="milestone-label">' + esc(m.milestone) + '</span>' : esc(m.name);
  return \`
    <div class="unit-row">
      <div class="unit-name">\${nameLabel}\${m.note ? '<span class="tag" style="font-family:\\'IBM Plex Mono\\',monospace;font-size:9.5px;color:#8f96ab;">' + esc(m.note) + '</span>' : ''}</div>
      <div class="track">
        <div class="fill \${met?'ok':''}" style="width:\${pct}%"></div>
        <div class="threshold" style="left:\${targetPct}%"></div>
      </div>
      <div class="unit-val"><span class="current">\${m.baseline.toFixed(decimals)}\${unit}</span><span class="vs-target">target \${m.target.toFixed(decimals)}\${unit}</span></div>
    </div>
  \`;
}

function renderMetrics(metrics){
  const grouped = metrics.filter(m => m.group);
  const flat = metrics.filter(m => !m.group);
  const groups = [];
  grouped.forEach(m=>{
    let g = groups.find(x=>x.name===m.group);
    if(!g){ g = { name: m.group, items: [] }; groups.push(g); }
    g.items.push(m);
  });
  const flatHtml = flat.map(metricRow).join('');
  const groupHtml = groups.map(g=>
    '<div class="project-group"><div class="project-name">' + esc(g.name) + '</div>' + g.items.map(metricRow).join('') + '</div>'
  ).join('');
  return flatHtml + groupHtml;
}

function checklistTable(items){
  const done = items.filter(c=>c.done).length;
  return \`
    <div class="org-table-wrap">
      <div class="org-table-head">Rollout Status (\${done} of \${items.length} complete)</div>
      <div class="org-table">
        \${items.map(c=>\`
          <div class="org-row">
            <span class="org-name">\${esc(c.name)}</span>
            <span class="org-status \${c.done ? 'done' : 'pending'}">\${c.done ? 'Completed' : 'Pending'}</span>
          </div>
        \`).join('')}
      </div>
    </div>
  \`;
}

function renderDetail(){
  if(selectedId === null){
    detail.classList.remove('open');
    detail.innerHTML = '';
    hint.style.display = 'block';
    return;
  }
  hint.style.display = 'none';
  const k = kpis.find(x=>x.id===selectedId);
  detail.classList.add('open');

  const periodLabels = { annual: 'Annual', h1: 'H1 (checkpoint)', h2: 'H2 (target)' };
  const eyebrow = 'KRA ' + String(k.id).padStart(2,'0') + ' · ' + periodLabels[currentPeriod];
  const goalText = goalFor(k, currentPeriod);

  if(!k.defined){
    detail.innerHTML = \`
      <div class="d-eyebrow">\${eyebrow} · \${k.weight}% weightage</div>
      <h2>\${esc(k.kra)}</h2>
      <div class="d-goal">\${esc(goalText)}</div>
      <div class="pending-note">
        <b>Target definition in progress.</b> Baseline data and a specific, measurable KPI for this KRA
        are being finalised with the manager — this card will populate the same way a confirmed KRA does
        once agreed.
      </div>
    \`;
    return;
  }

  const scaleHtml = \`
    <div class="scale">
      <div class="n1"><div class="label">Needs Improvement</div>\${esc(k.bands[0])}</div>
      <div class="n2"><div class="label">Below Expectation</div>\${esc(k.bands[1])}</div>
      <div class="n3"><div class="label">Meets Expectation</div>\${esc(k.bands[2])}</div>
      <div class="n4"><div class="label">Above Expectation</div>\${esc(k.bands[3])}</div>
      <div class="n5"><div class="label">Exceeds Expectation</div>\${esc(k.bands[4])}</div>
    </div>
  \`;

  const metricsHtml = k.metrics.length > 0 ? \`<div class="units">\${renderMetrics(k.metrics)}</div>\` : '';
  const checklistHtml = k.checklist.length > 0 ? checklistTable(k.checklist) : '';

  detail.innerHTML = \`
    <div class="d-eyebrow">\${eyebrow}</div>
    <h2>\${esc(k.kra)}</h2>
    <div class="d-goal">\${esc(goalText)}</div>
    \${metricsHtml}
    \${checklistHtml}
    \${scaleHtml}
    <div class="src">SOURCE — \${esc(k.source)} · Weightage \${k.weight}%</div>
  \`;
}

function renderTable(){
  const tableWrap = document.getElementById('tableWrap');
  const bandHeaders = ["Needs Improvement (1)","Below Expectation (2)","Meets Expectation (3)","Above Expectation (4)","Exceeds Expectation (5)"];
  tableWrap.innerHTML = \`
    <table class="kpitable">
      <thead>
        <tr>
          <th>Role</th><th>Emp Name</th><th>KRA</th><th>Goal</th><th>Weight</th><th>KPI (Task)</th><th>Source</th>
          \${bandHeaders.map(h=>'<th>'+h+'</th>').join('')}
        </tr>
      </thead>
      <tbody>
        \${kpis.map(k=>\`
          <tr>
            <td>\${esc(k.role)}</td>
            <td>\${esc(meta.empName)}</td>
            <td class="kra-cell">\${esc(k.kra)}</td>
            <td>\${esc(k.goalAnnual)}</td>
            <td class="weight-cell">\${k.weight}%</td>
            <td>\${k.defined ? esc(k.kpiTask) : '<span class="tbd">Pending input</span>'}</td>
            <td class="src-cell">\${esc(k.source)}</td>
            \${k.defined
              ? k.bands.map(b=>'<td class="band">'+esc(b)+'</td>').join('')
              : '<td class="band tbd" colspan="5">Rating scale pending</td>'
            }
          </tr>
        \`).join('')}
      </tbody>
    </table>
  \`;
}

document.querySelectorAll('.period-toggle button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.period-toggle button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentPeriod = btn.dataset.period;
    renderDetail();
  });
});

document.querySelectorAll('.view-toggle button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.view-toggle button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    const tableWrap = document.getElementById('tableWrap');
    const detailEl = document.getElementById('detail');
    if(view === 'table'){
      grid.style.display = 'none';
      tableWrap.classList.add('open');
      detailEl.classList.remove('open');
      hint.style.display = 'none';
    } else {
      grid.style.display = 'grid';
      tableWrap.classList.remove('open');
      renderDetail();
    }
  });
});

renderGrid();
renderTable();
renderDetail();
</script>
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
