/**
 * Single source for portal color. Change a value here and the whole app follows.
 * Components must use theme palette keys, never a hex color of their own.
 * Blue is the primary. Orange is the accent, used in a few places only.
 */
export const tokens = {
  primary: "#2563EB",
  primaryDark: "#1D4ED8",
  primarySoft: "#EEF3FC",
  primaryMuted: "#D5E2F7",
  accent: "#EA580C",
  accentDark: "#C2410C",
  background: "#F6F8FB",
  paper: "#FFFFFF",
  text: "#111111",
  textSecondary: "#475569",
  divider: "#E2E8F0",
  success: "#0F7A4A",
  successSoft: "#E7F6EE",
  warning: "#B45309",
  warningSoft: "#FEF4E8",
  error: "#C2413B",
  errorSoft: "#FDECEC",
  contrast: "#FFFFFF",
  neutralSoft: "#F1F5F9",
  inkHover: "#2A2A2A",
  shadow: "0 10px 28px rgba(17, 17, 17, 0.05), 0 1px 2px rgba(17, 17, 17, 0.04)",
} as const;
