import Markdown from "react-markdown";
import { Avatar, Box, Card, CardContent, Stack, Typography } from "@mui/joy";
import { Person as PersonIcon } from "@mui/icons-material";
import type { Message } from "../../types/interview";
import EvaluationCard from "./EvaluationCard";
import MockMateIcon from "../MockMateIcon";
import ThinkingDots from "./ThinkingDots";

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.sender === "user";
  const isEvaluation = message.score !== undefined;
  const isPending = message.id.startsWith("temp-") && !message.content;

  return (
    <Stack
      direction="row"
      spacing={1.5}
      justifyContent={isUser ? "flex-end" : "flex-start"}
      alignItems="flex-start"
      sx={{ animation: "fadeIn 0.2s ease-out" }}
    >
      {!isUser && (
        <Avatar size="sm" sx={{ bgcolor: "transparent", mt: 0.25, "--Icon-fontSize": "28px" }}>
          <MockMateIcon size={28} alt="MockMate AI" />
        </Avatar>
      )}
      <Box sx={{ maxWidth: isUser ? { xs: "86%", md: "72%" } : "min(100%, 760px)", minWidth: 0 }}>
        {isEvaluation ? (
          <EvaluationCard message={message} />
        ) : (
          <Card
            variant={isUser ? "soft" : "plain"}
            sx={{
              bgcolor: isUser ? "neutral.100" : "transparent",
              borderRadius: "lg",
              boxShadow: "none",
              border: isUser ? "1px solid" : "none",
              borderColor: "neutral.200",
            }}
          >
            <CardContent sx={{ p: isUser ? 1.5 : 0.5 }}>
              {isPending ? (
                <ThinkingDots />
              ) : (
                <Typography
                  level="body-md"
                  component="div"
                  sx={{
                    color: "neutral.800",
                    lineHeight: 1.65,
                    "& p": { m: 0 },
                    "& p + p": { mt: 1 },
                    "& ul, & ol": { my: 1, pl: 2.5 },
                    "& code": {
                      bgcolor: "neutral.100",
                      px: 0.5,
                      py: 0.25,
                      borderRadius: "sm",
                      fontSize: "0.86em",
                      fontFamily: "monospace",
                    },
                    "& pre": {
                      bgcolor: "neutral.100",
                      p: 1.5,
                      borderRadius: "md",
                      overflow: "auto",
                      my: 1,
                    },
                    "& pre code": { bgcolor: "transparent", p: 0 },
                  }}
                >
                  <Markdown>{message.content}</Markdown>
                </Typography>
              )}
            </CardContent>
          </Card>
        )}
        <Typography level="body-xs" sx={{ color: "neutral.400", mt: 0.5, px: isUser ? 1 : 0 }}>
          {message.timestamp.toLocaleTimeString()}
        </Typography>
      </Box>
      {isUser && (
        <Avatar size="sm" sx={{ bgcolor: "neutral.200", color: "neutral.700", mt: 0.25 }}>
          <PersonIcon fontSize="small" />
        </Avatar>
      )}
    </Stack>
  );
}
