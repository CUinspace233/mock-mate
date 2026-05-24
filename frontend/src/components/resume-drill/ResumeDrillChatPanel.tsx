import type { RefObject } from "react";
import Markdown from "react-markdown";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Stack,
  Textarea,
  Tooltip,
  Typography,
} from "@mui/joy";
import {
  Cancel as CancelIcon,
  Description as DescriptionIcon,
  Gavel as GavelIcon,
  Mic as MicIcon,
  PlayArrow as PlayArrowIcon,
  Replay as ReplayIcon,
  Send as SendIcon,
  Stop as StopIcon,
} from "@mui/icons-material";
import type { Message, ResumeProject, ResumeResource } from "../../types/interview";

interface ResumeDrillChatPanelProps {
  resume: ResumeResource | null;
  previewProject: ResumeProject | null;
  selectedProject: ResumeProject | null;
  activeProject: ResumeProject | null;
  activeProjectIndex: number;
  activePointNumber: number;
  drillPointCount: number;
  questionNumber: number;
  questionsPerProject: number;
  error: string;
  hasPendingProjectSelection: boolean;
  visibleMessages: Message[];
  isComplete: boolean;
  awaitingAnswer: boolean;
  currentQuestion: Message | null;
  isRecording: boolean;
  currentAnswer: string;
  isSupported: boolean;
  isLoading: boolean;
  isUploading: boolean;
  isStarted: boolean;
  canAdvanceProject: boolean;
  advanceProjectLabel: string;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onAnswerChange: (answer: string) => void;
  onSendAnswer: () => void;
  onCancelDrill: () => void;
  onToggleRecording: () => void;
  onStartSelectedProject: () => void;
  onRestartCurrentProject: () => void;
  onContinueCurrentProject: () => void;
  onGoNextProject: () => void;
  onStartDrill: () => void;
}

