/**
 * Single source for portal color. Change a value here and the whole app follows.
 * Components must use theme palette keys, never a hex color of their own.
 * Ink is near-black. Accent is the landing-app orange.
 */
export const tokens = {
  primary: "#EA580C",
  primaryDark: "#C2410C",
  primarySoft: "#F4F1EC",
  primaryMuted: "#E7E2DA",
  background: "#F7F6F3",
  paper: "#FFFFFF",
  text: "#111111",
  textSecondary: "#5E5A53",
  divider: "#E6E2DA",
  success: "#0F7A4A",
  successSoft: "#E7F6EE",
  warning: "#B45309",
  warningSoft: "#FEF4E8",
  error: "#C2413B",
  errorSoft: "#FDECEC",
  contrast: "#FFFFFF",
  neutralSoft: "#F4F1EC",
  inkHover: "#2A2A2A",
  shadow: "0 10px 28px rgba(17, 17, 17, 0.06), 0 1px 2px rgba(17, 17, 17, 0.04)",
} as const;
