import { useEffect, useState } from "react";
import * as api from "../api/kraKpiClient.js";
import ReporteeTree from "./ReporteeTree.js";

type TextField = Exclude<keyof api.KpiItem, "weightagePercent">;

const BLANK_ITEM: api.KpiItem = {
  role: "",
  kra: "",
  kpi: "",
  goalDescription: "",
  weightagePercent: 0,
  sourceOfTracking: "",
  ratingNeedsImprovement: "",
  ratingBelowExpectation: "",
  ratingMeetsExpectation: "",
  ratingAboveExpectation: "",
  ratingExceedsExpectation: "",
};

const COLUMNS: Array<{ field: TextField; label: string }> = [
  { field: "role", label: "Role" },
  { field: "kra", label: "KRA" },
  { field: "kpi", label: "KPI" },
  { field: "goalDescription", label: "Goal Description" },
  { field: "sourceOfTracking", label: "Source of Tracking" },
  { field: "ratingNeedsImprovement", label: "1 - Needs Improvement" },
  { field: "ratingBelowExpectation", label: "2 - Below Expectation" },
  { field: "ratingMeetsExpectation", label: "3 - Meets Expectation" },
  { field: "ratingAboveExpectation", label: "4 - Above Expectation" },
  { field: "ratingExceedsExpectation", label: "5 - Exceeds Expectation" },
];

function findInTree(nodes: api.ReporteeNode[], id: string | null): api.ReporteeNode | null {
  if (!id) return null;
  for (const node of nodes) {
    if (node.employeeId === id) return node;
    const found = findInTree(node.reports, id);
    if (found) return found;
  }
  return null;
}

