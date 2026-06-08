import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Box,
  Typography,
  Button,
  Stack,
  Alert,
} from "@mui/joy";
import {
  PlayArrow as PlayArrowIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  ExitToApp as ExitIcon,
} from "@mui/icons-material";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import {
  generateQuestion as generateQuestionApi,
  generateQuestionStream as generateQuestionStreamApi,
  generateFollowUpStream as generateFollowUpStreamApi,
  evaluateAnswer as evaluateAnswerApi,
  evaluateFollowUpConversation as evaluateFollowUpApi,
  openaiModelPayload,
  saveInterviewRecord,
} from "../api/api";
import {
  type EvaluateAnswerResponse,
  type GenerateQuestionRequest,
  type ConversationEntry,
  CreativityLevel,
  Difficulty,
  type Message,
  type NewsQuestion,
  QuestionType,
} from "../types/interview";
import ConfirmActionModal from "./ConfirmActionModal";
import CustomAlert from "./CustomAlert";
import { formatRelativeTime } from "../utils";
import ChatComposer from "./interview/ChatComposer";
import ChatThread from "./interview/ChatThread";

interface InterviewChatProps {
  selectedPosition: string;
  selectedDifficulty: Difficulty;
  user_id: number;
  interviewStarted: boolean;
  isRecoveredSession?: boolean;
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
  questionCreativity: CreativityLevel;
  jobDescription: string;
  setJobDescription: React.Dispatch<React.SetStateAction<string>>;
}

