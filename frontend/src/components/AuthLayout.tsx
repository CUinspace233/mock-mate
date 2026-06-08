import { Box, IconButton, Stack, Typography } from "@mui/joy";
import { GitHub as GitHubIcon } from "@mui/icons-material";
import AuthPreview from "./auth/AuthPreview";
import MockMateIcon from "./MockMateIcon";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: "background.body",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.05fr) minmax(420px, 0.95fr)" },
      }}
    >
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          alignItems: "center",
          justifyContent: "center",
          p: 6,
          borderRight: "1px solid",
          borderColor: "neutral.200",
        }}
      >
        <Stack spacing={4} sx={{ maxWidth: 520 }}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <MockMateIcon size={38} />
              <Typography level="h2" sx={{ fontWeight: 850, color: "neutral.900" }}>
                MockMate
              </Typography>
              <IconButton
                component="a"
                href="https://github.com/CUinspace233/mock-mate"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open MockMate GitHub repository"
                variant="plain"
                size="sm"
                color="neutral"
              >
                <GitHubIcon />
              </IconButton>
            </Stack>
            <Typography level="h3" sx={{ fontWeight: 700, lineHeight: 1.2, mb: 1 }}>
              AI interview practice that feels like a real coaching session.
            </Typography>
            <Typography level="body-md" sx={{ color: "neutral.600", lineHeight: 1.7 }}>
              Configure the role, answer live questions, and get structured feedback that helps you
              speak with more clarity and ownership.
            </Typography>
          </Box>
          <AuthPreview />
        </Stack>
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: { xs: 2.5, sm: 4, md: 6 },
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 420,
            bgcolor: "background.surface",
            border: "1px solid",
            borderColor: "neutral.200",
            borderRadius: "xl",
            boxShadow: "md",
            p: { xs: 2.5, sm: 3 },
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
