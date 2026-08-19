import { Box, Divider, List, ListItemButton, ListItemIcon, ListItemText, Typography } from "@mui/material";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import { dims } from "../../theme/dims.js";
import { colors } from "../../theme/colors.styles.js";
import type { SessionUser } from "../../api/authClient.js";

export type View = "home" | "workforce-planning" | "kra-kpi" | "admin";

const NAV_ITEMS: Array<{ view: View; label: string; icon: JSX.Element }> = [
  { view: "workforce-planning", label: "Workforce Planning", icon: <ForumOutlinedIcon fontSize="small" /> },
  { view: "kra-kpi", label: "Set KRA/KPIs", icon: <AssignmentTurnedInOutlinedIcon fontSize="small" /> },
];

const ADMIN_NAV_ITEM: { view: View; label: string; icon: JSX.Element } = {
  view: "admin",
  label: "Admin",
  icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />,
};

interface SidebarProps {
  view: View;
  onNavigate: (view: View) => void;
  user: SessionUser;
  onLogout: () => void;
}

export default function Sidebar({ view, onNavigate, user, onLogout }: SidebarProps) {
  const navItems = user.isAdmin ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;
  return (
    <Box
      sx={{
        width: dims.sidebarWidth,
        flexShrink: 0,
        height: "100vh",
        borderRight: `1px solid ${colors.gray[200]}`,
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
      }}
    >
      <Box
        sx={{
          height: dims.pageHeaderHeight,
          display: "flex",
          alignItems: "center",
          px: 3,
          cursor: "pointer",
          borderBottom: `1px solid ${colors.gray[200]}`,
          flexShrink: 0,
        }}
        onClick={() => onNavigate("home")}
      >
        <Typography sx={{ fontWeight: 700, fontSize: "1.2rem", color: colors.primary.main, letterSpacing: "-0.01em" }}>
          RECYKAL
        </Typography>
      </Box>

      <List sx={{ flex: 1, px: 2, py: 2 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.view}
            selected={view === item.view}
            onClick={() => onNavigate(item.view)}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              color: colors.text.secondary,
              "&.Mui-selected": {
                backgroundColor: colors.chip.primary.bg,
                color: colors.primary.main,
                "& .MuiListItemIcon-root": { color: colors.primary.main },
              },
              "&.Mui-selected:hover": {
                backgroundColor: colors.chip.primary.bg,
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: "0.95rem", fontWeight: 500 }} />
          </ListItemButton>
        ))}
      </List>

      <Divider />
      <Box sx={{ p: 2.5 }}>
        <Typography variant="caption3" sx={{ color: colors.text.primary, display: "block" }}>
          {user.name}
        </Typography>
        <Typography sx={{ fontSize: "0.8rem", color: colors.text.muted, display: "block", mb: 1 }}>
          {user.role}
        </Typography>
        <Typography
          component="button"
          onClick={onLogout}
          sx={{
            fontSize: "0.8rem",
            color: colors.primary.main,
            cursor: "pointer",
            fontWeight: 600,
            border: "none",
            background: "none",
            p: 0,
          }}
        >
          Sign out
        </Typography>
      </Box>
    </Box>
  );
}