export default function InterviewChat({
  selectedPosition,
  selectedDifficulty,
  user_id,
  interviewStarted,
  isRecoveredSession,
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
  questionCreativity,
  jobDescription,
}: InterviewChatProps) {
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const [isCompletingInterview, setIsCompletingInterview] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showAlert, setShowAlert] = useState(true);
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_responseId, setResponseId] = useState<string | null>(null); // OpenAI response ID for follow-up chaining
  const trimmedJobDescription = jobDescription.trim();
  const jobDescriptionPayload = useMemo(
    () => (trimmedJobDescription ? { job_description: trimmedJobDescription.slice(0, 6000) } : {}),
    [trimmedJobDescription],
  );

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
    const anchor = messagesEndRef.current;
    if (!anchor) return;

    const container = anchor.closest("[data-chat-scroll]");
    if (container instanceof HTMLElement) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      return;
    }

    anchor.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
    const currentPlaceholderId = `temp-question-${Date.now()}`;

    try {
      const req: GenerateQuestionRequest = {
        position: selectedPosition,
        difficulty: selectedDifficulty,
        question_type: questionType,
        user_id: user_id,
        openai_api_key: openaiApiKey,
        ...openaiModelPayload(openaiModel),
        creativity: questionCreativity,
        is_last_question: currentQuestionNumber + 1 >= questionCountTarget,
        language,
        session_id: sessionIdRef.current || undefined,
        ...jobDescriptionPayload,
      };

      // Insert a placeholder AI message to stream into
      const placeholderMessage: Message = {
        id: currentPlaceholderId,
        sender: "ai",
        content: "",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, placeholderMessage]);

      let firstDeltaHandled = false;

      // Try streaming first
      const finalData = await generateQuestionStreamApi(
        req,
        (delta: string) => {
          if (!firstDeltaHandled) {
            firstDeltaHandled = true;
            setIsLoading(false);
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === currentPlaceholderId ? { ...m, content: (m.content || "") + delta } : m,
            ),
          );
        },
        () => {
          // init event received — question_id is available but we don't change
          // the placeholder ID here to avoid race conditions with delta updates.
          // The real ID will be set when the final event arrives.
        },
      );

      // Finalize the streamed message with server-provided id and timestamp
      setMessages((prev) =>
        prev.map((m) =>
          m.id === currentPlaceholderId
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
          ...openaiModelPayload(openaiModel),
          creativity: questionCreativity,
          is_last_question: currentQuestionNumber + 1 >= questionCountTarget,
          language,
          session_id: sessionIdRef.current || undefined,
          ...jobDescriptionPayload,
        };

        const data = await generateQuestionApi(req);

        // Replace the placeholder (if exists) or append new message
        setMessages((prev) => {
          const hasPlaceholder = prev.some(
            (m) => m.id === currentPlaceholderId || m.id.startsWith("temp-question-"),
          );
          const next = hasPlaceholder
            ? prev.map((m) =>
                m.id === currentPlaceholderId || m.id.startsWith("temp-question-")
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
        setMessages((prev) =>
          prev.filter((m) => m.id !== currentPlaceholderId && !m.id.startsWith("temp-question-")),
        );
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
    questionCreativity,
    onQuestionNumberIncrement,
    followUpLimit,
    currentQuestionNumber,
    questionCountTarget,
    language,
    jobDescriptionPayload,
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
    [
      setMessages,
      setCurrentQuestion,
      setAwaitingAnswer,
      onQuestionNumberIncrement,
      onPresetQuestionUsed,
      followUpLimit,
    ],
  );

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!interviewStarted) {
      hasInitialized.current = false;
      return;
    }
    // Skip auto-generation when recovering a session (messages already restored)
    if (isRecoveredSession) {
      hasInitialized.current = true;
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
  }, [
    interviewStarted,
    isRecoveredSession,
    messages.length,
    presetQuestion,
    processPresetQuestion,
    generateQuestion,
  ]);

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
        session_id: sessionIdRef.current || undefined,
        openai_api_key: openaiApiKey,
        ...openaiModelPayload(openaiModel),
        ...jobDescriptionPayload,
      });
    } else {
      // Single-turn: evaluate just the answer
      evaluationResponse = await evaluateAnswerApi({
        question_id: questionId,
        user_id: user_id,
        answer: answer,
        openai_api_key: openaiApiKey,
        ...openaiModelPayload(openaiModel),
        ...jobDescriptionPayload,
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
    const allAnswers =
      isInFollowUpMode && history.length > 2
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
      session_id: sessionIdRef.current || null,
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
        ...openaiModelPayload(openaiModel),
        creativity: questionCreativity,
        language,
        session_id: sessionIdRef.current || undefined,
        ...jobDescriptionPayload,
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
        await handleEvaluateAndSave(currentQuestion.id, currentQuestion.content, answerText, []);
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
    hasInitialized.current = true;
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
          minHeight: { xs: "calc(100dvh - 180px)", md: "calc(100dvh - 120px)" },
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          py: { xs: 4, sm: 7 },
          px: { xs: 1, sm: 3 },
          textAlign: "center",
          animation: "slideUp 0.5s ease-out",
        }}
      >
        <Stack spacing={3} sx={{ maxWidth: 760, mx: "auto", width: "100%" }}>
          <Stack spacing={1}>
            <Typography level="h2" sx={{ fontWeight: 750, letterSpacing: 0 }}>
              Practice like the interview starts today.
            </Typography>
            <Typography level="body-md" sx={{ color: "neutral.600", lineHeight: 1.7, maxWidth: 620, mx: "auto" }}>
              Start a focused AI interview round, answer in your own words, then get structured
              feedback that reads like a strong interview coach.
            </Typography>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
              gap: 1,
              textAlign: "left",
            }}
          >
            {[
              "Ask me a system design follow-up",
              "Pressure-test my project ownership",
              "Grade my communication clarity",
            ].map((prompt) => (
              <Box
                key={prompt}
                sx={{
                  border: "1px solid",
                  borderColor: "neutral.200",
                  borderRadius: "lg",
                  bgcolor: "background.surface",
                  px: 1.5,
                  py: 1.25,
                  color: "neutral.700",
                  fontSize: "0.9rem",
                }}
              >
                {prompt}
              </Box>
            ))}
          </Box>

          <Stack spacing={1.5} alignItems="center">
            <Button
              size="lg"
              startDecorator={isLoading ? undefined : <PlayArrowIcon />}
              onClick={() => {
                if (!openaiApiKey.trim()) {
                  setError("Please enter your OpenAI API key in Setup before starting an interview.");
                  return;
                }
                handleStartNewQuestion();
              }}
              loading={isLoading}
              disabled={isLoading}
              sx={{ px: 4 }}
            >
              {isLoading ? "Generating..." : "Start interview"}
            </Button>
            {error && (
              <Alert color="danger" variant="soft" sx={{ maxWidth: 460 }}>
                {error}
              </Alert>
            )}
          </Stack>
        </Stack>
      </Box>
    );
  }

  const threadMessages =
    isLoading && !messages.some((m) => m.id.startsWith("temp-"))
      ? [
          ...messages,
          {
            id: "temp-loading",
            sender: "ai" as const,
            content: "",
            timestamp: new Date(),
          },
        ]
      : messages;

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {error && (
        <Box sx={{ maxWidth: 860, mx: "auto", width: "100%", px: 1, pt: 1 }}>
          <CustomAlert type="error" title="Error" message={error} onClose={() => setError("")} />
        </Box>
      )}
      <ChatThread
        messages={threadMessages}
        currentQuestionNumber={currentQuestionNumber}
        questionCountTarget={questionCountTarget}
        followUpCount={followUpCount}
        followUpLimit={followUpLimit}
        isInFollowUpMode={isInFollowUpMode}
        bottomRef={messagesEndRef}
      />

      <Box sx={{ position: "sticky", bottom: 0, px: { xs: 0.5, sm: 1 }, pb: 1.5, pt: 1 }}>
        {awaitingAnswer && currentQuestion ? (
          <Stack spacing={1.5}>
            {showAlert && (
              <Alert color="primary" variant="soft" size="sm" sx={{ maxWidth: 860, mx: "auto", width: "100%" }}>
                Answer the question above, then send your response.
              </Alert>
            )}
            <ChatComposer
              value={currentAnswer}
              onChange={setCurrentAnswer}
              onSend={handleSendAnswer}
              disabled={isLoading}
              loading={isLoading}
              isRecording={isRecording}
              isSupported={isSupported}
              onToggleRecording={toggleRecording}
              placeholder="Answer with concrete examples, tradeoffs, and what you personally owned..."
              leftAction={
                <Button
                  startDecorator={<ExitIcon />}
                  onClick={handleEndSession}
                  variant="outlined"
                  color="danger"
                  size="sm"
                >
                  End
                </Button>
              }
            />
          </Stack>
        ) : (
          <Stack
            direction="row"
            spacing={1}
            justifyContent="center"
            flexWrap="wrap"
            sx={{
              maxWidth: 860,
              mx: "auto",
              p: 1,
              bgcolor: "background.surface",
              border: "1px solid",
              borderColor: "neutral.200",
              borderRadius: "lg",
              boxShadow: "xs",
            }}
          >
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

      <ConfirmActionModal
        open={showEndSessionModal}
        onClose={() => setShowEndSessionModal(false)}
        onConfirm={() => void handleConfirmEndSession()}
        title="End Interview Session"
        description="Are you sure you want to end this interview session? Your current progress might not be saved."
        confirmLabel="End Session"
        loading={isCompletingInterview}
      />
    </Box>
  );
}
