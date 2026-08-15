import { colors } from "./colors.styles.js";

export const tableStyles = {
  headCell: {
    background: colors.gray[100],
    color: colors.text.caption,
    fontWeight: 500,
    fontSize: "0.857rem", // 12px
    height: "2.75rem",
  },
  bodyCell: {
    fontSize: "1rem", // 14px
    padding: "6px 16px",
    height: "3.75rem",
  },
  rowHover: "#FCF3DF",
  borderColor: colors.gray[200],
};
