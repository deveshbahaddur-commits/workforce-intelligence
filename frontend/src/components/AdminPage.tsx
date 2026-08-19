import { useEffect, useState } from "react";
import { Box, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import * as admin from "../api/adminClient.js";
import type { KpiSet } from "../api/kraKpiClient.js";
import ChatInput from "./ChatInput.js";
import PageContainer from "../shared/components/PageContainer.js";
import PageHeader from "../shared/components/PageHeader.js";
import AppCard from "../shared/components/AppCard.js";
import AppChip from "../shared/components/AppChip.js";
import { colors } from "../theme/colors.styles.js";
import { downloadScorecard } from "../utils/scorecardExport.js";

const VERDICT_LABEL: Record<admin.AlignmentResult["verdict"], string> = {
  aligned: "Aligned",
  partial: "Partially aligned",
  not_aligned: "Not aligned",
};

const VERDICT_VARIANT: Record<admin.AlignmentResult["verdict"], "success" | "warning" | "error"> = {
  aligned: "success",
  partial: "warning",
  not_aligned: "error",
};

export default function AdminPage() {
  const [employees, setEmployees] = useState<admin.AdminEmployee[]>([]);
  const [orgGoals, setOrgGoals] = useState<admin.OrgGoalSet | null>(null);
  const [messages, setMessages] = useState<admin.OrgGoalDraftChatMessage[]>([]);
  const [draftGoals, setDraftGoals] = useState<admin.OrgGoalItem[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [goalsSaveStatus, setGoalsSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [kpiSets, setKpiSets] = useState<KpiSet[]>([]);
  const [alignmentBySetId, setAlignmentBySetId] = useState<Record<number, admin.AlignmentResult[]>>({});
  const [alignmentLoadingSetId, setAlignmentLoadingSetId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    admin.getAllEmployees().then(setEmployees).catch((e) => setError(e.message));
    admin.getOrgGoals().then(setOrgGoals).catch((e) => setError(e.message));
    admin.getAllKpiSets().then(setKpiSets).catch((e) => setError(e.message));
  }, []);

  async function handleSendGoalsChat() {
    if ((!input.trim() && attachments.length === 0) || chatLoading) return;
    const text = input.trim();
    const attachmentNames = attachments.map((f) => f.name);
    const displayText = attachmentNames.length > 0 ? `${text}\n\n📎 ${attachmentNames.join(", ")}` : text;
    const newHistory: admin.OrgGoalDraftChatMessage[] = [...messages, { role: "user", text: displayText }];
    setMessages(newHistory);
    setInput("");
    setAttachments([]);
    setChatLoading(true);
    setError(null);
    try {
      const result = await admin.draftOrgGoals({ history: newHistory });
      setMessages([...newHistory, { role: "model", text: result.reply }]);
      setDraftGoals(result.draftGoals);
      setGoalsSaveStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setChatLoading(false);
    }
  }

  async function handleSaveGoals() {
    if (draftGoals.length === 0) return;
    setGoalsSaveStatus("saving");
    setError(null);
    try {
      const saved = await admin.saveOrgGoals(draftGoals);
      setOrgGoals(saved);
      setDraftGoals([]);
      setMessages([]);
      setGoalsSaveStatus("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong saving.");
      setGoalsSaveStatus("error");
    }
  }

  async function handleCheckAlignment(set: KpiSet) {
    setAlignmentLoadingSetId(set.id);
    setError(null);
    try {
      const { results } = await admin.checkAlignment(set.items);
      setAlignmentBySetId((prev) => ({ ...prev, [set.id]: results }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong checking alignment.");
    } finally {
      setAlignmentLoadingSetId(null);
    }
  }

  function handleDownload(set: KpiSet) {
    const employee = employees.find((e) => e.employeeId === set.employeeId);
    downloadScorecard(set.items, {
      employee: { name: set.employeeName, role: employee?.role ?? "", team: employee?.team },
      managerName: set.managerName,
      createdAt: set.createdAt,
    });
  }

  return (
    <PageContainer sx={{ pt: 0 }}>
      <PageHeader title="Admin" caption="Org goals, org-wide visibility into what people are building, and alignment checks" />

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <AppCard>
          <Typography variant="subtitle3" sx={{ display: "block", mb: 1 }}>
            Organisation Goals
          </Typography>
          {orgGoals ? (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
              {orgGoals.content.map((g, i) => (
                <Box
                  key={i}
                  sx={{ border: `1px solid ${colors.gray[200]}`, borderRadius: 2, px: 1.5, py: 1, maxWidth: 320 }}
                >
                  <Typography variant="caption3" sx={{ fontWeight: 700, display: "block" }}>
                    {g.title}
                  </Typography>
                  <Typography variant="caption2" sx={{ color: colors.text.muted }}>
                    {g.description}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="caption2" sx={{ color: colors.text.muted, display: "block", mb: 2 }}>
              No org goals saved yet. Use the chat below to draft them — every saved KRA can then be checked for
              alignment against these.
            </Typography>
          )}

          <Box
            sx={{
              background: "#fff",
              borderRadius: "0.75rem",
              border: `1px solid ${colors.gray[200]}`,
              display: "flex",
              flexDirection: "column",
              height: 340,
            }}
          >
            <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 2.5 }}>
              {messages.length === 0 && (
                <Typography variant="caption2" sx={{ color: colors.text.muted }}>
                  Describe the organisation's priorities for this review period, and the assistant will draft a
                  short list of goals below.
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
                onSubmit={handleSendGoalsChat}
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                placeholder="e.g. This year we're focused on cutting escalation SLA breaches and growing enterprise accounts…"
                disabled={chatLoading}
              />
            </Box>
          </Box>

          {draftGoals.length > 0 && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 2 }}>
              <Button variant="contained" onClick={handleSaveGoals} disabled={goalsSaveStatus === "saving"}>
                {goalsSaveStatus === "saving" ? "Saving…" : "Save org goals"}
              </Button>
              {goalsSaveStatus === "saved" && (
                <Typography variant="caption2" sx={{ color: colors.status.success.main, fontWeight: 600 }}>
                  Saved.
                </Typography>
              )}
            </Box>
          )}
        </AppCard>

        <AppCard>
          <Typography variant="subtitle3" sx={{ display: "block", mb: 1.5 }}>
            What People Are Building
          </Typography>
          {kpiSets.length === 0 ? (
            <Typography variant="caption2" sx={{ color: colors.text.muted }}>
              No KPI sets have been saved yet.
            </Typography>
          ) : (
            <TableContainer sx={{ border: `1px solid ${colors.gray[200]}`, borderRadius: "0.75rem" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Employee</TableCell>
                    <TableCell>Manager</TableCell>
                    <TableCell>Saved</TableCell>
                    <TableCell>KRAs</TableCell>
                    <TableCell>Alignment</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {kpiSets.map((set) => {
                    const results = alignmentBySetId[set.id];
                    return (
                      <TableRow key={set.id}>
                        <TableCell>{set.employeeName}</TableCell>
                        <TableCell>{set.managerName}</TableCell>
                        <TableCell>{new Date(set.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>{set.items.length}</TableCell>
                        <TableCell>
                          {results ? (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, maxWidth: 320 }}>
                              {results.map((r, i) => (
                                <Box key={i} sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
                                  <AppChip label={VERDICT_LABEL[r.verdict]} variant={VERDICT_VARIANT[r.verdict]} />
                                  <Typography variant="caption2" sx={{ color: colors.text.muted }}>
                                    {r.kra}
                                  </Typography>
                                </Box>
                              ))}
                            </Box>
                          ) : (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<FactCheckOutlinedIcon fontSize="small" />}
                              onClick={() => handleCheckAlignment(set)}
                              disabled={alignmentLoadingSetId === set.id}
                            >
                              {alignmentLoadingSetId === set.id ? "Checking…" : "Check alignment"}
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            startIcon={<DownloadIcon fontSize="small" />}
                            onClick={() => handleDownload(set)}
                          >
                            Download
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </AppCard>

        {error && (
          <Typography variant="caption2" sx={{ color: colors.status.error.main }}>
            {error}
          </Typography>
        )}
      </Box>
    </PageContainer>
  );
}
