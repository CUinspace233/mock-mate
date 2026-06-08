import { Box, Chip, Stack } from "@mui/joy";
import type { Message } from "../../types/interview";
import MessageBubble from "./MessageBubble";

interface ChatThreadProps {
  messages: Message[];
  currentQuestionNumber?: number;
  questionCountTarget?: number;
  followUpCount?: number;
  followUpLimit?: number;
  isInFollowUpMode?: boolean;
  bottomRef?: React.RefObject<HTMLDivElement | null>;
}

export default function ChatThread({
  messages,
  currentQuestionNumber = 0,
  questionCountTarget = 0,
  followUpCount = 0,
  followUpLimit = 0,
  isInFollowUpMode = false,
  bottomRef,
}: ChatThreadProps) {
  return (
    <Box
      data-chat-scroll
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        px: { xs: 0.5, sm: 1 },
        pb: 3,
      }}
    >
      <Stack spacing={2.25} sx={{ maxWidth: 860, mx: "auto", py: 2 }}>
        {currentQuestionNumber > 0 && (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            <Chip size="sm" variant="soft" color="primary">
              Question {currentQuestionNumber} / {questionCountTarget}
            </Chip>
            {isInFollowUpMode && followUpLimit > 0 && (
              <Chip size="sm" variant="soft" color="neutral">
                Follow-up {followUpCount} / {followUpLimit}
              </Chip>
            )}
          </Stack>
        )}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </Stack>
    </Box>
  );
}
