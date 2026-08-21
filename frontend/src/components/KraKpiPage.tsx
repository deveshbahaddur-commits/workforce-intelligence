import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Grid,
  List,
  ListItemButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/Download";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import SearchIcon from "@mui/icons-material/Search";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import * as api from "../api/kraKpiClient.js";
import * as chatApi from "../api/chatSessionClient.js";
import * as adminApi from "../api/adminClient.js";
import ReporteeTree from "./ReporteeTree.js";
import ChatInput from "./ChatInput.js";
import KraTableRow from "./KraTableRow.js";
import PageContainer from "../shared/components/PageContainer.js";
import PageHeader from "../shared/components/PageHeader.js";
import AppCard from "../shared/components/AppCard.js";
import AppChip from "../shared/components/AppChip.js";
import { colors } from "../theme/colors.styles.js";
import { downloadScorecard } from "../utils/scorecardExport.js";
import type { SessionUser } from "../api/authClient.js";

interface SelectedSubject {
  employeeId: string;
  name: string;
  role: string;
  team?: string;
}

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

interface KraKpiPageProps {
  user: SessionUser;
}

export default function KraKpiPage({ user }: KraKpiPageProps) {
  const [reporteeTree, setReporteeTree] = useState<api.ReporteeNode[]>([]);
  const [allEmployees, setAllEmployees] = useState<adminApi.AdminEmployee[]>([]);
  const [bpEmployees, setBpEmployees] = useState<api.BpEmployee[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [bpSearch, setBpSearch] = useState("");
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
    if (user.isAdmin) {
      adminApi.getAllEmployees().then(setAllEmployees).catch((e) => setError(e.message));
    }
    if (user.bpFunctions.length > 0) {
      api.getBpEmployees().then(setBpEmployees).catch((e) => setError(e.message));
    }
  }, [user.isAdmin, user.bpFunctions]);

  const selectedFromAll = allEmployees.find((e) => e.employeeId === employeeId);
  const selectedFromBp = bpEmployees.find((e) => e.employeeId === employeeId);
  const selectedOutsideTree = selectedFromAll ?? selectedFromBp;
  const foundInTree = findInTree(reporteeTree, employeeId);
  const selectedEmployee: SelectedSubject | null =
    employeeId === user.employeeId
      ? { employeeId: user.employeeId, name: user.name, role: user.role }
      : foundInTree ??
        (selectedOutsideTree
          ? {
              employeeId: selectedOutsideTree.employeeId,
              name: selectedOutsideTree.name,
              role: selectedOutsideTree.role,
              team: selectedOutsideTree.team,
            }
          : null);

  // Mirrors the backend's canSetKrasFor exactly: self, admin, BP-in-scope,
  // or a DIRECT report only — an indirect report (depth > 1 in the
  // reportee tree) is read-only, per PRD v3 §6.
  const canEdit =
    employeeId === user.employeeId ||
    user.isAdmin ||
    selectedFromBp !== undefined ||
    (foundInTree !== null && foundInTree.depth === 1);

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
    if (canEdit) {
      chatApi
        .listChatSessions({ kind: "kra-kpi", employeeId })
        .then(setChatSessions)
        .catch((e) => setError(e.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, canEdit]);

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
      <PageHeader title="Set KRA/KPIs" caption="Draft KRA/KPIs for yourself or your reportees, in the standard org-wide format" />

      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <AppCard>
            <List sx={{ p: 0, mb: 1.5 }}>
              <ListItemButton
                selected={employeeId === user.employeeId}
                onClick={() => setEmployeeId(user.employeeId)}
                sx={{
                  borderRadius: 2,
                  gap: 0.5,
                  "&.Mui-selected": { backgroundColor: colors.chip.primary.bg },
                  "&.Mui-selected:hover": { backgroundColor: colors.chip.primary.bg },
                }}
              >
                <PersonOutlineIcon fontSize="small" sx={{ color: colors.text.muted, mr: 1 }} />
                <Typography variant="caption3" sx={{ color: colors.text.primary }}>
                  Set Your Own KRA/KPIs
                </Typography>
              </ListItemButton>
            </List>
            <Typography variant="overline" sx={{ color: colors.text.caption, display: "block", mb: 1.5 }}>
              Your Reportees
            </Typography>
            <ReporteeTree nodes={reporteeTree} selectedEmployeeId={employeeId} onSelect={setEmployeeId} />
          </AppCard>

          {user.isAdmin && (
            <AppCard sx={{ mt: 2 }}>
              <Typography variant="overline" sx={{ color: colors.text.caption, display: "block", mb: 1.5 }}>
                All Employees (Admin)
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by name…"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ color: colors.text.muted, mr: 1 }} /> }}
                sx={{ mb: 1 }}
              />
              {employeeSearch.trim() && (
                <List sx={{ p: 0, maxHeight: 260, overflowY: "auto" }}>
                  {allEmployees
                    .filter((e) => e.name.toLowerCase().includes(employeeSearch.trim().toLowerCase()))
                    .slice(0, 30)
                    .map((e) => (
                      <ListItemButton
                        key={e.employeeId}
                        selected={employeeId === e.employeeId}
                        onClick={() => setEmployeeId(e.employeeId)}
                        sx={{
                          borderRadius: 2,
                          mb: 0.25,
                          "&.Mui-selected": { backgroundColor: colors.chip.primary.bg },
                          "&.Mui-selected:hover": { backgroundColor: colors.chip.primary.bg },
                        }}
                      >
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="caption3" noWrap sx={{ color: colors.text.primary, display: "block" }}>
                            {e.name}
                          </Typography>
                          <Typography variant="caption" noWrap sx={{ color: colors.text.muted }}>
                            {e.role} · {e.team}
                          </Typography>
                        </Box>
                      </ListItemButton>
                    ))}
                </List>
              )}
            </AppCard>
          )}

          {user.bpFunctions.length > 0 && (
            <AppCard sx={{ mt: 2 }}>
              <Typography variant="overline" sx={{ color: colors.text.caption, display: "block", mb: 1.5 }}>
                Your Functions (BP)
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by name…"
                value={bpSearch}
                onChange={(e) => setBpSearch(e.target.value)}
                InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ color: colors.text.muted, mr: 1 }} /> }}
                sx={{ mb: 1 }}
              />
              {bpSearch.trim() && (
                <List sx={{ p: 0, maxHeight: 260, overflowY: "auto" }}>
                  {bpEmployees
                    .filter((e) => e.name.toLowerCase().includes(bpSearch.trim().toLowerCase()))
                    .slice(0, 30)
                    .map((e) => (
                      <ListItemButton
                        key={e.employeeId}
                        selected={employeeId === e.employeeId}
                        onClick={() => setEmployeeId(e.employeeId)}
                        sx={{
                          borderRadius: 2,
                          mb: 0.25,
                          "&.Mui-selected": { backgroundColor: colors.chip.primary.bg },
                          "&.Mui-selected:hover": { backgroundColor: colors.chip.primary.bg },
                        }}
                      >
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="caption3" noWrap sx={{ color: colors.text.primary, display: "block" }}>
                            {e.name}
                          </Typography>
                          <Typography variant="caption" noWrap sx={{ color: colors.text.muted }}>
                            {e.role} · {e.team}
                          </Typography>
                        </Box>
                      </ListItemButton>
                    ))}
                </List>
              )}
            </AppCard>
          )}
        </Grid>

        <Grid item xs={12} md={9}>
          {!employeeId && (
            <Typography variant="caption2" sx={{ color: colors.text.muted }}>
              Select a reportee, or "Set Your Own KRA/KPIs", to start drafting.
            </Typography>
          )}

          {employeeId && selectedEmployee && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                <Typography variant="subtitle2">
                  KRA/KPIs for {selectedEmployee.name}{" "}
                  <Typography component="span" variant="caption2" sx={{ color: colors.text.muted }}>
                    ({selectedEmployee.role})
                  </Typography>
                </Typography>
                {!canEdit && (
                  <AppChip
                    label="Read-only · reporting chain"
                    variant="warning"
                  />
                )}
              </Box>

              {!canEdit && (
                <Box
                  sx={{
                    display: "flex",
                    gap: 1.25,
                    alignItems: "flex-start",
                    border: `1px solid ${colors.gray[300]}`,
                    background: colors.gray[50],
                    borderRadius: 2,
                    px: 2,
                    py: 1.5,
                  }}
                >
                  <InfoOutlinedIcon fontSize="small" sx={{ color: colors.text.muted, mt: "1px" }} />
                  <Typography variant="caption2" sx={{ color: colors.text.secondary }}>
                    You're viewing this read-only because {selectedEmployee.name} is further down your reporting
                    chain, not a direct report — only their direct manager can draft or edit their KRA/KPIs. This
                    list may also be incomplete: if someone you'd expect to see under a direct report isn't showing
                    up, their record (or someone above them in the chain) may have a missing or incorrect reporting-
                    manager entry in the HRIS data, which breaks the chain silently rather than showing an error.
                  </Typography>
                </Box>
              )}

              {canEdit && (
              <>
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
              </>
              )}

              {savedSets.length > 0 ? (
                <AppCard>
                  <Typography variant="subtitle3" sx={{ mb: 1.5, display: "block" }}>
                    {canEdit ? "Saved KPI Sets for " : "Finalized scorecards for "}
                    {selectedEmployee.name}
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
              ) : (
                !canEdit && (
                  <Typography variant="caption2" sx={{ color: colors.text.muted }}>
                    No finalized scorecards yet for {selectedEmployee.name}.
                  </Typography>
                )
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
