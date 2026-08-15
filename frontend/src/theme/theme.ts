import { createTheme } from "@mui/material/styles";
import { colors } from "./colors.styles.js";
import { typographyVariants } from "./font.js";
import { dims } from "./dims.js";

// MUI's Typography only knows its built-in variant names out of the box —
// the design guide names three more (subtitle3, caption2, caption3), so
// they need to be declared here before `variant="caption2"` etc. type-checks.
declare module "@mui/material/styles" {
  interface TypographyVariants {
    subtitle3: React.CSSProperties;
    caption2: React.CSSProperties;
    caption3: React.CSSProperties;
  }
  interface TypographyVariantsOptions {
    subtitle3?: React.CSSProperties;
    caption2?: React.CSSProperties;
    caption3?: React.CSSProperties;
  }
}
declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    subtitle3: true;
    caption2: true;
    caption3: true;
  }
}

export const theme = createTheme({
  palette: {
    primary: {
      main: colors.primary.main,
      dark: colors.primary.darker,
    },
    text: {
      primary: colors.text.primary,
      secondary: colors.text.secondary,
      disabled: colors.text.disabled,
    },
    background: {
      default: colors.background.default,
      paper: "#ffffff",
    },
    success: { main: colors.status.success.main },
    warning: { main: colors.status.warning.main },
    error: { main: colors.status.error.main },
    info: { main: colors.status.info.main },
    grey: {
      50: colors.gray[50],
      100: colors.gray[100],
      200: colors.gray[200],
      300: colors.gray[300],
    },
  },
  spacing: 8,
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: typographyVariants.fontFamily,
    fontSize: typographyVariants.fontSize,
    subtitle1: typographyVariants.subtitle1,
    subtitle2: typographyVariants.subtitle2,
    subtitle3: typographyVariants.subtitle3,
    caption: typographyVariants.caption,
    caption2: typographyVariants.caption2,
    caption3: typographyVariants.caption3,
    h1: typographyVariants.h1,
    h2: typographyVariants.h2,
    overline: typographyVariants.overline,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: colors.background.default },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          height: dims.buttonHeight,
          borderRadius: dims.inputBorderRadius,
          fontWeight: 600,
          textTransform: "capitalize",
          boxShadow: "none",
        },
        outlined: {
          borderColor: colors.gray[300],
          color: colors.text.secondary,
        },
      },
      defaultProps: { disableElevation: true },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: "0.75rem",
          boxShadow: "0px 1px 2px 0px rgba(16, 24, 40, 0.05)",
        },
      },
      defaultProps: { variant: "outlined" },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          height: dims.inputHeight,
          borderRadius: dims.inputBorderRadius,
          boxShadow: "0px 1px 2px 0px rgba(16, 24, 40, 0.05)",
        },
        notchedOutline: {
          borderColor: colors.gray[300],
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          background: colors.gray[100],
          color: colors.text.caption,
          fontWeight: 500,
          fontSize: "0.857rem",
        },
        root: {
          borderColor: colors.gray[200],
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
  },
});
