// Base 1rem = 14px (set via theme.ts typography.fontSize), so the rem
// values below match the design guide's px annotations at that base.
export const typographyVariants = {
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: 14,
  subtitle1: { fontSize: "1.675rem", fontWeight: 600 }, // 24px — page titles
  subtitle2: { fontSize: "1.25rem", fontWeight: 600 }, // 18px — section titles
  subtitle3: { fontSize: "1rem", fontWeight: 600 }, // 14px — card titles
  caption: { fontSize: "0.875rem", fontWeight: 400 }, // 12px — small labels
  caption2: { fontSize: "1rem", fontWeight: 400 }, // 14px — descriptions
  caption3: { fontSize: "1rem", fontWeight: 600 }, // 14px — bold captions
  h1: { fontSize: "1.714rem", fontWeight: 700 }, // 24px
  h2: { fontSize: "1.571rem", fontWeight: 600 }, // 22px
  overline: { fontWeight: 500 },
} as const;
