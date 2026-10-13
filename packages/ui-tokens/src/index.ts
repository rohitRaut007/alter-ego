/**
 * Alter Ego OS design tokens. Light theme only.
 * Hex values are the sRGB conversion of the legacy oklch palette so they work in
 * Tailwind (web) and NativeWind (mobile). Never hardcode colours in components.
 */

export const colors = {
  background: "#FCFBF8",
  foreground: "#171310",
  surface: "#F5F3EF",
  card: "#FFFFFF",
  primary: "#1D1A17",
  primaryForeground: "#FBFAF7",
  secondary: "#F3F0EA",
  muted: "#F3F1ED",
  mutedForeground: "#716A65",
  accent: "#A86A2C",
  accentForeground: "#FDFCF9",
  accentSoft: "#F8EBD9",
  success: "#4B8A63",
  destructive: "#C9302D",
  border: "#E5E2DE",
  borderStrong: "#D4D0CB",
  ring: "#A86A2C",
} as const;

export type ColorToken = keyof typeof colors;

/** 4px base scale, in px. */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = { sm: 10, md: 13, lg: 16, xl: 22, "2xl": 28 } as const;

export const fontFamily = {
  display: "'Sora', ui-serif, Georgia, serif",
  sans: "'Manrope', ui-sans-serif, system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
} as const;

/** Type scale in px with line height. `identity` is for large identity statements. */
export const fontSize = {
  xs: { size: 12, lineHeight: 16 },
  sm: { size: 14, lineHeight: 20 },
  base: { size: 16, lineHeight: 24 },
  lg: { size: 18, lineHeight: 28 },
  xl: { size: 22, lineHeight: 30 },
  "2xl": { size: 28, lineHeight: 36 },
  identity: { size: 36, lineHeight: 44 },
} as const;

export const shadow = {
  soft: "0 1px 2px rgba(23,19,16,0.04), 0 8px 24px -12px rgba(23,19,16,0.10)",
  lift: "0 2px 4px rgba(23,19,16,0.04), 0 20px 40px -20px rgba(23,19,16,0.18)",
} as const;

export const tokens = { colors, spacing, radius, fontFamily, fontSize, shadow } as const;
