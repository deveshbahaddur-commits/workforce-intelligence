import { Chip } from "@mui/material";
import { colors } from "../../theme/colors.styles.js";

type ChipVariant = "primary" | "success" | "warning" | "error";

interface AppChipProps {
  label: string;
  variant?: ChipVariant;
  onDelete?: () => void;
  size?: "small" | "medium";
}

export default function AppChip({ label, variant = "primary", onDelete, size = "small" }: AppChipProps) {
  const palette = colors.chip[variant];
  return (
    <Chip
      label={label}
      onDelete={onDelete}
      size={size}
      sx={{
        backgroundColor: palette.bg,
        color: palette.text,
        border: "border" in palette ? `1px solid ${palette.border}` : "none",
      }}
    />
  );
}
