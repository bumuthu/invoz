/**
 * Single source for portal color. Change a value here and the whole app follows.
 * Components must use theme palette keys, never a hex color of their own.
 */
export const tokens = {
  primary: "#4F46E5",
  primaryDark: "#4338CA",
  primarySoft: "#EEF0FF",
  primaryMuted: "#DDD9FF",
  background: "#E8EDF7",
  paper: "#FFFFFF",
  text: "#1B1830",
  textSecondary: "#6E7488",
  divider: "#E4E7F2",
  success: "#0F9F6E",
  successSoft: "#E5F8F0",
  warning: "#B45309",
  warningSoft: "#FEF4E6",
  error: "#E11D48",
  errorSoft: "#FDE8EE",
  contrast: "#FFFFFF",
  glow: "#D5DFFF",
  glowAlt: "#E7D9FF",
  neutralSoft: "#F1F2F7",
  shadow: "0 10px 30px rgba(67, 56, 202, 0.08), 0 1px 2px rgba(67, 56, 202, 0.04)",
} as const;
