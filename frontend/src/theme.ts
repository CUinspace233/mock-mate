import { extendTheme } from "@mui/joy/styles";

const theme = extendTheme({
  fontFamily: {
    display: "'Inter', var(--joy-fontFamily-fallback)",
    body: "'Inter', var(--joy-fontFamily-fallback)",
  },
  colorSchemes: {
    light: {
      palette: {
        primary: {
          50: "#eff6ff",
          100: "#bfdbfe",
          200: "#93c5fd",
          300: "#60a5fa",
          400: "#3b82f6",
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af",
          800: "#1e3a8a",
          900: "#172554",
        },
        neutral: {
          50: "#f8f9fa",
          100: "#f0f2f5",
          200: "#e4e7eb",
          300: "#d1d5db",
          400: "#9ca3af",
          500: "#6b7280",
          600: "#4b5563",
          700: "#374151",
          800: "#1f2937",
          900: "#111827",
        },
        background: {
          body: "#f8f9fb",
          surface: "#ffffff",
        },
      },
    },
  },
  radius: {
    xs: "6px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
  },
  shadow: {
    xs: "0 1px 2px rgba(0,0,0,0.04)",
    sm: "0 2px 8px rgba(0,0,0,0.06)",
    md: "0 4px 16px rgba(0,0,0,0.08)",
    lg: "0 8px 30px rgba(0,0,0,0.1)",
    xl: "0 16px 48px rgba(0,0,0,0.12)",
  },
  components: {
    JoyCard: {
      styleOverrides: {
        root: {
          transition: "box-shadow 0.2s ease, transform 0.2s ease",
          "&:hover": {
            boxShadow: "var(--joy-shadow-md)",
          },
        },
      },
    },
    JoyButton: {
      styleOverrides: {
        root: {
          borderRadius: "var(--joy-radius-md)",
          fontWeight: 600,
          transition: "all 0.15s ease",
          "&:active": {
            transform: "scale(0.98)",
          },
        },
      },
    },
    JoyInput: {
      styleOverrides: {
        root: {
          borderRadius: "var(--joy-radius-md)",
        },
      },
    },
    JoySelect: {
      styleOverrides: {
        root: {
          borderRadius: "var(--joy-radius-md)",
        },
      },
    },
    JoyTextarea: {
      styleOverrides: {
        root: {
          borderRadius: "var(--joy-radius-md)",
        },
      },
    },
    JoyModalDialog: {
      styleOverrides: {
        root: {
          borderRadius: "var(--joy-radius-xl)",
        },
      },
    },
    JoyTable: {
      styleOverrides: {
        root: {
          "& thead th": {
            fontSize: "0.7rem",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase" as const,
            color: "var(--joy-palette-neutral-500)",
          },
          "& tbody tr:hover": {
            backgroundColor: "var(--joy-palette-neutral-50)",
          },
        },
      },
    },
    JoyTab: {
      styleOverrides: {
        root: {
          borderRadius: "var(--joy-radius-md)",
          fontWeight: 600,
          transition: "all 0.15s ease",
        },
      },
    },
  },
});

export default theme;
