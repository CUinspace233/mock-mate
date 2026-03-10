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
  Divider,
  Modal,
  ModalDialog,
  ModalClose,
  IconButton,
  Tooltip,
} from "@mui/joy";
import {
  Send as SendIcon,
  Person as PersonIcon,
  PlayArrow as PlayArrowIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  ExitToApp as ExitIcon,
  Mic as MicIcon,
  Stop as StopIcon,
} from "@mui/icons-material";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import {
  generateQuestion as generateQuestionApi,
  generateQuestionStream as generateQuestionStreamApi,
  generateFollowUpStream as generateFollowUpStreamApi,
  evaluateAnswer as evaluateAnswerApi,
  evaluateFollowUpConversation as evaluateFollowUpApi,
  saveInterviewRecord,
} from "../api/api";
import {
  type EvaluateAnswerResponse,
  type GenerateQuestionRequest,
  type ConversationEntry,
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
  openaiApiKey: string;
  questionCountTarget: number;
  currentQuestionNumber: number;
  onQuestionNumberIncrement: () => void;
  followUpLimit: number;
  language: string;
  openaiModel: string;
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
  openaiApiKey,
  questionCountTarget,
  currentQuestionNumber,
  onQuestionNumberIncrement,
  followUpLimit,
  language,
  openaiModel,
}: InterviewChatProps) {
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCompletingInterview, setIsCompletingInterview] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showAlert, setShowAlert] = useState(true);
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_responseId, setResponseId] = useState<string | null>(null); // OpenAI response ID for follow-up chaining

  // Follow-up state
  const [followUpCount, setFollowUpCount] = useState(0);
  const [conversationHistory, setConversationHistory] = useState<ConversationEntry[]>([]);
  const [mainQuestionContent, setMainQuestionContent] = useState("");
  const [mainQuestionId, setMainQuestionId] = useState<string | null>(null);
  const [isInFollowUpMode, setIsInFollowUpMode] = useState(false);

  const { isRecording, isSupported, toggleRecording, stopRecording } = useSpeechRecognition({
    language,
    onTranscript: (text) => setCurrentAnswer(text),
    onError: (msg) => setError(msg),
    getCurrentText: () => currentAnswer,
  });

  // Stop recording when answer area hides
  useEffect(() => {
    if (!awaitingAnswer) stopRecording();
  }, [awaitingAnswer, stopRecording]);

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
        position: selectedPosition,
        difficulty: selectedDifficulty,
        question_type: questionType,
        user_id: user_id,
        openai_api_key: openaiApiKey,
        openai_model: openaiModel,
        is_last_question: currentQuestionNumber + 1 >= questionCountTarget,
        language,
      };

      // Insert a placeholder AI message to stream into
      const placeholderId = `temp-question-${Date.now()}`;
      const placeholderMessage: Message = {
        id: placeholderId,
        sender: "ai",
        content: "",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, placeholderMessage]);

      let firstDeltaHandled = false;

      // Try streaming first
      const finalData = await generateQuestionStreamApi(req, (delta: string) => {
        if (!firstDeltaHandled) {
          firstDeltaHandled = true;
          // Hide spinner once we start receiving content
          setIsLoading(false);
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId ? { ...m, content: (m.content || "") + delta } : m,
          ),
        );
      });

      // Finalize the streamed message with server-provided id and timestamp
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? {
                ...m,
                id: finalData.question_id,
                content: finalData.content || m.content,
                timestamp: new Date(finalData.created_at),
              }
            : m,
        ),
      );

      // Save OpenAI response ID for future follow-up chaining
      if (finalData.response_id) {
        setResponseId(finalData.response_id);
      }

      const questionMessage: Message = {
        id: finalData.question_id,
        sender: "ai",
        content: finalData.content || "",
        timestamp: new Date(finalData.created_at),
      };

      setCurrentQuestion(questionMessage);
      setAwaitingAnswer(true);
      onQuestionNumberIncrement();

      // Initialize follow-up tracking for this question
      if (followUpLimit > 0) {
        const questionContent = finalData.content || "";
        setMainQuestionContent(questionContent);
        setMainQuestionId(finalData.question_id);
        setConversationHistory([{ role: "interviewer", content: questionContent }]);
        setFollowUpCount(0);
        setIsInFollowUpMode(true);
      }
    } catch (err: unknown) {
      // Fallback to non-streaming API
      try {
        const req: GenerateQuestionRequest = {
          position: selectedPosition,
          difficulty: selectedDifficulty,
          question_type: questionType,
          user_id: user_id,
          openai_api_key: openaiApiKey,
          openai_model: openaiModel,
          is_last_question: currentQuestionNumber + 1 >= questionCountTarget,
          language,
        };

        const data = await generateQuestionApi(req);

        // Replace the placeholder (if exists) or append new message
        setMessages((prev) => {
          const hasPlaceholder = prev.some((m) => m.id.startsWith("temp-question-"));
          const next = hasPlaceholder
            ? prev.map((m) =>
                m.id.startsWith("temp-question-")
                  ? {
                      ...m,
                      id: data.question_id,
                      content: data.content || "",
                      timestamp: new Date(data.created_at),
                    }
                  : m,
              )
            : [
                ...prev,
                {
                  id: data.question_id,
                  sender: "ai",
                  content: data.content || "",
                  timestamp: new Date(data.created_at),
                } as Message,
              ];
          return next;
        });

        const questionMessage: Message = {
          id: data.question_id,
          sender: "ai",
          content: data.content || "",
          timestamp: new Date(data.created_at),
        };

        setCurrentQuestion(questionMessage);
        setAwaitingAnswer(true);
        onQuestionNumberIncrement();

        // Initialize follow-up tracking for this question
        if (followUpLimit > 0) {
          const questionContent = data.content || "";
          setMainQuestionContent(questionContent);
          setMainQuestionId(data.question_id);
          setConversationHistory([{ role: "interviewer", content: questionContent }]);
          setFollowUpCount(0);
          setIsInFollowUpMode(true);
        }
      } catch (fallbackErr: unknown) {
        // Remove placeholder if present
        setMessages((prev) => prev.filter((m) => !m.id.startsWith("temp-question-")));
        if (fallbackErr instanceof Error) {
          setError(fallbackErr.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Failed to generate question. Please try again.");
        }
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
    openaiApiKey,
    openaiModel,
    onQuestionNumberIncrement,
    followUpLimit,
    currentQuestionNumber,
    questionCountTarget,
    language,
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
      onQuestionNumberIncrement();

      // Initialize follow-up tracking for preset question
      if (followUpLimit > 0) {
        setMainQuestionContent(newsQuestion.content);
        setMainQuestionId(newsQuestion.id);
        setConversationHistory([{ role: "interviewer", content: newsQuestion.content }]);
        setFollowUpCount(0);
        setIsInFollowUpMode(true);
      }

      if (onPresetQuestionUsed) {
        onPresetQuestionUsed();
      }
    },
    [setMessages, setCurrentQuestion, setAwaitingAnswer, onQuestionNumberIncrement, onPresetQuestionUsed, followUpLimit],
  );

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!interviewStarted) {
      hasInitialized.current = false;
      return;
    }
    if (messages.length === 0 && !hasInitialized.current) {
      hasInitialized.current = true;
      if (presetQuestion) {
        processPresetQuestion(presetQuestion);
      } else {
        generateQuestion();
      }
    }
  }, [interviewStarted, messages.length, presetQuestion, processPresetQuestion, generateQuestion]);

  const resetFollowUpState = () => {
    setFollowUpCount(0);
    setConversationHistory([]);
    setMainQuestionContent("");
    setMainQuestionId(null);
    setIsInFollowUpMode(false);
  };

  const handleEvaluateAndSave = async (
    questionId: string,
    questionContent: string,
    answer: string,
    history: ConversationEntry[],
  ) => {
    let evaluationResponse: EvaluateAnswerResponse;

    if (isInFollowUpMode && history.length > 2) {
      // Multi-turn: evaluate full conversation
      evaluationResponse = await evaluateFollowUpApi({
        question_id: questionId,
        user_id: user_id,
        original_question: mainQuestionContent,
        conversation_history: history,
        session_id: sessionId || undefined,
        openai_api_key: openaiApiKey,
        openai_model: openaiModel,
      });
    } else {
      // Single-turn: evaluate just the answer
      evaluationResponse = await evaluateAnswerApi({
        question_id: questionId,
        user_id: user_id,
        answer: answer,
        openai_api_key: openaiApiKey,
        openai_model: openaiModel,
      });
    }

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

    // Concatenate all candidate answers for the record
    const allAnswers = isInFollowUpMode && history.length > 2
      ? history
          .filter((e) => e.role === "candidate")
          .map((e) => e.content)
          .join("\n---\n")
      : answer;

    saveInterviewRecord(user_id, {
      id: null,
      created_at: null,
      question_content: questionContent,
      answer: allAnswers,
      score: evaluationMessage.score || 0,
      feedback: evaluationContent,
      position: presetQuestion?.position || selectedPosition,
      session_id: sessionId || null,
      question_id: questionId,
      user_id: user_id,
      evaluation_details: evaluationMessage.evaluation_details || {
        technical_accuracy: 0,
        communication_clarity: 0,
        completeness: 0,
        practical_experience: 0,
      },
    });

    setCurrentQuestion(null);
    resetFollowUpState();
  };

  const handleGenerateFollowUp = async (updatedHistory: ConversationEntry[]) => {
    const nextFollowUpNumber = followUpCount + 1;

    // Insert a placeholder for the follow-up question
    const placeholderId = `temp-followup-${Date.now()}`;
    const placeholderMessage: Message = {
      id: placeholderId,
      sender: "ai",
      content: "",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, placeholderMessage]);

    let firstDeltaHandled = false;

    const finalData = await generateFollowUpStreamApi(
      {
        original_question: mainQuestionContent,
        conversation_history: updatedHistory,
        follow_up_number: nextFollowUpNumber,
        max_follow_ups: followUpLimit,
        position: selectedPosition,
        difficulty: selectedDifficulty,
        user_id: user_id,
        openai_api_key: openaiApiKey,
        openai_model: openaiModel,
        language,
      },
      (delta: string) => {
        if (!firstDeltaHandled) {
          firstDeltaHandled = true;
          setIsLoading(false);
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId ? { ...m, content: (m.content || "") + delta } : m,
          ),
        );
      },
    );

    // Finalize the streamed follow-up message
    setMessages((prev) =>
      prev.map((m) =>
        m.id === placeholderId
          ? {
              ...m,
              id: finalData.question_id,
              content: finalData.content || m.content,
              timestamp: new Date(finalData.created_at),
            }
          : m,
      ),
    );

    const followUpMessage: Message = {
      id: finalData.question_id,
      sender: "ai",
      content: finalData.content || "",
      timestamp: new Date(finalData.created_at),
    };

    // Update conversation history with the follow-up question
    const newHistory: ConversationEntry[] = [
      ...updatedHistory,
      { role: "interviewer", content: finalData.content || "" },
    ];
    setConversationHistory(newHistory);
    setFollowUpCount(nextFollowUpNumber);
    setCurrentQuestion(followUpMessage);
    setAwaitingAnswer(true);
  };

  const handleSendAnswer = async () => {
    stopRecording();
    if (!currentAnswer.trim() || !currentQuestion) return;

    const answerText = currentAnswer;
    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      content: answerText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setCurrentAnswer("");
    setIsLoading(true);
    setAwaitingAnswer(false);

    try {
      // If follow-ups are disabled, use original single-turn behavior
      if (followUpLimit === 0 || !isInFollowUpMode) {
        await handleEvaluateAndSave(
          currentQuestion.id,
          currentQuestion.content,
          answerText,
          [],
        );
        return;
      }

      // Follow-up mode: update conversation history with candidate answer
      const updatedHistory: ConversationEntry[] = [
        ...conversationHistory,
        { role: "candidate", content: answerText },
      ];
      setConversationHistory(updatedHistory);

      if (followUpCount < followUpLimit) {
        // Generate follow-up question
        await handleGenerateFollowUp(updatedHistory);
      } else {
        // Reached follow-up limit — evaluate the full conversation
        await handleEvaluateAndSave(
          mainQuestionId || currentQuestion.id,
          mainQuestionContent,
          answerText,
          updatedHistory,
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(`Failed to process answer: ${err.message}`);
      } else {
        setError("Failed to process answer. Please try again.");
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
    generateQuestion();
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
      <Box
        sx={{
          py: { xs: 6, sm: 8 },
          px: { xs: 3, sm: 4 },
          textAlign: "center",
          animation: "slideUp 0.5s ease-out",
        }}
      >
        <Box
          sx={{
            width: { xs: 72, sm: 96 },
            height: { xs: 72, sm: 96 },
            borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(37,99,235,0.12), rgba(23,37,84,0.08))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mx: "auto",
            mb: 3,
          }}
        >
          <Box component="img" src="/robot_icon.png" alt="AI" sx={{ width: { xs: 32, sm: 44 }, height: { xs: 32, sm: 44 } }} />
        </Box>
        <Typography
          level="h3"
          sx={{
            mb: 1.5,
            fontWeight: 700,
            background: "linear-gradient(135deg, #2563eb, #172554)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Ready When You Are
        </Typography>
        <Typography level="body-md" sx={{ color: "neutral.500", mb: 1, maxWidth: 560, mx: "auto", lineHeight: 1.7 }}>
          Configure your position, difficulty, and question type above,
          then start a mock interview session with AI-powered questions.
        </Typography>
        <Typography level="body-sm" sx={{ color: "neutral.400", mb: 4 }}>
          Real-time feedback and scoring after each answer
        </Typography>
        <Button
          size="lg"
          startDecorator={isLoading ? undefined : <PlayArrowIcon />}
          onClick={handleStartNewQuestion}
          loading={isLoading}
          disabled={isLoading}
          sx={{
            px: 5,
            py: 1.5,
            fontSize: "1rem",
            background: "linear-gradient(135deg, #2563eb, #1e40af)",
            boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
            "&:hover": {
              background: "linear-gradient(135deg, #1d4ed8, #1e3a8a)",
              boxShadow: "0 6px 20px rgba(37,99,235,0.4)",
            },
          }}
        >
          {isLoading ? "Generating..." : "Start Interview"}
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ height: { xs: "calc(100vh - 220px)", sm: "600px" }, display: "flex", flexDirection: "column" }}>
      {/* Question Progress */}
      {currentQuestionNumber > 0 && (
        <Box sx={{ px: 2, pt: 1.5, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Chip
            size="sm"
            variant="soft"
            color={currentQuestionNumber >= questionCountTarget ? "success" : "primary"}
          >
            Question {currentQuestionNumber} / {questionCountTarget}
          </Chip>
          {isInFollowUpMode && followUpLimit > 0 && (
            <Chip size="sm" variant="soft" color="warning">
              Follow-up {followUpCount} / {followUpLimit}
            </Chip>
          )}
          {currentQuestionNumber >= questionCountTarget && !awaitingAnswer && !isInFollowUpMode && (
            <Alert size="sm" color="success" variant="soft" sx={{ flex: 1, py: 0.5 }}>
              You've reached your target! Feel free to continue or complete the session.
            </Alert>
          )}
        </Box>
      )}

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
              animation: "fadeIn 0.3s ease-out",
            }}
          >
            {message.sender === "ai" && (
              <Avatar size="sm" sx={{ bgcolor: "primary.100", color: "primary.600" }}>
                <Box component="img" src="/robot_icon.png" alt="AI" sx={{ width: 24, height: 24 }} />
              </Avatar>
            )}

            <Card
              variant={message.sender === "user" ? "soft" : "outlined"}
              sx={{
                maxWidth: { xs: "85%", sm: "70%" },
                boxShadow: "xs",
                ...(message.sender === "user" && {
                  order: -1,
                  bgcolor: "primary.50",
                  borderColor: "primary.200",
                  borderRadius: "16px 16px 4px 16px",
                }),
                ...(message.sender === "ai" && {
                  bgcolor: "background.surface",
                  borderColor: "neutral.200",
                  borderRadius: "16px 16px 16px 4px",
                }),
              }}
            >
              <CardContent sx={{ p: 2 }}>
                {message.id.startsWith("temp-") && !message.content ? (
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    {[0, 1, 2].map((i) => (
                      <Box
                        key={i}
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: "primary.400",
                          animation: "dotPulse 1.4s ease-in-out infinite",
                          animationDelay: `${i * 0.2}s`,
                        }}
                      />
                    ))}
                  </Stack>
                ) : (
                <Typography
                  level="body-md"
                  sx={{
                    whiteSpace: "pre-wrap",
                    color: message.sender === "user" ? "primary.800" : "text.primary",
                  }}
                >
                  {message.content}
                </Typography>
                )}
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
                <Typography level="body-xs" sx={{ color: "neutral.400", mt: 1 }}>
                  {message.timestamp.toLocaleTimeString()}
                </Typography>
              </CardContent>
            </Card>

            {message.sender === "user" && (
              <Avatar size="sm" sx={{ bgcolor: "neutral.200", color: "neutral.600" }}>
                <PersonIcon />
              </Avatar>
            )}
          </Stack>
        ))}

        {isLoading && !messages.some((m) => m.id.startsWith("temp-")) && (
          <Stack direction="row" spacing={2} alignItems="center" sx={{ animation: "fadeIn 0.3s ease-out" }}>
            <Avatar size="sm" sx={{ bgcolor: "primary.100", color: "primary.600" }}>
              <Box component="img" src="/robot_icon.png" alt="AI" sx={{ width: 24, height: 24 }} />
            </Avatar>
            <Card variant="soft" sx={{ borderRadius: "16px 16px 16px 4px" }}>
              <CardContent sx={{ p: 2 }}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  {[0, 1, 2].map((i) => (
                    <Box
                      key={i}
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: "primary.400",
                        animation: "dotPulse 1.4s ease-in-out infinite",
                        animationDelay: `${i * 0.2}s`,
                      }}
                    />
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        )}

        <div ref={messagesEndRef} />
      </Box>

      <Divider />

      {/* Input Area */}
      <Box sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: "neutral.50" }}>
        {awaitingAnswer && currentQuestion ? (
          <Stack spacing={1.5}>
            {showAlert && (
              <Alert color="primary" variant="soft" size="sm">
                Answer the question above, then send your response.
              </Alert>
            )}
            <Textarea
              placeholder={isRecording ? "Listening..." : "Enter your answer here..."}
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              minRows={2}
              maxRows={8}
              sx={{
                width: "100%",
                ...(isRecording && {
                  borderColor: "danger.500",
                  "&:focus-within": { borderColor: "danger.500" },
                }),
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  handleSendAnswer();
                }
              }}
            />
            <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
              <Typography level="body-xs" sx={{ color: "neutral.400", display: { xs: "none", sm: "block" } }}>
                Ctrl/Cmd+Enter to send{isSupported ? " · click mic to speak" : ""}
              </Typography>
              <Stack direction="row" spacing={1}>
                {isSupported && (
                  <Tooltip title={isRecording ? "Stop recording" : "Start voice input"}>
                    <IconButton
                      variant={isRecording ? "solid" : "outlined"}
                      color={isRecording ? "danger" : "neutral"}
                      size="sm"
                      onClick={toggleRecording}
                      disabled={isLoading}
                      sx={isRecording ? {
                        animation: "pulse 1.5s ease-in-out infinite",
                        "@keyframes pulse": {
                          "0%, 100%": { opacity: 1 },
                          "50%": { opacity: 0.6 },
                        },
                      } : undefined}
                    >
                      {isRecording ? <StopIcon /> : <MicIcon />}
                    </IconButton>
                  </Tooltip>
                )}
                <Button
                  startDecorator={<ExitIcon />}
                  onClick={handleEndSession}
                  variant="outlined"
                  color="danger"
                  size="sm"
                >
                  End
                </Button>
                <Button
                  startDecorator={<SendIcon />}
                  onClick={handleSendAnswer}
                  disabled={!currentAnswer.trim() || isLoading}
                  color="primary"
                  size="sm"
                >
                  Send
                </Button>
              </Stack>
            </Stack>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap">
            <Button
              startDecorator={<RefreshIcon />}
              onClick={handleStartNewQuestion}
              disabled={isLoading}
              variant="outlined"
              size="sm"
            >
              New Question
            </Button>
            <Button
              startDecorator={isCompletingInterview ? undefined : <CheckIcon />}
              onClick={handleCompleteInterview}
              color="success"
              variant="soft"
              size="sm"
              loading={isCompletingInterview}
              disabled={isCompletingInterview}
            >
              {isCompletingInterview ? "Completing..." : "Complete Session"}
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
