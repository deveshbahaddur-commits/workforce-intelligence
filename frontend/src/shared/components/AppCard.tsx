import { Card, CardContent, type SxProps, type Theme } from "@mui/material";
import type { ReactNode } from "react";

interface AppCardProps {
  children: ReactNode;
  sx?: SxProps<Theme>;
  contentSx?: SxProps<Theme>;
  onClick?: () => void;
}

export default function AppCard({ children, sx, contentSx, onClick }: AppCardProps) {
  return (
    <Card
      variant="outlined"
      onClick={onClick}
      sx={{ cursor: onClick ? "pointer" : "default", ...sx }}
    >
      <CardContent sx={{ "&:last-child": { pb: 2.5 }, ...contentSx }}>{children}</CardContent>
    </Card>
  );
}
