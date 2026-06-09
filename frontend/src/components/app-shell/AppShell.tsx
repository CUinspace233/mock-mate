import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Box, Drawer, IconButton, Sheet, Stack, Typography } from "@mui/joy";
import { Menu as MenuIcon } from "@mui/icons-material";
import SidebarNav from "./SidebarNav";

interface AppShellProps {
  username: string;
  dailyQuestionCount: number;
  onLogout: () => void;
  children: React.ReactNode;
}

const routeTitles: Record<string, string> = {
  "/chat": "Interview Chat",
  "/resume-drill": "Resume Drill",
  "/history": "History",
  "/progress": "Progress",
};

export default function AppShell({
  username,
  dailyQuestionCount,
  onLogout,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const title = routeTitles[location.pathname] || "Interview Chat";

  const nav = (
    <SidebarNav
      username={username}
      dailyQuestionCount={dailyQuestionCount}
      onLogout={onLogout}
      onNavigate={() => setDrawerOpen(false)}
      collapsed={sidebarCollapsed}
      onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
    />
  );

  const drawerNav = (
    <SidebarNav
      username={username}
      dailyQuestionCount={dailyQuestionCount}
      onLogout={onLogout}
      onNavigate={() => setDrawerOpen(false)}
    />
  );

  return (
    <Sheet
      sx={{
        height: "100dvh",
        bgcolor: "background.body",
        display: "flex",
        overflow: "hidden",
        color: "neutral.900",
      }}
    >
      <Box
        component="aside"
        sx={{
          display: { xs: "none", md: "block" },
          width: sidebarCollapsed ? 76 : 260,
          flexShrink: 0,
          height: "100dvh",
          position: "sticky",
          top: 0,
          transition: "width 0.18s ease",
        }}
      >
        {nav}
      </Box>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} size="sm">
        {drawerOpen ? drawerNav : null}
      </Drawer>

      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          height: "100dvh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{
            display: { xs: "flex", md: "none" },
            height: 56,
            px: 1.5,
            borderBottom: "1px solid",
            borderColor: "neutral.200",
            bgcolor: "background.surface",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <IconButton
            variant="plain"
            color="neutral"
            aria-label="Open navigation menu"
            onClick={() => setDrawerOpen(true)}
          >
            <MenuIcon />
          </IconButton>
          <Typography level="title-sm" sx={{ fontWeight: 800 }}>
            {title}
          </Typography>
        </Stack>
        {children}
      </Box>
    </Sheet>
  );
}
