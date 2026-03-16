import { Box, IconButton, Typography } from "@mui/joy";
import {
  AutoAwesome as AIIcon,
  BarChart as ChartIcon,
  TrackChanges as FeedbackIcon,
  GitHub as GitHubIcon,
} from "@mui/icons-material";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const features = [
  { icon: <AIIcon sx={{ fontSize: 20, color: "#fff" }} />, title: "AI-Powered Questions", desc: "Tailored to your target role and difficulty level" },
  { icon: <ChartIcon sx={{ fontSize: 20, color: "#fff" }} />, title: "Detailed Score Breakdown", desc: "Structured evaluation with actionable feedback" },
  { icon: <FeedbackIcon sx={{ fontSize: 20, color: "#fff" }} />, title: "Personalized Feedback", desc: "Improve with every practice session" },
];

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* Left branded panel — hidden on mobile */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          flex: "1 1 55%",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #172554, #1e3a8a, #2563eb)",
          backgroundSize: "200% 200%",
          animation: "gradientShift 8s ease-in-out infinite",
          p: 6,
        }}
      >
        {/* Floating decorative shapes */}
        <Box
          sx={{
            position: "absolute",
            top: "12%",
            right: "15%",
            width: 160,
            height: 160,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            animation: "float 6s ease-in-out infinite",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src="/robot_icon.png"
            alt=""
            style={{ width: 90, height: 90, opacity: 0.45 }}
          />
        </Box>
        <Box
          sx={{
            position: "absolute",
            bottom: "18%",
            left: "10%",
            width: 120,
            height: 120,
            borderRadius: "24px",
            background: "rgba(255,255,255,0.08)",
            animation: "floatReverse 7s ease-in-out infinite",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            top: "55%",
            right: "8%",
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.05)",
            animation: "float 8s ease-in-out infinite 1s",
          }}
        />

        {/* Brand block */}
        <Box sx={{ position: "relative", zIndex: 1, textAlign: "center", mb: 6 }}>
          <Typography
            level="h1"
            sx={{
              color: "#fff",
              fontSize: "3rem",
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            MockMate
          </Typography>
          <Typography
            level="title-lg"
            sx={{
              color: "rgba(255,255,255,0.75)",
              fontWeight: 400,
              mt: 1,
            }}
          >
            Your AI Interview Coach
          </Typography>
        </Box>

        {/* Feature highlights */}
        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 3,
            maxWidth: 320,
          }}
        >
          {features.map((feature) => (
            <Box key={feature.title} sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  minWidth: 40,
                  mt: "2px",
                  borderRadius: "10px",
                  background: "rgba(255,255,255,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {feature.icon}
              </Box>
              <Box>
                <Typography sx={{ color: "#fff", fontWeight: 600, fontSize: "0.95rem" }}>
                  {feature.title}
                </Typography>
                <Typography sx={{ color: "rgba(255,255,255,0.55)", fontSize: "0.82rem" }}>
                  {feature.desc}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>

        {/* Trust line */}
        <Box
          sx={{
            position: "absolute",
            bottom: 32,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Typography
            sx={{
              color: "rgba(255,255,255,0.35)",
              fontSize: "0.75rem",
            }}
          >
            Trusted by candidates preparing for top tech companies
          </Typography>
          <IconButton
            component="a"
            href="https://github.com/CUinspace233/mock-mate"
            target="_blank"
            rel="noopener noreferrer"
            variant="plain"
            size="sm"
            sx={{ "& svg": { color: "rgba(255,255,255,0.5)" }, "&:hover": { bgcolor: "transparent" }, "&:hover svg": { color: "#fff" } }}
          >
            <GitHubIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Right panel — form area */}
      <Box
        sx={{
          flex: { xs: "1 1 100%", md: "1 1 45%" },
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          overflowY: "auto",
          p: { xs: 3, sm: 4, md: 6 },
          bgcolor: "#fff",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
