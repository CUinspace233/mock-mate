import { Box, Card, CardContent, Chip, LinearProgress, Stack, Typography } from "@mui/joy";
import type { Message } from "../../types/interview";

interface EvaluationCardProps {
  message: Message;
}

function scoreColor(score: number): "success" | "primary" | "warning" | "danger" {
  if (score >= 85) return "success";
  if (score >= 70) return "primary";
  if (score >= 50) return "warning";
  return "danger";
}

function FeedbackList({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <Box>
      <Typography level="body-sm" sx={{ fontWeight: 800, mb: 0.75 }}>
        {title}
      </Typography>
      <Stack spacing={0.5}>
        {items.map((item, index) => (
          <Typography
            key={`${item}-${index}`}
            level="body-sm"
            sx={{ color: "neutral.700", lineHeight: 1.55 }}
          >
            {item}
          </Typography>
        ))}
      </Stack>
    </Box>
  );
}

export default function EvaluationCard({ message }: EvaluationCardProps) {
  const score = message.score ?? 0;
  const color = scoreColor(score);

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: "neutral.200",
        boxShadow: "xs",
        borderRadius: "lg",
        bgcolor: "background.surface",
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
          <Box sx={{ minWidth: 112 }}>
            <Typography level="body-xs" sx={{ color: "neutral.500", fontWeight: 700 }}>
              Score
            </Typography>
            <Stack direction="row" spacing={1} alignItems="baseline">
              <Typography level="h2" sx={{ lineHeight: 1 }}>
                {score}
              </Typography>
              <Typography level="body-sm" sx={{ color: "neutral.500" }}>
                /100
              </Typography>
            </Stack>
            <LinearProgress determinate value={score} color={color} sx={{ mt: 1 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Chip size="sm" color={color} variant="soft" sx={{ mb: 1 }}>
              AI evaluation
            </Chip>
            <Typography level="body-sm" sx={{ color: "neutral.700", lineHeight: 1.6 }}>
              {message.feedback?.split("\n\n")[1] || message.content.replace(/^Score:.*?\n\n/s, "").split("\n\n")[0]}
            </Typography>
          </Box>
        </Stack>

        <Stack spacing={1.5} sx={{ mt: 2 }}>
          <FeedbackList title="Strengths" items={message.strengths} />
          <FeedbackList title="Areas for improvement" items={message.improvements} />
          {!!message.keywordsCovered?.length && (
            <Box>
              <Typography level="body-sm" sx={{ fontWeight: 800, mb: 0.75 }}>
                Keywords covered
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {message.keywordsCovered.map((keyword, index) => (
                  <Chip key={`${keyword}-${index}`} size="sm" variant="soft" color="success">
                    {keyword}
                  </Chip>
                ))}
              </Stack>
            </Box>
          )}
          {!!message.keywordsMissed?.length && (
            <Box>
              <Typography level="body-sm" sx={{ fontWeight: 800, mb: 0.75 }}>
                Keywords missed
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {message.keywordsMissed.map((keyword, index) => (
                  <Chip key={`${keyword}-${index}`} size="sm" variant="soft" color="neutral">
                    {keyword}
                  </Chip>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
