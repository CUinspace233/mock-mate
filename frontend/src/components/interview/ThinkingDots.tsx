import { Box, Stack } from "@mui/joy";

export default function ThinkingDots() {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ py: 1 }}>
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            bgcolor: "neutral.400",
            animation: "dotPulse 1.4s ease-in-out infinite",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </Stack>
  );
}
