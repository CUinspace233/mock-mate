import { Box, Chip, Stack, Typography } from "@mui/joy";

export default function AuthPreview() {
  return (
    <Box
      sx={{
        width: "min(460px, 100%)",
        border: "1px solid",
        borderColor: "neutral.200",
        borderRadius: "xl",
        bgcolor: "background.surface",
        boxShadow: "md",
        p: 2.5,
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip size="sm" variant="soft" color="primary">
            Frontend Engineer
          </Chip>
          <Chip size="sm" variant="soft" color="neutral">
            Medium
          </Chip>
          <Chip size="sm" variant="soft" color="neutral">
            gpt-5.5
          </Chip>
        </Stack>

        <Box>
          <Typography level="body-xs" sx={{ color: "neutral.500", fontWeight: 800, mb: 0.75 }}>
            AI interviewer
          </Typography>
          <Typography level="body-md" sx={{ lineHeight: 1.65 }}>
            Walk me through a performance issue you owned end to end. What did you measure, what
            tradeoffs did you make, and how did you prove the fix worked?
          </Typography>
        </Box>

        <Box
          sx={{
            alignSelf: "flex-end",
            maxWidth: "88%",
            bgcolor: "neutral.100",
            border: "1px solid",
            borderColor: "neutral.200",
            borderRadius: "lg",
            p: 1.5,
          }}
        >
          <Typography level="body-sm" sx={{ color: "neutral.700", lineHeight: 1.55 }}>
            I started with RUM data, found the route with the worst P95 LCP, split the bundle, and
            verified the impact with a holdout dashboard...
          </Typography>
        </Box>

        <Box
          sx={{
            border: "1px solid",
            borderColor: "neutral.200",
            borderRadius: "lg",
            p: 1.5,
            bgcolor: "background.level1",
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography level="body-sm" sx={{ fontWeight: 800 }}>
              Evaluation
            </Typography>
            <Chip size="sm" color="success" variant="soft">
              86/100
            </Chip>
          </Stack>
          <Typography level="body-sm" sx={{ color: "neutral.600", lineHeight: 1.55 }}>
            Strong ownership and metrics. Add more detail on rollback planning and stakeholder
            communication.
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
