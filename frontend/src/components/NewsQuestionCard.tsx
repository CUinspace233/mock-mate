import { useState, type ReactNode } from "react";
import {
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Chip,
  Box,
  Link,
  IconButton,
  Divider,
  Sheet,
  type ColorPaletteProp,
} from "@mui/joy";
import {
  Newspaper,
  AccessTime,
  Star,
  OpenInNew,
  PlayArrow,
  Schedule,
  Close,
} from "@mui/icons-material";
import type { Difficulty, NewsQuestion } from "../types/interview";
import { formatRelativeTime, getDifficultyColor } from "../utils";

interface NewsQuestionCardProps {
  question: NewsQuestion;
  onAnswer: (questionId: string) => void;
  onDismiss: (questionId: string) => void;
  onClose?: () => void;
}

const renderStarRating = (score: number): ReactNode[] => {
  const stars = [];
  const fullStars = Math.floor(score * 5);
  const hasHalfStar = (score * 5) % 1 >= 0.5;

  for (let i = 0; i < 5; i++) {
    stars.push(
      <Star
        key={i}
        sx={{
          color: i < fullStars || (i === fullStars && hasHalfStar) ? "warning.main" : "neutral.300",
          fontSize: "1rem",
        }}
      />,
    );
  }

  return stars;
};

export default function NewsQuestionCard({
  question,
  onAnswer,
  onDismiss,
  onClose,
}: NewsQuestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleOpenSource = () => {
    window.open(question.source_url, "_blank", "noopener,noreferrer");
  };

  return (
    <Card
      variant="outlined"
      sx={{
        boxShadow: "lg",
        border: "1px solid",
        borderColor: "primary.200",
        maxWidth: 480,
        position: "relative",
      }}
    >
      {/* Close button */}
      {onClose && (
        <IconButton
          size="sm"
          variant="plain"
          onClick={onClose}
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 1,
          }}
        >
          <Close />
        </IconButton>
      )}

      <CardContent sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Newspaper color="primary" />
            <Typography level="title-md" color="primary">
              Today's Interview Challenge
            </Typography>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={2}>
            <Chip
              size="sm"
              variant="soft"
              color={getDifficultyColor(question.difficulty as Difficulty) as ColorPaletteProp}
            >
              {question.difficulty.toUpperCase()}
            </Chip>
            <Chip size="sm" variant="outlined">
              {question.question_type}
            </Chip>
          </Stack>
        </Box>

        {/* News Source */}
        <Sheet variant="soft" sx={{ p: 2, mb: 2, borderRadius: "sm" }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <AccessTime sx={{ fontSize: "0.875rem" }} />
            <Typography level="body-sm" color="neutral">
              {formatRelativeTime(question.published_at)}
            </Typography>
          </Stack>

          <Link
            onClick={handleOpenSource}
            sx={{
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              textDecoration: "none",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            <Typography level="body-sm" sx={{ fontWeight: "md", lineHeight: 1.4 }}>
              {question.source_title}
            </Typography>
            <OpenInNew sx={{ fontSize: "0.75rem" }} />
          </Link>

          {/* Relevance Score */}
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
            <Typography level="body-xs" color="neutral">
              Relevance:
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
              {renderStarRating(question.relevance_score)}
            </Box>
            <Typography level="body-xs" color="neutral">
              ({(question.relevance_score * 100).toFixed(0)}%)
            </Typography>
          </Stack>
        </Sheet>

        <Divider sx={{ my: 2 }} />

        {/* Question Content */}
        <Box sx={{ mb: 2 }}>
          <Typography level="body-md" sx={{ lineHeight: 1.6 }}>
            <strong>Question:</strong>
            {isExpanded ? question.content : `${question.content.substring(0, 100)}...`}
          </Typography>

          {question.content.length > 100 && (
            <Button
              variant="plain"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              sx={{ mt: 1, p: 0, minHeight: "auto" }}
            >
              {isExpanded ? "Collapse" : "Expand"}
            </Button>
          )}
        </Box>

        {/* AI Reasoning */}
        {isExpanded && question.ai_reasoning && (
          <Sheet variant="soft" color="neutral" sx={{ p: 2, mb: 2, borderRadius: "sm" }}>
            <Typography level="body-sm" color="neutral" sx={{ fontStyle: "italic" }}>
              <strong>AI Analysis:</strong>
              {question.ai_reasoning}
            </Typography>
          </Sheet>
        )}

        {/* Action Buttons */}
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button
            variant="solid"
            color="primary"
            startDecorator={<PlayArrow />}
            onClick={() => onAnswer(question.id)}
            sx={{ flex: 1 }}
          >
            Answer now
          </Button>

          <Button
            variant="outlined"
            color="neutral"
            startDecorator={<Schedule />}
            onClick={() => onDismiss(question.id)}
            sx={{ flex: 1 }}
          >
            Remind me later
          </Button>

          <Button
            variant="plain"
            color="neutral"
            startDecorator={<OpenInNew />}
            onClick={handleOpenSource}
            size="sm"
          >
            Original
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
