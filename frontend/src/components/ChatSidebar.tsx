import type { ChatSessionSummary } from "../api/chatSessionClient.js";

interface ChatSidebarProps {
  sessions: ChatSessionSummary[];
  activeSessionId: number | null;
  onSelect: (id: number) => void;
  onNewChat: () => void;
  onBackHome: () => void;
  disabled?: boolean;
}

function relativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ChatSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNewChat,
  onBackHome,
  disabled,
}: ChatSidebarProps) {
  return (
    <aside className="chat-sidebar">
      <button type="button" className="chat-sidebar-new" onClick={onNewChat} disabled={disabled}>
        + New chat
      </button>
      <div className="chat-sidebar-list">
        {sessions.length === 0 && <p className="chat-sidebar-empty">No past chats yet.</p>}
        {sessions.map((s) => (
          <button
            type="button"
            key={s.id}
            className={`chat-sidebar-item${s.id === activeSessionId ? " chat-sidebar-item--active" : ""}`}
            onClick={() => onSelect(s.id)}
          >
            <span className="chat-sidebar-item-title">{s.title ?? "New conversation"}</span>
            <span className="chat-sidebar-item-date">{relativeDate(s.updatedAt)}</span>
          </button>
        ))}
      </div>
      <div className="chat-sidebar-footer">
        <button type="button" className="chat-sidebar-option" onClick={onBackHome}>
          ← Home
        </button>
      </div>
    </aside>
  );
}