export default function ResumeDrillChatPanel({
  resume,
  previewProject,
  selectedProject,
  activeProject,
  activeProjectIndex,
  activePointNumber,
  drillPointCount,
  questionNumber,
  questionsPerProject,
  error,
  hasPendingProjectSelection,
  visibleMessages,
  isComplete,
  awaitingAnswer,
  currentQuestion,
  isRecording,
  currentAnswer,
  isSupported,
  isLoading,
  isUploading,
  isStarted,
  canAdvanceProject,
  advanceProjectLabel,
  messagesEndRef,
  onAnswerChange,
  onSendAnswer,
  onCancelDrill,
  onToggleRecording,
  onStartSelectedProject,
  onRestartCurrentProject,
  onContinueCurrentProject,
  onGoNextProject,
  onStartDrill,
}: ResumeDrillChatPanelProps) {
  return (
    <Box
      sx={{
        display: "flex",
        minHeight: 0,
        minWidth: 0,
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "neutral.200" }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          spacing={2}
          alignItems={{ xs: "stretch", sm: "center" }}
          sx={{ minWidth: 0 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography level="title-md" noWrap>
              {previewProject?.name || "No resume loaded"}
            </Typography>
            <Typography
              level="body-sm"
              sx={{
                color: "neutral.500",
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflowWrap: "anywhere",
              }}
            >
              {previewProject?.summary || "Upload a PDF, TXT, or MD resume to begin."}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
            {isStarted && activeProject && (
              <Chip color="warning" variant="soft" size="sm">
                Project {activeProjectIndex + 1}/{resume?.projects.length || 0} · Point{" "}
                {activePointNumber}/{drillPointCount} · Q {questionNumber}/{questionsPerProject}
              </Chip>
            )}
          </Stack>
        </Stack>
      </Box>

      {error && (
        <Alert color="danger" variant="soft" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          p: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        {!resume && (
          <Box sx={{ py: 8, textAlign: "center", color: "neutral.500" }}>
            <DescriptionIcon sx={{ fontSize: 48, mb: 1, color: "neutral.300" }} />
            <Typography level="title-md">Upload your current resume</Typography>
            <Typography level="body-sm">
              The parsed project list will stay attached to your account.
            </Typography>
          </Box>
        )}

        {hasPendingProjectSelection && selectedProject && (
          <Box sx={{ py: 8, textAlign: "center", color: "neutral.500" }}>
            <GavelIcon sx={{ fontSize: 44, mb: 1, color: "neutral.300" }} />
            <Typography level="title-md">{selectedProject.name}</Typography>
            <Typography level="body-sm">
              Start this project to clear the previous drill view and generate its first question.
            </Typography>
          </Box>
        )}

        {visibleMessages.map((message) => (
          <Stack
            key={message.id}
            direction="row"
            spacing={1.5}
            justifyContent={message.sender === "user" ? "flex-end" : "flex-start"}
            alignItems="flex-start"
          >
            {message.sender === "ai" && (
              <Avatar size="sm" sx={{ bgcolor: "#111827", color: "#fff" }}>
                <GavelIcon fontSize="small" />
              </Avatar>
            )}
            <Card
              variant={message.sender === "user" ? "soft" : "outlined"}
              sx={{
                maxWidth: { xs: "88%", md: "74%" },
                bgcolor: message.sender === "user" ? "warning.50" : "background.surface",
                borderColor: message.sender === "user" ? "warning.200" : "neutral.200",
              }}
            >
              <CardContent sx={{ p: 1.5 }}>
                {message.id.startsWith("temp-") && !message.content ? (
                  <Typography level="body-sm" sx={{ color: "neutral.500" }}>
                    Drilling into the project...
                  </Typography>
                ) : (
                  <Typography
                    level="body-md"
                    component="div"
                    sx={{ "& p": { m: 0 }, "& p + p": { mt: 1 } }}
                  >
                    <Markdown>{message.content}</Markdown>
                  </Typography>
                )}
                {message.score !== undefined && (
                  <Chip
                    size="sm"
                    color={
                      message.score >= 80 ? "success" : message.score >= 65 ? "warning" : "danger"
                    }
                    sx={{ mt: 1 }}
                  >
                    {message.score}/100
                  </Chip>
                )}
              </CardContent>
            </Card>
          </Stack>
        ))}
        <div ref={messagesEndRef} />
      </Box>

      <Divider />
      <Box sx={{ p: 2, bgcolor: "neutral.50", flexShrink: 0 }}>
        {isComplete ? (
          <Alert color="success" variant="soft">
            Resume drill completed. Your project-level records were saved.
          </Alert>
        ) : awaitingAnswer && currentQuestion ? (
          <Stack spacing={1}>
            <Textarea
              minRows={2}
              maxRows={7}
              placeholder={
                isRecording
                  ? "Listening..."
                  : "Answer with concrete implementation details, tradeoffs, numbers, and what you personally owned..."
              }
              value={currentAnswer}
              onChange={(event) => onAnswerChange(event.target.value)}
              sx={{
                ...(isRecording && {
                  borderColor: "danger.500",
                  "&:focus-within": { borderColor: "danger.500" },
                }),
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  onSendAnswer();
                }
              }}
            />
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "stretch", sm: "center" }}
              spacing={1}
            >
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent={{ xs: "space-between", sm: "flex-start" }}
              >
                <Button
                  size="sm"
                  variant="outlined"
                  color="danger"
                  startDecorator={<CancelIcon />}
                  onClick={onCancelDrill}
                >
                  Cancel Drill
                </Button>
                <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                  Ctrl/Cmd+Enter to send
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1}>
                {isSupported && (
                  <Tooltip title={isRecording ? "Stop recording" : "Start voice input"}>
                    <IconButton
                      variant={isRecording ? "solid" : "outlined"}
                      color={isRecording ? "danger" : "neutral"}
                      size="sm"
                      onClick={onToggleRecording}
                      disabled={isLoading}
                    >
                      {isRecording ? <StopIcon /> : <MicIcon />}
                    </IconButton>
                  </Tooltip>
                )}
                <Button
                  startDecorator={<SendIcon />}
                  disabled={!currentAnswer.trim() || isLoading}
                  loading={isLoading}
                  onClick={onSendAnswer}
                >
                  Send
                </Button>
              </Stack>
            </Stack>
          </Stack>
        ) : canAdvanceProject ? (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            justifyContent="center"
            alignItems="center"
          >
            {hasPendingProjectSelection ? (
              <Button
                color="warning"
                variant="soft"
                startDecorator={<PlayArrowIcon />}
                onClick={onStartSelectedProject}
              >
                Start Selected Project
              </Button>
            ) : (
              <>
                <Button
                  color="neutral"
                  variant="outlined"
                  startDecorator={<ReplayIcon />}
                  onClick={onRestartCurrentProject}
                >
                  Restart Project
                </Button>
                <Button color="primary" variant="soft" onClick={onContinueCurrentProject}>
                  Ask Another Angle
                </Button>
                <Button color="warning" variant="soft" onClick={onGoNextProject}>
                  {advanceProjectLabel}
                </Button>
              </>
            )}
          </Stack>
        ) : !isStarted ? (
          <Stack direction="row" justifyContent="center">
            <Button
              startDecorator={<PlayArrowIcon />}
              disabled={!resume || isLoading || isUploading}
              onClick={onStartDrill}
            >
              Start Drill
            </Button>
          </Stack>
        ) : isStarted && !isLoading ? (
          <Stack direction="row" justifyContent="center">
            <Button
              variant="outlined"
              color="danger"
              startDecorator={<CancelIcon />}
              onClick={onCancelDrill}
            >
              Cancel Drill
            </Button>
          </Stack>
        ) : (
          <Typography level="body-sm" sx={{ color: "neutral.500", textAlign: "center" }}>
            {isLoading
              ? "Generating the next drill question..."
              : "Select a project and start the drill."}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
