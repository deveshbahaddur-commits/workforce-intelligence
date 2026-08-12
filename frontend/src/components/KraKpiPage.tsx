import { useEffect, useState } from "react";
import * as api from "../api/kraKpiClient.js";
import * as chatApi from "../api/chatSessionClient.js";
import ReporteeTree from "./ReporteeTree.js";
import ChatInput from "./ChatInput.js";
import { downloadScorecard } from "../utils/scorecardExport.js";

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
  const [chatSessions, setChatSessions] = useState<chatApi.ChatSessionSummary[]>([]);
  const [chatSessionId, setChatSessionId] = useState<number | null>(null);
  const [draft, setDraft] = useState<api.KpiItem[]>([]);
  const [savedSets, setSavedSets] = useState<api.KpiSet[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
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
    setChatSessionId(null);
    if (!employeeId) {
      setSavedSets([]);
      setChatSessions([]);
      return;
    }
    api.getKpiSets(employeeId).then(setSavedSets).catch((e) => setError(e.message));
    chatApi
      .listChatSessions({ kind: "kra-kpi", managerId, employeeId })
      .then(setChatSessions)
      .catch((e) => setError(e.message));
  }, [employeeId]);

  const selectedEmployee = findInTree(reporteeTree, employeeId);
  const weightageSum = draft.reduce((sum, item) => sum + (Number(item.weightagePercent) || 0), 0);

  async function ensureChatSession(): Promise<number> {
    if (chatSessionId) return chatSessionId;
    const created = await chatApi.createChatSession({ kind: "kra-kpi", managerId, employeeId });
    setChatSessionId(created.id);
    setChatSessions((prev) => [created, ...prev]);
    return created.id;
  }

  async function handleSelectSession(id: number) {
    setError(null);
    try {
      const session = await chatApi.getChatSession(id);
      setChatSessionId(session.id);
      setMessages(session.messages);
      setDraft([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load that chat.");
    }
  }

  function handleNewChat() {
    setChatSessionId(null);
    setMessages([]);
    setDraft([]);
    setInput("");
    setAttachments([]);
  }

  async function handleSend() {
    if ((!input.trim() && attachments.length === 0) || !employeeId || chatLoading) return;
    const text = input.trim();
    const attachmentNames = attachments.map((f) => f.name);
    const displayText = attachmentNames.length > 0 ? `${text}\n\n📎 ${attachmentNames.join(", ")}` : text;
    const newHistory: api.KpiDraftChatMessage[] = [...messages, { role: "user", text: displayText }];
    setMessages(newHistory);
    setInput("");
    setAttachments([]);
    setChatLoading(true);
    setError(null);
    try {
      const result = await api.draftKpis({ employeeId, managerId, history: newHistory });
      const withReply: api.KpiDraftChatMessage[] = [...newHistory, { role: "model", text: result.reply }];
      setMessages(withReply);
      setDraft(result.draftKpis);
      setSaveStatus("idle");
      try {
        const id = await ensureChatSession();
        const saved = await chatApi.saveChatSessionMessages(id, withReply);
        setChatSessions((prev) => [saved, ...prev.filter((s) => s.id !== saved.id)]);
      } catch (persistErr) {
        console.error("Failed to persist KRA/KPI chat session:", persistErr);
      }
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
              <div className="kra-kpi-history">
                <h3>Saved KPI sets</h3>
                <ul className="saved-set-list">
                  {savedSets.map((set) => (
                    <li key={set.id} className="saved-set-row">
                      <span>{new Date(set.createdAt).toLocaleDateString()}</span>
                      <button
                        type="button"
                        className="saved-set-download"
                        onClick={() =>
                          downloadScorecard(set.items, {
                            employee: {
                              name: set.employeeName,
                              role: selectedEmployee.role,
                              team: selectedEmployee.team,
                            },
                            managerName: set.managerName,
                            createdAt: set.createdAt,
                          })
                        }
                      >
                        Download scorecard
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="kra-kpi-chat-sessions">
              <button type="button" className="kra-kpi-session-pill kra-kpi-session-pill--new" onClick={handleNewChat}>
                + New chat
              </button>
              {chatSessions.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className={`kra-kpi-session-pill${s.id === chatSessionId ? " kra-kpi-session-pill--active" : ""}`}
                  onClick={() => handleSelectSession(s.id)}
                >
                  {s.title ?? "New conversation"}
                </button>
              ))}
            </div>

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
              <ChatInput
                value={input}
                onChange={setInput}
                onSubmit={handleSend}
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                placeholder="e.g. Focus on reducing churn and mentoring the two junior engineers… (Enter to send, Shift+Enter for a new line)"
                disabled={chatLoading}
              />
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