export default function KraKpiPage() {
  const [managers, setManagers] = useState<api.ManagerOption[]>([]);
  const [managerId, setManagerId] = useState("");
  const [reporteeTree, setReporteeTree] = useState<api.ReporteeNode[]>([]);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [messages, setMessages] = useState<api.KpiDraftChatMessage[]>([]);
  const [draft, setDraft] = useState<api.KpiItem[]>([]);
  const [savedSets, setSavedSets] = useState<api.KpiSet[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getManagers().then(setManagers).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setEmployeeId(null);
    if (!managerId) {
      setReporteeTree([]);
      return;
    }
    api.getReporteeTree(managerId).then(setReporteeTree).catch((e) => setError(e.message));
  }, [managerId]);

  useEffect(() => {
    setMessages([]);
    setDraft([]);
    setSaveStatus("idle");
    if (!employeeId) {
      setSavedSets([]);
      return;
    }
    api.getKpiSets(employeeId).then(setSavedSets).catch((e) => setError(e.message));
  }, [employeeId]);

  const selectedEmployee = findInTree(reporteeTree, employeeId);
  const weightageSum = draft.reduce((sum, item) => sum + (Number(item.weightagePercent) || 0), 0);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !employeeId || chatLoading) return;
    const newHistory: api.KpiDraftChatMessage[] = [...messages, { role: "user", text: input.trim() }];
    setMessages(newHistory);
    setInput("");
    setChatLoading(true);
    setError(null);
    try {
      const result = await api.draftKpis({ employeeId, managerId, history: newHistory });
      setMessages([...newHistory, { role: "model", text: result.reply }]);
      setDraft(result.draftKpis);
      setSaveStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setChatLoading(false);
    }
  }

  function updateTextField(index: number, field: TextField, value: string) {
    setDraft((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function updateWeightage(index: number, value: string) {
    setDraft((prev) => prev.map((item, i) => (i === index ? { ...item, weightagePercent: Number(value) || 0 } : item)));
  }

  function removeRow(index: number) {
    setDraft((prev) => prev.filter((_, i) => i !== index));
  }

  function addRow() {
    setDraft((prev) => [...prev, { ...BLANK_ITEM, role: selectedEmployee?.role ?? "" }]);
  }

  async function handleSave() {
    if (!employeeId || draft.length === 0) return;
    setSaveStatus("saving");
    setError(null);
    try {
      const saved = await api.saveKpiSet({ employeeId, managerId, items: draft });
      setSavedSets((prev) => [saved, ...prev]);
      setDraft([]);
      setSaveStatus("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong saving.");
      setSaveStatus("error");
    }
  }

  return (
    <div className="kra-kpi-page">
      <aside className="kra-kpi-sidebar">
        <label className="manager-picker">
          Acting as manager
          <select value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            <option value="">Select a manager…</option>
            {managers.map((m) => (
              <option key={m.employeeId} value={m.employeeId}>
                {m.name} — {m.role}
              </option>
            ))}
          </select>
        </label>
        {managerId && (
          <div className="reportee-list">
            <h3>Reportees</h3>
            <ReporteeTree nodes={reporteeTree} selectedEmployeeId={employeeId} onSelect={setEmployeeId} />
          </div>
        )}
      </aside>

      <section className="kra-kpi-main">
        {!employeeId && <p className="kra-kpi-empty">Select a manager, then a reportee, to start drafting KPIs.</p>}

        {employeeId && selectedEmployee && (
          <>
            <h2>
              KRA/KPIs for {selectedEmployee.name} <span className="kra-kpi-role">({selectedEmployee.role})</span>
            </h2>
            {savedSets.length > 0 && (
              <p className="kra-kpi-history">
                {savedSets.length} previously saved KPI set{savedSets.length === 1 ? "" : "s"} for this employee
                (most recent: {new Date(savedSets[0].createdAt).toLocaleDateString()}).
              </p>
            )}

            <div className="kra-kpi-chat">
              <div className="kra-kpi-chat-history">
                {messages.length === 0 && (
                  <p className="chat-empty">
                    Describe this employee's priorities for the review period, and the assistant will draft KRA/KPI
                    rows in the standard format below.
                  </p>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`chat-message chat-message--${m.role === "user" ? "user" : "assistant"}`}>
                    <p>{m.text}</p>
                  </div>
                ))}
                {chatLoading && <div className="chat-message chat-message--assistant chat-message--loading">Drafting…</div>}
              </div>
              <form className="chat-input-row" onSubmit={handleSend}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="e.g. Focus on reducing churn and mentoring the two junior engineers…"
                  disabled={chatLoading}
                />
                <button type="submit" disabled={chatLoading || !input.trim()}>
                  Send
                </button>
              </form>
            </div>

            {draft.length > 0 && (
              <div className="kpi-table-wrap">
                <div className="kpi-table-header-row">
                  <h3>Draft KPIs</h3>
                  <span className={`weightage-total${weightageSum === 100 ? " weightage-total--ok" : " weightage-total--warn"}`}>
                    Weightage total: {weightageSum}% {weightageSum !== 100 && "(should be 100%)"}
                  </span>
                </div>
                <div className="kpi-table-scroll">
                  <table className="kpi-table">
                    <thead>
                      <tr>
                        {COLUMNS.map((col) => (
                          <th key={col.field}>{col.label}</th>
                        ))}
                        <th>Weightage %</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.map((item, i) => (
                        <tr key={i}>
                          {COLUMNS.map((col) => (
                            <td key={col.field}>
                              <input value={item[col.field]} onChange={(e) => updateTextField(i, col.field, e.target.value)} />
                            </td>
                          ))}
                          <td>
                            <input
                              type="number"
                              className="weightage-input"
                              value={item.weightagePercent}
                              onChange={(e) => updateWeightage(i, e.target.value)}
                            />
                          </td>
                          <td>
                            <button type="button" className="row-remove" onClick={() => removeRow(i)} aria-label="Remove row">
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="kpi-table-actions">
                  <button type="button" onClick={addRow}>
                    + Add row
                  </button>
                  <button type="button" className="save-button" onClick={handleSave} disabled={saveStatus === "saving"}>
                    {saveStatus === "saving" ? "Saving…" : "Save KPI set"}
                  </button>
                  {saveStatus === "saved" && <span className="save-success">Saved.</span>}
                </div>
              </div>
            )}
          </>
        )}

        {error && <div className="chat-error">{error}</div>}
      </section>
    </div>
  );
}
