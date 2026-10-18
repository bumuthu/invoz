"use client";

import { createTheme } from "@mui/material/styles";
import { tokens } from "./tokens";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: tokens.primary,
      dark: tokens.primaryDark,
      light: tokens.primaryMuted,
      contrastText: tokens.contrast,
    },
    secondary: {
      main: tokens.primaryDark,
    },
    success: {
      main: tokens.success,
      light: tokens.successSoft,
    },
    warning: {
      main: tokens.warning,
      light: tokens.warningSoft,
    },
    error: {
      main: tokens.error,
      light: tokens.errorSoft,
    },
    background: {
      default: tokens.background,
      paper: tokens.paper,
    },
    text: {
      primary: tokens.text,
      secondary: tokens.textSecondary,
    },
    divider: tokens.divider,
    action: {
      hover: tokens.primarySoft,
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: 'var(--font-sans), "Plus Jakarta Sans", sans-serif',
    h4: {
      fontSize: "1.625rem",
      fontWeight: 700,
      letterSpacing: "-0.035em",
      lineHeight: 1.2,
    },
    h6: {
      fontWeight: 600,
      letterSpacing: "-0.02em",
    },
    body2: {
      lineHeight: 1.55,
    },
    button: {
      fontWeight: 600,
      letterSpacing: "-0.01em",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ":root": {
          "--portal-shadow": tokens.shadow,
        },
        body: {
          backgroundColor: tokens.background,
          backgroundImage: `radial-gradient(1100px 560px at 8% -10%, ${tokens.glow} 0%, transparent 58%), radial-gradient(900px 520px at 100% 0%, ${tokens.glowAlt} 0%, transparent 50%)`,
          backgroundAttachment: "fixed",
          WebkitFontSmoothing: "antialiased",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 999,
          paddingInline: 18,
          paddingBlock: 8,
        },
        outlined: {
          borderColor: tokens.divider,
          backgroundColor: tokens.paper,
          color: tokens.text,
          "&:hover": {
            borderColor: tokens.primaryMuted,
            backgroundColor: tokens.primarySoft,
          },
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: `1px solid ${tokens.divider}`,
          borderRadius: 20,
          boxShadow: tokens.shadow,
          overflow: "hidden",
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 14,
          border: `1px solid ${tokens.divider}`,
          boxShadow: tokens.shadow,
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          border: `1px solid ${tokens.divider}`,
          borderRadius: 999,
          paddingInline: 14,
          backgroundColor: tokens.paper,
          color: tokens.textSecondary,
          fontWeight: 600,
          "&.Mui-selected": {
            backgroundColor: tokens.primary,
            color: tokens.contrast,
            borderColor: tokens.primary,
          },
          "&.Mui-selected:hover": {
            backgroundColor: tokens.primaryDark,
          },
        },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        grouped: {
          "&:not(:first-of-type)": {
            marginLeft: 8,
            borderRadius: 999,
            borderLeft: `1px solid ${tokens.divider}`,
          },
          "&:first-of-type": {
            borderRadius: 999,
          },
          "&.Mui-selected + .MuiToggleButton-root": {
            borderLeftColor: tokens.divider,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: tokens.paper,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: tokens.divider,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: tokens.primaryMuted,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 999,
          height: 26,
        },
        colorSuccess: {
          backgroundColor: tokens.successSoft,
          color: tokens.success,
        },
        colorError: {
          backgroundColor: tokens.errorSoft,
          color: tokens.error,
        },
        colorWarning: {
          backgroundColor: tokens.warningSoft,
          color: tokens.warning,
        },
        colorDefault: {
          backgroundColor: tokens.neutralSoft,
          color: tokens.textSecondary,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          height: 6,
          borderRadius: 99,
          backgroundColor: tokens.primarySoft,
        },
        bar: {
          borderRadius: 99,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: tokens.primarySoft,
          color: tokens.textSecondary,
          fontWeight: 600,
          fontSize: "0.75rem",
          letterSpacing: "0.01em",
          borderBottom: 0,
          paddingTop: 12,
          paddingBottom: 12,
        },
        body: {
          borderBottomColor: tokens.divider,
          fontSize: "0.875rem",
          paddingTop: 14,
          paddingBottom: 14,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:last-of-type td": {
            borderBottom: 0,
          },
          "&.MuiTableRow-hover:hover": {
            backgroundColor: tokens.primarySoft,
          },
        },
      },
    },
  },
});

export default theme;
