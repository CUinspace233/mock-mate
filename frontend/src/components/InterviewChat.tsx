import { useState, useEffect, useRef, useCallback } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Textarea,
  Stack,
  Avatar,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  Modal,
  ModalDialog,
  ModalClose,
} from "@mui/joy";
import {
  Send as SendIcon,
  Person as PersonIcon,
  SmartToy as RobotIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  ExitToApp as ExitIcon,
} from "@mui/icons-material";
import {
  generateQuestion as generateQuestionApi,
  evaluateAnswer as evaluateAnswerApi,
  saveInterviewRecord,
} from "../api/api";
import {
  type EvaluateAnswerResponse,
  type GenerateQuestionRequest,
  type PositionKey,
  Difficulty,
  type Message,
  type NewsQuestion,
  QuestionType,
} from "../types/interview";
import CustomAlert from "./CustomAlert";
import { formatRelativeTime } from "../utils";

interface InterviewChatProps {
  selectedPosition: string;
  selectedDifficulty: Difficulty;
  user_id: number;
  interviewStarted: boolean;
  sessionId: string | null;
  onInterviewComplete: () => Promise<void>;
  onInterviewStart: () => Promise<void>;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  currentQuestion: Message | null;
  setCurrentQuestion: React.Dispatch<React.SetStateAction<Message | null>>;
  awaitingAnswer: boolean;
  setAwaitingAnswer: React.Dispatch<React.SetStateAction<boolean>>;
  presetQuestion?: NewsQuestion | null;
  onPresetQuestionUsed?: () => void;
  questionType: QuestionType;
}

