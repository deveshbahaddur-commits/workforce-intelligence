import { Box, IconButton, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import type { ReactNode } from "react";
import { dims } from "../../theme/dims.js";
import { colors } from "../../theme/colors.styles.js";

interface PageHeaderProps {
  title: string;
  caption?: string;
  icon?: ReactNode;
  onBack?: () => void;
  children?: ReactNode;
}

/**
 * Must be a direct child of PageContainer (not wrapped in Box/Stack) —
 * the negative horizontal margins below cancel PageContainer's own
 * padding so this bleeds edge-to-edge, and PageContainer's sx={{ pt: 0 }}
 * is what makes it sit flush at the top (no margin trick needed there).
 */
export default function PageHeader({ title, caption, icon, onBack, children }: PageHeaderProps) {
  return (
    <Box
      sx={{
        height: dims.pageHeaderHeight,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 3,
        mx: "-1.43rem",
        mb: "30px",
        background: "#FAFBFF",
        borderBottom: `1px solid ${colors.gray[200]}`,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
        {onBack && (
          <IconButton onClick={onBack} size="small" aria-label="Back">
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        )}
        {icon}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" noWrap>
            {title}
          </Typography>
          {caption && (
            <Typography variant="caption2" sx={{ color: colors.text.secondary }}>
              {caption}
            </Typography>
          )}
        </Box>
      </Box>
      {children && <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexShrink: 0 }}>{children}</Box>}
    </Box>
  );
}
