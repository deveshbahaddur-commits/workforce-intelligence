import { useEffect, useState } from "react";
import { sendChatQuery } from "../api/chatClient.js";
import { getManagers, type ManagerOption } from "../api/kraKpiClient.js";
import * as chatApi from "../api/chatSessionClient.js";
import ChatInput from "./ChatInput.js";
import ChatSidebar from "./ChatSidebar.js";

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

function toChatMessages(sessionMessages: chatApi.ChatSessionMessage[]): ChatMessage[] {
  return sessionMessages.map((m) => ({ role: m.role === "user" ? "user" : "assistant", text: m.text }));
}

interface ChatWindowProps {
  onBackHome: () => void;
}

export default function ChatWindow({ onBackHome }: ChatWindowProps) {
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [managerId, setManagerId] = useState("");
  const [sessions, setSessions] = useState<chatApi.ChatSessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getManagers().then(setManagers).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setSessionId(null);
    setMessages([]);
    if (!managerId) {
      setSessions([]);
      return;
    }
    chatApi
      .listChatSessions({ kind: "workforce-planning", managerId })
      .then(setSessions)
      .catch((e) => setError(e.message));
  }, [managerId]);

  async function ensureSession(): Promise<number> {
    if (sessionId) return sessionId;
    const created = await chatApi.createChatSession({ kind: "workforce-planning", managerId });
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
    if (!managerId) return;
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
      if (managerId) await persist(withReply);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat-shell chat-theme-dark">
      <div className="chat-sidebar-wrap">
        <label className="manager-picker chat-sidebar-manager">
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
        <ChatSidebar
          sessions={sessions}
          activeSessionId={sessionId}
          onSelect={handleSelectSession}
          onNewChat={handleNewChat}
          onBackHome={onBackHome}
          disabled={!managerId}
        />
      </div>

      <div className="chat-main">
        <div className="chat-history">
          <div className="chat-history-inner">
            {messages.length === 0 && (
              <p className="chat-empty">
                Ask a workforce planning question, e.g. "Should I hire for the open Data Engineer role?" or "What's
                my Platform team's headcount and tenure look like?"
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chat-message chat-message--${m.role}`}>
                {m.role === "assistant" && m.posture && (
                  <span className={`posture-badge posture-badge--${m.posture}`}>
                    {POSTURE_LABELS[m.posture] ?? m.posture} · {m.decisionType?.replace(/_/g, " ")}
                  </span>
                )}
                <p>{m.text}</p>
              </div>
            ))}
            {loading && <div className="chat-message chat-message--assistant chat-message--loading">Thinking…</div>}
            {error && <div className="chat-error">{error}</div>}
          </div>
        </div>
        <div className="chat-input-area">
          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={handleSend}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            placeholder="Ask a workforce planning question… (Enter to send, Shift+Enter for a new line)"
            disabled={loading}
          />
        </div>
      </div>
    </div>
  );
}