export default function InterviewChat({
  selectedPosition,
  selectedDifficulty,
  user_id,
  interviewStarted,
  sessionId,
  onInterviewComplete,
  onInterviewStart,
  messages,
  setMessages,
  currentQuestion,
  setCurrentQuestion,
  awaitingAnswer,
  setAwaitingAnswer,
  presetQuestion,
  onPresetQuestionUsed,
  questionType,
}: InterviewChatProps) {
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCompletingInterview, setIsCompletingInterview] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showAlert, setShowAlert] = useState(true);
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (awaitingAnswer && currentQuestion) {
      setShowAlert(true);
      const timer = setTimeout(() => setShowAlert(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [awaitingAnswer, currentQuestion]);

  const generateQuestion = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const req: GenerateQuestionRequest = {
        position: selectedPosition as PositionKey,
        difficulty: selectedDifficulty,
        question_type: questionType,
        user_id: user_id,
      };

      const data = await generateQuestionApi(req);

      const questionMessage: Message = {
        id: data.question_id,
        sender: "ai",
        content: data.content || "",
        timestamp: new Date(data.created_at),
      };

      setMessages((prev) => [...prev, questionMessage]);
      setCurrentQuestion(questionMessage);
      setAwaitingAnswer(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to generate question. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedPosition,
    user_id,
    selectedDifficulty,
    setMessages,
    setCurrentQuestion,
    setAwaitingAnswer,
    questionType,
  ]);

  const processPresetQuestion = useCallback(
    (newsQuestion: NewsQuestion) => {
      const newsInfoMessage: Message = {
        id: `news-info-${newsQuestion.id}`,
        sender: "ai",
        content: `Interview Question based on the latest news\n\nSource: ${
          newsQuestion.source_title
        }\nPublished Time: ${formatRelativeTime(newsQuestion.published_at)}\nRelevance: ${(
          newsQuestion.relevance_score * 100
        ).toFixed(0)}%\n\n---\n\n`,
        timestamp: new Date(),
      };

      const questionMessage: Message = {
        id: newsQuestion.id,
        sender: "ai",
        content: newsQuestion.content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, newsInfoMessage, questionMessage]);
      setCurrentQuestion(questionMessage);
      setAwaitingAnswer(true);

      if (onPresetQuestionUsed) {
        onPresetQuestionUsed();
      }
    },
    [setMessages, setCurrentQuestion, setAwaitingAnswer, onPresetQuestionUsed],
  );

  useEffect(() => {
    if (interviewStarted && messages.length === 0) {
      if (presetQuestion) {
        processPresetQuestion(presetQuestion);
      } else {
        generateQuestion();
      }
    }
  }, [interviewStarted, messages.length, presetQuestion, processPresetQuestion, generateQuestion]);

  const handleSendAnswer = async () => {
    if (!currentAnswer.trim() || !currentQuestion) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      content: currentAnswer,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setCurrentAnswer("");
    setIsLoading(true);
    setAwaitingAnswer(false);

    try {
      const evaluationResponse = await evaluateAnswerApi({
        question_id: currentQuestion.id,
        user_id: user_id,
        answer: currentAnswer,
      });

      const evaluationContent = formatEvaluationContent(evaluationResponse);

      const evaluationMessage: Message = {
        id: evaluationResponse.evaluation_id,
        sender: "ai",
        content: evaluationContent,
        timestamp: new Date(evaluationResponse.created_at),
        score: evaluationResponse.score,
        feedback: evaluationContent,
        strengths: evaluationResponse.strengths,
        improvements: evaluationResponse.improvements,
        keywordsCovered: evaluationResponse.keywords_covered,
        keywordsMissed: evaluationResponse.keywords_missed,
        evaluation_details: evaluationResponse.evaluation_details,
      };

      setMessages((prev) => [...prev, evaluationMessage]);

      saveInterviewRecord(user_id, {
        id: null,
        created_at: null,
        question_content: currentQuestion.content,
        answer: currentAnswer,
        score: evaluationMessage.score || 0,
        feedback: evaluationContent,
        position: (presetQuestion?.position as PositionKey) || (selectedPosition as PositionKey),
        session_id: sessionId || null,
        question_id: currentQuestion.id,
        user_id: user_id,
        evaluation_details: evaluationMessage.evaluation_details || {
          technical_accuracy: 0,
          communication_clarity: 0,
          completeness: 0,
          practical_experience: 0,
        },
      });

      setCurrentQuestion(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(`Failed to evaluate answer: ${err.message}`);
      } else {
        setError("Failed to evaluate answer. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatEvaluationContent = (evaluation: EvaluateAnswerResponse): string => {
    let content = `Score: ${evaluation.score}/100\n\n`;
    content += `${evaluation.feedback}\n\n`;

    if (evaluation.strengths && evaluation.strengths.length > 0) {
      content += `Strengths:\n${evaluation.strengths.map((s: string) => `• ${s}`).join("\n")}\n\n`;
    }

    if (evaluation.improvements && evaluation.improvements.length > 0) {
      content += `Areas for Improvement:\n${evaluation.improvements
        .map((i: string) => `• ${i}`)
        .join("\n")}\n\n`;
    }

    if (evaluation.keywords_covered && evaluation.keywords_covered.length > 0) {
      content += `Keywords Covered: ${evaluation.keywords_covered.join(", ")}\n`;
    }

    if (evaluation.keywords_missed && evaluation.keywords_missed.length > 0) {
      content += `Keywords Missed: ${evaluation.keywords_missed.join(", ")}\n`;
    }

    return content;
  };

  const handleStartNewQuestion = async () => {
    await onInterviewStart();
  };

  const handleCompleteInterview = async () => {
    setIsCompletingInterview(true);
    try {
      await onInterviewComplete();
    } catch (error) {
      console.error("Failed to complete interview:", error);
    } finally {
      setIsCompletingInterview(false);
    }
  };

  const handleEndSession = () => {
    setShowEndSessionModal(true);
  };

  const handleConfirmEndSession = async () => {
    setShowEndSessionModal(false);
    await handleCompleteInterview();
  };

  if (!interviewStarted && messages.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography level="h4" sx={{ mb: 2 }}>
          Ready to Start Interview Practice
        </Typography>
        <Typography level="body-lg" color="neutral" sx={{ mb: 3 }}>
          After selecting your target position and difficulty,
          <br />
          click 'Get Interview Questions' to receive AI-generated interview questions.
        </Typography>
        <Button
          size="lg"
          startDecorator={isLoading ? undefined : <RobotIcon />}
          onClick={handleStartNewQuestion}
          loading={isLoading}
          disabled={isLoading}
        >
          {isLoading ? "Generating Questions..." : "Get Interview Questions"}
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "600px", display: "flex", flexDirection: "column" }}>
      {/* Error Alert */}
      {error && (
        <Box sx={{ p: 2 }}>
          <CustomAlert type="error" title="Error" message={error} onClose={() => setError("")} />
        </Box>
      )}

      {/* Messages Area */}
      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          p: 2,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {messages.map((message) => (
          <Stack
            key={message.id}
            direction="row"
            spacing={2}
            sx={{
              alignItems: "flex-start",
              justifyContent: message.sender === "user" ? "flex-end" : "flex-start",
            }}
          >
            {message.sender === "ai" && (
              <Avatar size="sm" color="primary">
                <RobotIcon />
              </Avatar>
            )}

            <Card
              variant={message.sender === "user" ? "soft" : "outlined"}
              color={message.sender === "user" ? "primary" : "neutral"}
              sx={{
                maxWidth: "70%",
                ...(message.sender === "user" && {
                  order: -1,
                  bgcolor: "primary.100",
                  borderColor: "primary.200",
                }),
                ...(message.sender === "ai" && {
                  bgcolor: "background.surface",
                  borderColor: "neutral.200",
                }),
              }}
            >
              <CardContent sx={{ p: 2 }}>
                <Typography
                  level="body-md"
                  sx={{
                    whiteSpace: "pre-wrap",
                    color: message.sender === "user" ? "primary.800" : "text.primary",
                  }}
                >
                  {message.content}
                </Typography>
                {message.score && (
                  <Box sx={{ mt: 1 }}>
                    <Chip
                      size="sm"
                      color={
                        message.score >= 80 ? "success" : message.score >= 70 ? "warning" : "danger"
                      }
                      startDecorator={message.score >= 80 ? <CheckIcon /> : <CancelIcon />}
                    >
                      {message.score}/100
                    </Chip>
                  </Box>
                )}
                <Typography level="body-xs" color="neutral" sx={{ mt: 1 }}>
                  {message.timestamp.toLocaleTimeString()}
                </Typography>
              </CardContent>
            </Card>

            {message.sender === "user" && (
              <Avatar size="sm" color="neutral">
                <PersonIcon />
              </Avatar>
            )}
          </Stack>
        ))}

        {isLoading && (
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar size="sm" color="primary">
              <RobotIcon />
            </Avatar>
            <Card variant="soft">
              <CardContent sx={{ p: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <CircularProgress size="sm" />
                  <Typography level="body-sm" color="neutral">
                    Mock Mate is thinking...
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        )}

        <div ref={messagesEndRef} />
      </Box>

      <Divider />

      {/* Input Area */}
      <Box sx={{ p: 2 }}>
        {awaitingAnswer && currentQuestion ? (
          <Stack spacing={2}>
            {showAlert && (
              <Alert color="primary" variant="soft">
                Please answer the question above, then click the send button to submit your answer.
              </Alert>
            )}
            <Stack direction="row" spacing={2}>
              <Textarea
                placeholder="Enter your answer here..."
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                minRows={3}
                maxRows={10}
                sx={{ flex: 1 }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    handleSendAnswer();
                  }
                }}
              />
              <Stack spacing={1}>
                <Button
                  startDecorator={<SendIcon />}
                  onClick={handleSendAnswer}
                  disabled={!currentAnswer.trim() || isLoading}
                  color="primary"
                >
                  Send Answer
                </Button>

                <Typography level="body-xs" color="neutral">
                  Ctrl/Cmd+Enter to send
                </Typography>
                <Button
                  startDecorator={<ExitIcon />}
                  onClick={handleEndSession}
                  variant="outlined"
                  color="danger"
                  size="sm"
                >
                  End Session
                </Button>
              </Stack>
            </Stack>
          </Stack>
        ) : (
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button
              startDecorator={<RefreshIcon />}
              onClick={handleStartNewQuestion}
              disabled={isLoading}
              variant="outlined"
            >
              Get New Question
            </Button>
            <Button
              startDecorator={isCompletingInterview ? undefined : <CheckIcon />}
              onClick={handleCompleteInterview}
              color="success"
              variant="soft"
              loading={isCompletingInterview}
              disabled={isCompletingInterview}
            >
              {isCompletingInterview ? "Completing..." : "Complete This Session"}
            </Button>
          </Stack>
        )}
      </Box>

      {/* End Session Confirmation Modal */}
      <Modal
        open={showEndSessionModal}
        onClose={() => setShowEndSessionModal(false)}
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          p: 2,
        }}
      >
        <ModalDialog
          variant="outlined"
          sx={{
            maxWidth: 400,
            width: "90vw",
          }}
        >
          <ModalClose />
          <Box sx={{ p: 2 }}>
            <Typography level="h4" sx={{ mb: 2, textAlign: "center" }}>
              End Interview Session
            </Typography>
            <Typography level="body-md" sx={{ mb: 3, textAlign: "center" }}>
              Are you sure you want to end this interview session? Your current progress might not
              be saved.
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button
                variant="outlined"
                color="neutral"
                onClick={() => setShowEndSessionModal(false)}
              >
                Cancel
              </Button>
              <Button
                color="danger"
                onClick={handleConfirmEndSession}
                loading={isCompletingInterview}
                disabled={isCompletingInterview}
              >
                {isCompletingInterview ? "Ending..." : "End Session"}
              </Button>
            </Stack>
          </Box>
        </ModalDialog>
      </Modal>
    </Box>
  );
}
