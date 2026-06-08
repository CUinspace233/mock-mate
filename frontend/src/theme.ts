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
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#3b82f6",
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af",
          800: "#1e3a8a",
          900: "#172554",
        },
        neutral: {
          50: "#f7f7f8",
          100: "#f4f4f5",
          200: "#ececf0",
          300: "#d9d9e3",
          400: "#b8b8c6",
          500: "#6b7280",
          600: "#4b5563",
          700: "#24292f",
          800: "#1f2937",
          900: "#111827",
        },
        background: {
          body: "#f7f7f8",
          surface: "#ffffff",
          level1: "#fbfbfc",
          level2: "#f4f4f5",
        },
      },
    },
  },
  radius: {
    xs: "6px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "20px",
  },
  shadow: {
    xs: "0 1px 2px rgba(17,24,39,0.03)",
    sm: "0 4px 12px rgba(17,24,39,0.04)",
    md: "0 8px 24px rgba(17,24,39,0.06)",
    lg: "0 16px 40px rgba(17,24,39,0.08)",
    xl: "0 24px 64px rgba(17,24,39,0.10)",
  },
  components: {
    JoyCard: {
      styleOverrides: {
        root: {
          transition: "box-shadow 0.2s ease, transform 0.2s ease",
          "&:hover": {
            boxShadow: "var(--joy-shadow-sm)",
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
