import { useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Divider,
  Dropdown,
  IconButton,
  ListItemDecorator,
  Menu,
  MenuButton,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from "@mui/joy";
import {
  Article as ArticleIcon,
  ChevronLeft as CollapseIcon,
  ChevronRight as ExpandIcon,
  GitHub as GitHubIcon,
  History as HistoryIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  TrendingUp as TrendingUpIcon,
} from "@mui/icons-material";
import MockMateIcon from "../MockMateIcon";

interface SidebarNavProps {
  username: string;
  dailyQuestionCount: number;
  onLogout: () => void;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

const navItems = [
  { path: "/chat", label: "Interview Chat", icon: <MockMateIcon size={20} alt="" /> },
  { path: "/resume-drill", label: "Resume Drill", icon: <ArticleIcon /> },
  { path: "/history", label: "History", icon: <HistoryIcon /> },
  { path: "/progress", label: "Progress", icon: <TrendingUpIcon /> },
];

export default function SidebarNav({
  username,
  dailyQuestionCount,
  onLogout,
  onNavigate,
  collapsed = false,
  onToggleCollapsed,
}: SidebarNavProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        p: collapsed ? 1 : 1.5,
        bgcolor: "background.body",
        borderRight: { md: "1px solid var(--joy-palette-neutral-200)" },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent={collapsed ? "center" : "space-between"}
        sx={{ px: collapsed ? 0 : 1 }}
      >
        {!collapsed && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            <MockMateIcon size={34} />
            <Box sx={{ minWidth: 0 }}>
              <Typography level="title-md" sx={{ fontWeight: 800, color: "neutral.900" }}>
                MockMate
              </Typography>
              <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                Interview coach
              </Typography>
            </Box>
          </Stack>
        )}
        <Stack direction={collapsed ? "column" : "row"} spacing={0.5}>
          {collapsed && (
            <Tooltip title="MockMate" placement="right">
              <Box>
                <MockMateIcon size={36} />
              </Box>
            </Tooltip>
          )}
          {!collapsed && (
            <Tooltip title="GitHub repository">
              <IconButton
                component="a"
                href="https://github.com/CUinspace233/mock-mate"
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
                variant="plain"
                color="neutral"
              >
                <GitHubIcon />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={collapsed ? "Expand sidebar" : "Collapse sidebar"} placement={collapsed ? "right" : "bottom"}>
            <IconButton size="sm" variant="plain" color="neutral" onClick={onToggleCollapsed}>
              {collapsed ? <ExpandIcon /> : <CollapseIcon />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Stack spacing={0.5} sx={{ mt: 1, alignItems: collapsed ? "center" : "stretch" }}>
        {navItems.map((item) => {
          const active = location.pathname === item.path || (location.pathname === "/" && item.path === "/chat");
          const button = (
            <Box
                key={item.path}
                component="button"
                type="button"
                onClick={() => {
                  navigate(item.path);
                  onNavigate?.();
                }}
                sx={{
                  width: collapsed ? 44 : "100%",
                  minHeight: 44,
                  border: "1px solid",
                  borderColor: active ? "neutral.200" : "transparent",
                  bgcolor: active ? "background.surface" : "transparent",
                  color: active ? "neutral.900" : "neutral.700",
                  borderRadius: "sm",
                  px: collapsed ? 0 : 1.25,
                  py: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: collapsed ? "center" : "flex-start",
                  gap: 1,
                  font: "inherit",
                  fontWeight: active ? 700 : 500,
                  textAlign: "left",
                  cursor: "pointer",
                  boxShadow: active ? "xs" : "none",
                  "& svg": { fontSize: 20, color: active ? "primary.500" : "neutral.500" },
                  "& img": { opacity: active ? 1 : 0.72 },
                  "&:hover": { bgcolor: active ? "background.surface" : "neutral.100" },
                }}
              >
                {item.icon}
                {!collapsed && (
                  <Typography level="body-sm" sx={{ fontWeight: "inherit" }}>
                    {item.label}
                  </Typography>
                )}
              </Box>
          );
          return collapsed ? (
            <Tooltip key={item.path} title={item.label} placement="right">
              {button}
            </Tooltip>
          ) : (
            button
          );
        })}
      </Stack>

      <Divider sx={{ my: 0.5 }} />

      {collapsed ? (
        <Tooltip title={`${dailyQuestionCount} sessions today`} placement="right">
          <Box
            sx={{
              width: 44,
              minHeight: 36,
              mx: "auto",
              borderRadius: "sm",
              bgcolor: "primary.50",
              color: "primary.700",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            {dailyQuestionCount}
          </Box>
        </Tooltip>
      ) : (
        <Box
          sx={{
            borderRadius: "sm",
            px: 1.25,
            py: 1,
            bgcolor: "neutral.50",
            border: "1px solid",
            borderColor: "neutral.200",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Typography level="body-xs" sx={{ color: "neutral.500", fontWeight: 700 }}>
            Sessions today
          </Typography>
          <Typography level="body-sm" sx={{ color: "neutral.900", fontWeight: 800 }}>
            {dailyQuestionCount}
          </Typography>
        </Box>
      )}

      <Box sx={{ flex: 1 }} />

      <Dropdown>
        <MenuButton
          variant="plain"
          color="neutral"
          sx={{
            justifyContent: collapsed ? "center" : "flex-start",
            borderRadius: "md",
            px: 1,
            py: 1,
            width: "100%",
          }}
          startDecorator={<PersonIcon sx={{ fontSize: 18 }} />}
        >
          {!collapsed && (
            <Typography level="body-sm" noWrap sx={{ fontWeight: 700 }}>
              {username}
            </Typography>
          )}
        </MenuButton>
        <Menu
          placement="top-start"
          size="sm"
          sx={{
            minWidth: 180,
            p: 0,
            overflow: "hidden",
          }}
        >
          <MenuItem color="danger" onClick={onLogout} sx={{ minHeight: 40 }}>
            <ListItemDecorator>
              <LogoutIcon fontSize="small" />
            </ListItemDecorator>
            Logout
          </MenuItem>
        </Menu>
      </Dropdown>
    </Box>
  );
}
