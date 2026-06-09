import { Box } from "@mui/joy";

interface WorkspaceMainProps {
  children: React.ReactNode;
  variant?: "chat" | "wide" | "fluid";
}

export default function WorkspaceMain({ children, variant = "wide" }: WorkspaceMainProps) {
  const isChat = variant === "chat";
  const isFluid = variant === "fluid";

  return (
    <Box
      component="main"
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: isChat ? "hidden" : "auto",
        display: "flex",
        flexDirection: "column",
        px: isChat || isFluid ? { xs: 1.5, sm: 2, lg: 2.5 } : { xs: 1.5, sm: 2.5, lg: 4 },
        py: { xs: 1.5, sm: 2.5 },
      }}
    >
      <Box
        sx={{
          maxWidth: isChat || isFluid ? "none" : 1180,
          mx: "auto",
          width: "100%",
          minHeight: isChat ? 0 : "100%",
          flex: isChat ? 1 : undefined,
          display: isChat ? "flex" : "block",
          flexDirection: isChat ? "column" : undefined,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
