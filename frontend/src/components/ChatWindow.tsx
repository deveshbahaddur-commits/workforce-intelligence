import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { sendChatQuery } from "../api/chatClient.js";
import * as chatApi from "../api/chatSessionClient.js";
import ChatInput from "./ChatInput.js";
import ChatSidebar from "./ChatSidebar.js";
import PageContainer from "../shared/components/PageContainer.js";
import PageHeader from "../shared/components/PageHeader.js";
import AppChip from "../shared/components/AppChip.js";
import { colors } from "../theme/colors.styles.js";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  decisionType?: string;
  posture?: string;
}

const POSTURE_LABELS: Record<string, string> = {
  recommend_freely: "Recommends",
  recommend_with_signoff: "Recommends — needs sign-off",
  analysis_only: "Analysis only",
  flag_and_route: "Flagged → HR/Legal",
};

const POSTURE_CHIP_VARIANT: Record<string, "success" | "warning" | "error"> = {
  recommend_freely: "success",
  recommend_with_signoff: "warning",
  analysis_only: "warning",
  flag_and_route: "error",
};

function toChatMessages(sessionMessages: chatApi.ChatSessionMessage[]): ChatMessage[] {
  return sessionMessages.map((m) => ({ role: m.role === "user" ? "user" : "assistant", text: m.text }));
}

export default function ChatWindow() {
  const [sessions, setSessions] = useState<chatApi.ChatSessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    chatApi
      .listChatSessions({ kind: "workforce-planning" })
      .then(setSessions)
      .catch((e) => setError(e.message));
  }, []);

  async function ensureSession(): Promise<number> {
    if (sessionId) return sessionId;
    const created = await chatApi.createChatSession({ kind: "workforce-planning" });
    setSessionId(created.id);
    setSessions((prev) => [{ ...created }, ...prev]);
    return created.id;
  }

  async function handleSelectSession(id: number) {
    setError(null);
    try {
      const session = await chatApi.getChatSession(id);
      setSessionId(session.id);
      setMessages(toChatMessages(session.messages));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load that chat.");
    }
  }

  function handleNewChat() {
    setSessionId(null);
    setMessages([]);
    setInput("");
    setAttachments([]);
  }

  async function persist(nextMessages: ChatMessage[]) {
    try {
      const id = await ensureSession();
      const saved = await chatApi.saveChatSessionMessages(
        id,
        nextMessages.map((m) => ({ role: m.role === "user" ? "user" : "model", text: m.text })),
      );
      setSessions((prev) => {
        const rest = prev.filter((s) => s.id !== saved.id);
        return [saved, ...rest];
      });
    } catch (e) {
      console.error("Failed to persist chat session:", e);
    }
  }

  async function handleSend() {
    const query = input.trim();
    if ((!query && attachments.length === 0) || loading) return;
    const attachmentNames = attachments.map((f) => f.name);
    const displayText = attachmentNames.length > 0 ? `${query}\n\n📎 ${attachmentNames.join(", ")}` : query;

    const withUser = [...messages, { role: "user" as const, text: displayText }];
    setMessages(withUser);
    setInput("");
    setAttachments([]);
    setLoading(true);
    setError(null);

    try {
      const result = await sendChatQuery(query || `[Attached: ${attachmentNames.join(", ")}]`);
      const withReply = [
        ...withUser,
        {
          role: "assistant" as const,
          text: result.response,
          decisionType: result.decisionType,
          posture: result.posture,
        },
      ];
      setMessages(withReply);
      await persist(withReply);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer sx={{ pt: 0, display: "flex", flexDirection: "column" }}>
      <PageHeader title="Workforce Planning" caption="Grounded in live HRIS data, guardrail-gated by decision type" />
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", gap: 2 }}>
        <Box sx={{ border: `1px solid ${colors.gray[200]}`, borderRadius: "0.75rem", overflow: "hidden" }}>
          <ChatSidebar sessions={sessions} activeSessionId={sessionId} onSelect={handleSelectSession} onNewChat={handleNewChat} />
        </Box>

        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            border: `1px solid ${colors.gray[200]}`,
            borderRadius: "0.75rem",
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 3 }}>
            <Box sx={{ maxWidth: 720, mx: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
              {messages.length === 0 && (
                <Typography variant="caption2" sx={{ color: colors.text.muted }}>
                  Ask a workforce planning question, e.g. "Should I hire for the open Data Engineer role?" or "What's
                  my Platform team's headcount and tenure look like?"
                </Typography>
              )}
              {messages.map((m, i) => (
                <Box key={i} sx={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                  {m.role === "assistant" && m.posture && (
                    <Box sx={{ mb: 0.5 }}>
                      <AppChip
                        label={`${POSTURE_LABELS[m.posture] ?? m.posture} · ${m.decisionType?.replace(/_/g, " ") ?? ""}`}
                        variant={POSTURE_CHIP_VARIANT[m.posture] ?? "primary"}
                      />
                    </Box>
                  )}
                  <Box
                    sx={{
                      px: 2,
                      py: 1.25,
                      borderRadius: "0.75rem",
                      borderBottomRightRadius: m.role === "user" ? 4 : "0.75rem",
                      borderBottomLeftRadius: m.role === "assistant" ? 4 : "0.75rem",
                      backgroundColor: m.role === "user" ? colors.chip.primary.bg : colors.gray[50],
                      color: colors.text.primary,
                    }}
                  >
                    <Typography variant="caption2" sx={{ whiteSpace: "pre-wrap" }}>
                      {m.text}
                    </Typography>
                  </Box>
                </Box>
              ))}
              {loading && (
                <Typography variant="caption2" sx={{ color: colors.text.muted, fontStyle: "italic" }}>
                  Thinking…
                </Typography>
              )}
              {error && (
                <Typography variant="caption2" sx={{ color: colors.status.error.main }}>
                  {error}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ borderTop: `1px solid ${colors.gray[200]}`, p: 2 }}>
            <Box sx={{ maxWidth: 720, mx: "auto" }}>
              <ChatInput
                value={input}
                onChange={setInput}
                onSubmit={handleSend}
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                placeholder="Ask a workforce planning question… (Enter to send, Shift+Enter for a new line)"
                disabled={loading}
              />
            </Box>
          </Box>
        </Box>
      </Box>
    </PageContainer>
  );
}
