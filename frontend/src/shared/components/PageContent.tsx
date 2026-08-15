import { Box, type SxProps, type Theme } from "@mui/material";
import type { ReactNode } from "react";

interface PageContentProps {
  children: ReactNode;
  sx?: SxProps<Theme>;
}

/** Scrollable page content area, below a PageHeader. */
export default function PageContent({ children, sx }: PageContentProps) {
  return <Box sx={{ display: "flex", flexDirection: "column", gap: 2, ...sx }}>{children}</Box>;
}
