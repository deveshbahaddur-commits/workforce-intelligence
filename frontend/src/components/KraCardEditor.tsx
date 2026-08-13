import type { KpiItem, KraChecklistItem, KraMetric } from "../api/kraKpiClient.js";

const BLANK_METRIC: KraMetric = {
  name: "",
  baseline: 0,
  target: 0,
  unit: "%",
  direction: "down",
  note: "",
  group: "",
  milestone: "",
};

const BLANK_CHECKLIST_ITEM: KraChecklistItem = { name: "", done: false };

const RATING_FIELDS: Array<{ field: keyof KpiItem; label: string }> = [
  { field: "ratingNeedsImprovement", label: "1 · Needs Improvement" },
  { field: "ratingBelowExpectation", label: "2 · Below Expectation" },
  { field: "ratingMeetsExpectation", label: "3 · Meets Expectation" },
  { field: "ratingAboveExpectation", label: "4 · Above Expectation" },
  { field: "ratingExceedsExpectation", label: "5 · Exceeds Expectation" },
];

interface KraCardEditorProps {
  item: KpiItem;
  index: number;
  onChange: (index: number, item: KpiItem) => void;
  onRemove: (index: number) => void;
}

export default function KraCardEditor({ item, index, onChange, onRemove }: KraCardEditorProps) {
  function set<K extends keyof KpiItem>(field: K, value: KpiItem[K]) {
    onChange(index, { ...item, [field]: value });
  }

  function updateMetric(mIndex: number, field: keyof KraMetric, value: string | number) {
    const metrics = item.metrics.map((m, i) => (i === mIndex ? { ...m, [field]: value } : m));
    set("metrics", metrics);
  }

  function addMetric() {
    set("metrics", [...item.metrics, { ...BLANK_METRIC }]);
  }

  function removeMetric(mIndex: number) {
    set(
      "metrics",
      item.metrics.filter((_, i) => i !== mIndex),
    );
  }

  function updateChecklistItem(cIndex: number, field: keyof KraChecklistItem, value: string | boolean) {
    const checklist = item.checklist.map((c, i) => (i === cIndex ? { ...c, [field]: value } : c));
    set("checklist", checklist);
  }

  function addChecklistItem() {
    set("checklist", [...item.checklist, { ...BLANK_CHECKLIST_ITEM }]);
  }

  function removeChecklistItem(cIndex: number) {
    set(
      "checklist",
      item.checklist.filter((_, i) => i !== cIndex),
    );
  }

  return (
    <div className="kra-card-editor">
      <div className="kra-card-editor-head">
        <span className="kra-card-editor-index">KRA {String(index + 1).padStart(2, "0")}</span>
        <input
          className="kra-card-editor-title"
          value={item.kra}
          onChange={(e) => set("kra", e.target.value)}
          placeholder="KRA name, e.g. Employee Attrition & Retention"
        />
        <label className="kra-card-editor-weight">
          Weight %
          <input
            type="number"
            value={item.weightagePercent}
            onChange={(e) => set("weightagePercent", Number(e.target.value) || 0)}
          />
        </label>
        <label className="kra-card-editor-defined">
          <input type="checkbox" checked={item.defined} onChange={(e) => set("defined", e.target.checked)} />
          Target set
        </label>
        <button type="button" className="kra-card-editor-remove" onClick={() => onRemove(index)} aria-label="Remove KRA">
          ×
        </button>
      </div>

      <label className="kra-card-editor-field">
        Role
        <input value={item.role} onChange={(e) => set("role", e.target.value)} />
      </label>

      <label className="kra-card-editor-field">
        KPI / Task (precise, measurable — shown in the review table)
        <textarea value={item.kpiTask} onChange={(e) => set("kpiTask", e.target.value)} rows={2} />
      </label>

      <div className="kra-card-editor-goals">
        <label className="kra-card-editor-field">
          Goal — Annual
          <textarea value={item.goalAnnual} onChange={(e) => set("goalAnnual", e.target.value)} rows={3} />
        </label>
        <label className="kra-card-editor-field">
          Goal — H1
          <textarea value={item.goalH1} onChange={(e) => set("goalH1", e.target.value)} rows={3} />
        </label>
        <label className="kra-card-editor-field">
          Goal — H2
          <textarea value={item.goalH2} onChange={(e) => set("goalH2", e.target.value)} rows={3} />
        </label>
      </div>

      <label className="kra-card-editor-field">
        Source of Tracking
        <input value={item.sourceOfTracking} onChange={(e) => set("sourceOfTracking", e.target.value)} />
      </label>

      <div className="kra-card-editor-ratings">
        {RATING_FIELDS.map((r) => (
          <label className="kra-card-editor-field" key={r.field}>
            {r.label}
            <textarea
              value={item[r.field] as string}
              onChange={(e) => set(r.field, e.target.value as KpiItem[typeof r.field])}
              rows={2}
            />
          </label>
        ))}
      </div>

      <div className="kra-card-editor-section">
        <div className="kra-card-editor-section-head">
          <h4>Tracked Metrics (baseline → target)</h4>
          <button type="button" onClick={addMetric}>
            + Add metric
          </button>
        </div>
        {item.metrics.length === 0 && <p className="kra-card-editor-empty">No numeric metrics for this KRA yet.</p>}
        {item.metrics.map((m, i) => (
          <div className="kra-metric-row" key={i}>
            <input
              className="kra-metric-name"
              value={m.name}
              onChange={(e) => updateMetric(i, "name", e.target.value)}
              placeholder="Metric name"
            />
            <input
              type="number"
              className="kra-metric-num"
              value={m.baseline}
              onChange={(e) => updateMetric(i, "baseline", Number(e.target.value) || 0)}
              placeholder="Baseline"
            />
            <input
              type="number"
              className="kra-metric-num"
              value={m.target}
              onChange={(e) => updateMetric(i, "target", Number(e.target.value) || 0)}
              placeholder="Target"
            />
            <input
              className="kra-metric-unit"
              value={m.unit}
              onChange={(e) => updateMetric(i, "unit", e.target.value)}
              placeholder="Unit"
            />
            <select value={m.direction} onChange={(e) => updateMetric(i, "direction", e.target.value)}>
              <option value="down">Lower is better</option>
              <option value="up">Higher is better</option>
            </select>
            <input
              className="kra-metric-note"
              value={m.note}
              onChange={(e) => updateMetric(i, "note", e.target.value)}
              placeholder="Note (optional)"
            />
            <input
              className="kra-metric-group"
              value={m.group ?? ""}
              onChange={(e) => updateMetric(i, "group", e.target.value)}
              placeholder="Project (optional)"
            />
            <button type="button" className="kra-metric-remove" onClick={() => removeMetric(i)} aria-label="Remove metric">
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="kra-card-editor-section">
        <div className="kra-card-editor-section-head">
          <h4>Checklist (optional — per-unit rollout tracking)</h4>
          <button type="button" onClick={addChecklistItem}>
            + Add item
          </button>
        </div>
        {item.checklist.length === 0 && <p className="kra-card-editor-empty">No checklist for this KRA.</p>}
        {item.checklist.map((c, i) => (
          <div className="kra-checklist-row" key={i}>
            <input
              className="kra-checklist-name"
              value={c.name}
              onChange={(e) => updateChecklistItem(i, "name", e.target.value)}
              placeholder="Item name, e.g. a department"
            />
            <label className="kra-checklist-done">
              <input
                type="checkbox"
                checked={c.done}
                onChange={(e) => updateChecklistItem(i, "done", e.target.checked)}
              />
              Done
            </label>
            <button
              type="button"
              className="kra-metric-remove"
              onClick={() => removeChecklistItem(i)}
              aria-label="Remove checklist item"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
