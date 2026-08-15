import { Box, Button, List, ListItemButton, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import type { ChatSessionSummary } from "../api/chatSessionClient.js";
import { colors } from "../theme/colors.styles.js";

interface ChatSidebarProps {
  sessions: ChatSessionSummary[];
  activeSessionId: number | null;
  onSelect: (id: number) => void;
  onNewChat: () => void;
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

export default function ChatSidebar({ sessions, activeSessionId, onSelect, onNewChat, disabled }: ChatSidebarProps) {
  return (
    <Box sx={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", height: "100%", p: 2 }}>
      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={onNewChat}
        disabled={disabled}
        fullWidth
        sx={{ mb: 2, justifyContent: "flex-start" }}
      >
        New chat
      </Button>
      <List sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 0 }}>
        {sessions.length === 0 && (
          <Typography variant="caption2" sx={{ color: colors.text.placeholder }}>
            No past chats yet.
          </Typography>
        )}
        {sessions.map((s) => (
          <ListItemButton
            key={s.id}
            selected={s.id === activeSessionId}
            onClick={() => onSelect(s.id)}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              flexDirection: "column",
              alignItems: "flex-start",
              "&.Mui-selected": { backgroundColor: colors.chip.primary.bg },
              "&.Mui-selected:hover": { backgroundColor: colors.chip.primary.bg },
            }}
          >
            <Typography
              variant="caption3"
              sx={{ color: colors.text.primary, width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {s.title ?? "New conversation"}
            </Typography>
            <Typography variant="caption" sx={{ color: colors.text.muted }}>
              {relativeDate(s.updatedAt)}
            </Typography>
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}
