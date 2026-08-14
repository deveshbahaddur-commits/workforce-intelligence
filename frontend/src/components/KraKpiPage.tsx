import { useEffect, useState } from "react";
import * as api from "../api/kraKpiClient.js";
import * as chatApi from "../api/chatSessionClient.js";
import ReporteeTree from "./ReporteeTree.js";
import ChatInput from "./ChatInput.js";
import KraTableRow from "./KraTableRow.js";
import { downloadScorecard } from "../utils/scorecardExport.js";

const BLANK_ITEM: api.KpiItem = {
  role: "",
  kra: "",
  goalAnnual: "",
  goalH1: "",
  goalH2: "",
  kpiTask: "",
  weightagePercent: 0,
  sourceOfTracking: "",
  ratingNeedsImprovement: "",
  ratingBelowExpectation: "",
  ratingMeetsExpectation: "",
  ratingAboveExpectation: "",
  ratingExceedsExpectation: "",
  metrics: [],
  checklist: [],
  defined: false,
};

const TABLE_HEADERS = [
  "Role",
  "KRA",
  "KPI",
  "Goal (Annual)",
  "Source of Tracking",
  "1 - Needs Improvement",
  "2 - Below Expectation",
  "3 - Meets Expectation",
  "4 - Above Expectation",
  "5 - Exceeds Expectation",
  "Weightage %",
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
    api.getReporteeTree().then(setReporteeTree).catch((e) => setError(e.message));
  }, []);

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
      .listChatSessions({ kind: "kra-kpi", employeeId })
      .then(setChatSessions)
      .catch((e) => setError(e.message));
  }, [employeeId]);

  const selectedEmployee = findInTree(reporteeTree, employeeId);
  const weightageSum = draft.reduce((sum, item) => sum + (Number(item.weightagePercent) || 0), 0);

  async function ensureChatSession(): Promise<number> {
    if (chatSessionId) return chatSessionId;
    const created = await chatApi.createChatSession({ kind: "kra-kpi", employeeId });
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
      const result = await api.draftKpis({ employeeId, history: newHistory });
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

  function updateItem(index: number, item: api.KpiItem) {
    setDraft((prev) => prev.map((existing, i) => (i === index ? item : existing)));
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
      const saved = await api.saveKpiSet({ employeeId, items: draft });
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
        <div className="reportee-list">
          <h3>Your Reportees</h3>
          <ReporteeTree nodes={reporteeTree} selectedEmployeeId={employeeId} onSelect={setEmployeeId} />
        </div>
      </aside>

      <section className="kra-kpi-main">
        {!employeeId && <p className="kra-kpi-empty">Select a reportee to start drafting KPIs.</p>}

        {employeeId && selectedEmployee && (
          <>
            <h2>
              KRA/KPIs for {selectedEmployee.name} <span className="kra-kpi-role">({selectedEmployee.role})</span>
            </h2>

            <div className="kra-kpi-chat-wrap chat-theme-dark">
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
                      Describe this employee's priorities for the review period, and the assistant will draft
                      KRA/KPI rows in the standard format below.
                    </p>
                  )}
                  {messages.map((m, i) => (
                    <div key={i} className={`chat-message chat-message--${m.role === "user" ? "user" : "assistant"}`}>
                      <p>{m.text}</p>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="chat-message chat-message--assistant chat-message--loading">Drafting…</div>
                  )}
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
            </div>

            {draft.length > 0 && (
              <div className="kra-cards-wrap">
                <div className="kpi-table-header-row">
                  <h3>Draft KRAs</h3>
                  <span className={`weightage-total${weightageSum === 100 ? " weightage-total--ok" : " weightage-total--warn"}`}>
                    Weightage total: {weightageSum}% {weightageSum !== 100 && "(should be 100%)"}
                  </span>
                </div>
                <p className="kra-details-hint">
                  Click "Details" on a row to set H1/H2 goals, tracked metrics, and an optional checklist for that
                  KRA — these carry through to the downloaded scorecard.
                </p>
                <div className="kpi-table-scroll">
                  <table className="kpi-table">
                    <thead>
                      <tr>
                        {TABLE_HEADERS.map((label) => (
                          <th key={label}>{label}</th>
                        ))}
                        <th></th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.map((item, i) => (
                        <KraTableRow key={i} item={item} index={i} onChange={updateItem} onRemove={removeRow} />
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

            {savedSets.length > 0 && (
              <section className="kra-kpi-saved-section">
                <h3>Saved KPI Sets for {selectedEmployee.name}</h3>
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
              </section>
            )}
          </>
        )}

        {error && <div className="chat-error">{error}</div>}
      </section>
    </div>
  );
}
