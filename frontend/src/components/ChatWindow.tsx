import { useState } from "react";
import { sendChatQuery } from "../api/chatClient.js";

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

export default function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = input.trim();
    if (!query || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: query }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const result = await sendChatQuery(query);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: result.response,
          decisionType: result.decisionType,
          posture: result.posture,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat-window">
      <div className="chat-history">
        {messages.length === 0 && (
          <p className="chat-empty">
            Ask a workforce planning question, e.g. "Should I hire for the open Data Engineer role?" or "What's my
            Platform team's headcount and tenure look like?"
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
      <form className="chat-input-row" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a workforce planning question…"
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
