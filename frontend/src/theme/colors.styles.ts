export const colors = {
  primary: {
    main: "#004EEB",
    dark600: "#155EEF",
    darker: "#00359E",
  },
  text: {
    primary: "#101828",
    secondary: "#344054",
    caption: "#475467",
    disabled: "#787486",
    label: "#5D5E74",
    muted: "#667085",
    placeholder: "#98A2B3",
  },
  background: {
    default: "#F6F6F6",
  },
  gray: {
    50: "#F9FAFB",
    100: "#F2F4F7",
    200: "#EAECF0",
    300: "#D0D5DD",
  },
  status: {
    success: { main: "#059669", background: "#F0FDF4" },
    warning: { main: "#F59E0B", background: "#FFFBEB" },
    error: { main: "#DC2626", background: "#FEF2F2" },
    info: { main: "#2563EB", background: "#EFF6FF" },
  },
  chip: {
    primary: { bg: "#EFF8FF", text: "#004EEB", border: "#B2DDFF" },
    success: { bg: "#ECFDF3", text: "#067647", border: "#ABEFC6" },
    warning: { bg: "#FEDF89", text: "#B54708" },
    error: { bg: "#FEF2F2", text: "#D92D20" },
  },
  actionBanner: { border: "#FEDF89", background: "#FFFAEB" },
} as const;
