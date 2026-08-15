import { Box, type SxProps, type Theme } from "@mui/material";
import type { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  sx?: SxProps<Theme>;
}

/** Wraps every page. Pass sx={{ pt: 0 }} when the first child is a PageHeader, so it sits flush at the top. */
export default function PageContainer({ children, sx }: PageContainerProps) {
  return (
    <Box sx={{ padding: "1.43rem", height: "100vh", overflow: "auto", boxSizing: "border-box", ...sx }}>
      {children}
    </Box>
  );
}
