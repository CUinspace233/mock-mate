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
} from "@mui/joy";
import {
  Send as SendIcon,
  Person as PersonIcon,
  SmartToy as RobotIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
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
} from "../types/interview";
import CustomAlert from "./CustomAlert";

interface InterviewChatProps {
  selectedPosition: string;
  selectedDifficulty: Difficulty;
  user_id: number;
  interviewStarted: boolean;
  sessionId: string | null;
  onInterviewComplete: () => void;
  onInterviewStart: () => Promise<void>;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  currentQuestion: Message | null;
  setCurrentQuestion: React.Dispatch<React.SetStateAction<Message | null>>;
  awaitingAnswer: boolean;
  setAwaitingAnswer: React.Dispatch<React.SetStateAction<boolean>>;
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
}: InterviewChatProps) {
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateQuestion = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const req: GenerateQuestionRequest = {
        position: selectedPosition as PositionKey,
        difficulty: selectedDifficulty,
        topic: null,
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
  ]);

  useEffect(() => {
    if (interviewStarted && messages.length === 0) {
      generateQuestion();
    }
  }, [interviewStarted, messages.length, generateQuestion]);

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
        position: selectedPosition as PositionKey,
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

  const handleCompleteInterview = () => {
    onInterviewComplete();
  };

  if (!interviewStarted && messages.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography level="h4" sx={{ mb: 2 }}>
          Ready to Start Interview Practice
        </Typography>
        <Typography level="body-lg" color="neutral" sx={{ mb: 3 }}>
          After selecting your target position, click 'Start Interview Practice' to receive
          AI-generated interview questions.
        </Typography>
        <Button size="lg" startDecorator={<RobotIcon />} onClick={handleStartNewQuestion}>
          Get Interview Questions
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
            <Alert color="primary" variant="soft">
              Please answer the question above, then click the send button to submit your answer.
            </Alert>
            <Stack direction="row" spacing={2}>
              <Textarea
                placeholder="Enter your answer here..."
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                minRows={3}
                maxRows={6}
                sx={{ flex: 1 }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.ctrlKey) {
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
                  Ctrl+Enter to send quickly
                </Typography>
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
              startDecorator={<CheckIcon />}
              onClick={handleCompleteInterview}
              color="success"
              variant="soft"
            >
              Complete This Session
            </Button>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
