import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/Download";
import * as api from "../api/kraKpiClient.js";
import * as chatApi from "../api/chatSessionClient.js";
import ReporteeTree from "./ReporteeTree.js";
import ChatInput from "./ChatInput.js";
import KraTableRow from "./KraTableRow.js";
import PageContainer from "../shared/components/PageContainer.js";
import PageHeader from "../shared/components/PageHeader.js";
import AppCard from "../shared/components/AppCard.js";
import AppChip from "../shared/components/AppChip.js";
import { colors } from "../theme/colors.styles.js";
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
    <PageContainer sx={{ pt: 0 }}>
      <PageHeader title="Set KRA/KPIs" caption="Draft KRA/KPIs for your reportees, in the standard org-wide format" />

      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <AppCard>
            <Typography variant="overline" sx={{ color: colors.text.caption, display: "block", mb: 1.5 }}>
              Your Reportees
            </Typography>
            <ReporteeTree nodes={reporteeTree} selectedEmployeeId={employeeId} onSelect={setEmployeeId} />
          </AppCard>
        </Grid>

        <Grid item xs={12} md={9}>
          {!employeeId && (
            <Typography variant="caption2" sx={{ color: colors.text.muted }}>
              Select a reportee to start drafting KPIs.
            </Typography>
          )}

          {employeeId && selectedEmployee && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Typography variant="subtitle2">
                KRA/KPIs for {selectedEmployee.name}{" "}
                <Typography component="span" variant="caption2" sx={{ color: colors.text.muted }}>
                  ({selectedEmployee.role})
                </Typography>
              </Typography>

              <AppCard sx={{ background: colors.gray[100] }}>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                  <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={handleNewChat}>
                    New chat
                  </Button>
                  {chatSessions.map((s) => (
                    <Chip
                      key={s.id}
                      label={s.title ?? "New conversation"}
                      onClick={() => handleSelectSession(s.id)}
                      variant={s.id === chatSessionId ? "filled" : "outlined"}
                      sx={
                        s.id === chatSessionId
                          ? { backgroundColor: colors.primary.main, color: "#fff" }
                          : { borderColor: colors.gray[300] }
                      }
                    />
                  ))}
                </Box>

                <Box
                  sx={{
                    background: "#fff",
                    borderRadius: "0.75rem",
                    border: `1px solid ${colors.gray[200]}`,
                    display: "flex",
                    flexDirection: "column",
                    height: 420,
                  }}
                >
                  <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 2.5 }}>
                    {messages.length === 0 && (
                      <Typography variant="caption2" sx={{ color: colors.text.muted }}>
                        Describe this employee's priorities for the review period, and the assistant will draft
                        KRA/KPI rows in the standard format below.
                      </Typography>
                    )}
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                      {messages.map((m, i) => (
                        <Box
                          key={i}
                          sx={{
                            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                            maxWidth: "85%",
                            px: 2,
                            py: 1,
                            borderRadius: "0.75rem",
                            backgroundColor: m.role === "user" ? colors.chip.primary.bg : colors.gray[50],
                          }}
                        >
                          <Typography variant="caption2" sx={{ whiteSpace: "pre-wrap" }}>
                            {m.text}
                          </Typography>
                        </Box>
                      ))}
                      {chatLoading && (
                        <Typography variant="caption2" sx={{ color: colors.text.muted, fontStyle: "italic" }}>
                          Drafting…
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  <Box sx={{ borderTop: `1px solid ${colors.gray[200]}`, p: 1.5 }}>
                    <ChatInput
                      value={input}
                      onChange={setInput}
                      onSubmit={handleSend}
                      attachments={attachments}
                      onAttachmentsChange={setAttachments}
                      placeholder="e.g. Focus on reducing churn and mentoring the two junior engineers… (Enter to send, Shift+Enter for a new line)"
                      disabled={chatLoading}
                    />
                  </Box>
                </Box>
              </AppCard>

              {draft.length > 0 && (
                <AppCard>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 1 }}>
                    <Typography variant="subtitle3">Draft KRAs</Typography>
                    <AppChip
                      label={`Weightage total: ${weightageSum}%${weightageSum !== 100 ? " (should be 100%)" : ""}`}
                      variant={weightageSum === 100 ? "success" : "warning"}
                    />
                  </Box>
                  <Typography variant="caption2" sx={{ color: colors.text.muted, display: "block", mb: 2 }}>
                    Click the chevron on a row to set H1/H2 goals, tracked metrics, and an optional checklist for
                    that KRA — these carry through to the downloaded scorecard.
                  </Typography>
                  <TableContainer sx={{ border: `1px solid ${colors.gray[200]}`, borderRadius: "0.75rem" }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {TABLE_HEADERS.map((label) => (
                            <TableCell key={label}>{label}</TableCell>
                          ))}
                          <TableCell />
                          <TableCell />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {draft.map((item, i) => (
                          <KraTableRow key={i} item={item} index={i} onChange={updateItem} onRemove={removeRow} />
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 2 }}>
                    <Button variant="outlined" startIcon={<AddIcon />} onClick={addRow}>
                      Add row
                    </Button>
                    <Button variant="contained" onClick={handleSave} disabled={saveStatus === "saving"}>
                      {saveStatus === "saving" ? "Saving…" : "Save KPI set"}
                    </Button>
                    {saveStatus === "saved" && (
                      <Typography variant="caption2" sx={{ color: colors.status.success.main, fontWeight: 600 }}>
                        Saved.
                      </Typography>
                    )}
                  </Box>
                </AppCard>
              )}

              {savedSets.length > 0 && (
                <AppCard>
                  <Typography variant="subtitle3" sx={{ mb: 1.5, display: "block" }}>
                    Saved KPI Sets for {selectedEmployee.name}
                  </Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {savedSets.map((set) => (
                      <Box
                        key={set.id}
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          border: `1px solid ${colors.gray[200]}`,
                          borderRadius: 2,
                          px: 2,
                          py: 1,
                        }}
                      >
                        <Typography variant="caption2" sx={{ color: colors.text.secondary }}>
                          {new Date(set.createdAt).toLocaleDateString()}
                        </Typography>
                        <Button
                          size="small"
                          startIcon={<DownloadIcon fontSize="small" />}
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
                        </Button>
                      </Box>
                    ))}
                  </Box>
                </AppCard>
              )}
            </Box>
          )}

          {error && (
            <Typography variant="caption2" sx={{ color: colors.status.error.main, display: "block", mt: 2 }}>
              {error}
            </Typography>
          )}
        </Grid>
      </Grid>
    </PageContainer>
  );
}
