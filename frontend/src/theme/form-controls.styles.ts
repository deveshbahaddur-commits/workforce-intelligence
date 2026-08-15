import { colors } from "./colors.styles.js";
import { dims } from "./dims.js";

export const formControlStyles = {
  height: dims.inputHeight,
  borderRadius: dims.inputBorderRadius,
  border: `1px solid ${colors.gray[300]}`,
  boxShadow: "0px 1px 2px 0px rgba(16, 24, 40, 0.05)",
  label: {
    fontWeight: 500,
    fontSize: "0.857rem",
    color: colors.text.secondary,
  },
  disabledBackground: "#F0F3F6",
};
