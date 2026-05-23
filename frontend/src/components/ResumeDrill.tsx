import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Option,
  Select,
  Stack,
  Textarea,
  Tooltip,
  Typography,
} from "@mui/joy";
import {
  Delete as DeleteIcon,
  Description as DescriptionIcon,
  Gavel as GavelIcon,
  Mic as MicIcon,
  PlayArrow as PlayArrowIcon,
  Replay as ReplayIcon,
  Send as SendIcon,
  Stop as StopIcon,
  Cancel as CancelIcon,
  UploadFile as UploadFileIcon,
} from "@mui/icons-material";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import {
  completeSession,
  deleteCurrentResume,
  evaluateAnswer,
  evaluateFollowUpConversation,
  generateResumeFollowUpStream,
  generateResumeQuestionStream,
  getCurrentResume,
  getSessionDetail,
  recoverQuestions,
  saveInterviewRecord,
  startInterviewSession,
  uploadResume,
} from "../api/api";
import {
  CreativityLevel,
  Difficulty,
  SessionType,
  type ConversationEntry,
  type EvaluateAnswerResponse,
  type Message,
  type ResumeProject,
  type ResumeResource,
} from "../types/interview";

interface ResumeDrillProps {
  userId: number;
  selectedPosition: string;
  selectedDifficulty: Difficulty;
  openaiApiKey: string;
  openaiModel: string;
  language: string;
  questionCreativity: CreativityLevel;
}

const DRILL_POINT_OPTIONS = [1, 2, 3, 5];
const FOLLOW_UP_ROUND_OPTIONS = [1, 2, 3];

type PersistedMessage = Omit<Message, "timestamp"> & { timestamp: string };

type ResumeDrillDraft = {
  sessionId: string | null;
  messages: PersistedMessage[];
  currentQuestion: PersistedMessage | null;
  currentAnswer: string;
  conversationHistory: ConversationEntry[];
  originalQuestion: string;
  mainQuestionId: string | null;
  questionNumber: number;
  awaitingAnswer: boolean;
  isStarted: boolean;
  isComplete: boolean;
  selectedProjectIndex: number;
  activeProjectIndex: number;
  drillPointCount: number;
  followUpsPerPoint: number;
  questionsPerProject?: number;
  topicDepth: number;
};

const draftKey = (userId: number) => `resume-drill-draft:${userId}`;

const serializeMessage = (message: Message): PersistedMessage => ({
  ...message,
  timestamp: message.timestamp.toISOString(),
});

const deserializeMessage = (message: PersistedMessage): Message => ({
  ...message,
  timestamp: new Date(message.timestamp),
});

function formatEvaluationContent(evaluation: EvaluateAnswerResponse): string {
  let content = `Score: ${evaluation.score}/100\n\n${evaluation.feedback}\n\n`;
  if (evaluation.strengths.length > 0) {
    content += `Strengths:\n${evaluation.strengths.map((s) => `• ${s}`).join("\n")}\n\n`;
  }
  if (evaluation.improvements.length > 0) {
    content += `Areas for Improvement:\n${evaluation.improvements
      .map((i) => `• ${i}`)
      .join("\n")}\n\n`;
  }
  if (evaluation.keywords_covered.length > 0) {
    content += `Keywords Covered: ${evaluation.keywords_covered.join(", ")}\n`;
  }
  if (evaluation.keywords_missed.length > 0) {
    content += `Keywords Missed: ${evaluation.keywords_missed.join(", ")}\n`;
  }
  return content;
}

function projectContext(project: ResumeProject): string {
  return [
    `Project: ${project.name}`,
    project.role ? `Role: ${project.role}` : "",
    project.tech_stack.length ? `Tech: ${project.tech_stack.join(", ")}` : "",
    project.summary,
  ]
    .filter(Boolean)
    .join("\n");
}

export default function ResumeDrill({
  userId,
  selectedPosition,
  selectedDifficulty,
  openaiApiKey,
  openaiModel,
  language,
  questionCreativity,
}: ResumeDrillProps) {
  const [resume, setResume] = useState<ResumeResource | null>(null);
  const [drillPointCount, setDrillPointCount] = useState(3);
  const [followUpsPerPoint, setFollowUpsPerPoint] = useState(1);
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0);
  const [activeProjectIndex, setActiveProjectIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Message | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [conversationHistory, setConversationHistory] = useState<ConversationEntry[]>([]);
  const [originalQuestion, setOriginalQuestion] = useState("");
  const [mainQuestionId, setMainQuestionId] = useState<string | null>(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [topicDepth, setTopicDepth] = useState(0);
  const [awaitingAnswer, setAwaitingAnswer] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState("");
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isRecording, isSupported, toggleRecording, stopRecording } = useSpeechRecognition({
    language,
    onTranscript: (text) => setCurrentAnswer(text),
    onError: (message) => setError(message),
    getCurrentText: () => currentAnswer,
  });

  const projects = resume?.projects || [];
  const activeProject = projects[activeProjectIndex] || null;
  const selectedProject = projects[selectedProjectIndex] || null;
  const questionsPerPoint = followUpsPerPoint + 1;
  const questionsPerProject = drillPointCount * questionsPerPoint;
  const activePointNumber =
    questionNumber > 0
      ? Math.min(drillPointCount, Math.ceil(questionNumber / questionsPerPoint))
      : 0;
  const canAdvanceProject =
    isStarted &&
    !!activeProject &&
    questionNumber >= questionsPerProject &&
    !awaitingAnswer &&
    !isLoading;
  const hasPendingProjectSelection =
    canAdvanceProject && selectedProjectIndex !== activeProjectIndex;
  const previewProject = isStarted && !hasPendingProjectSelection ? activeProject : selectedProject;
  const visibleMessages = hasPendingProjectSelection ? [] : messages;
  const advanceProjectLabel =
    activeProjectIndex + 1 >= projects.length ? "Complete Resume Drill" : "Next Project";
  const resumeSummary = useMemo(() => resume?.content_text.slice(0, 1600) || "", [resume]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!awaitingAnswer) stopRecording();
  }, [awaitingAnswer, stopRecording]);

  useEffect(() => {
    if (!userId) return;
    getCurrentResume(userId)
      .then((data) => {
        setResume(data);
        setSelectedProjectIndex(0);
        setHasRestoredDraft(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load resume.");
      });
  }, [userId]);

  useEffect(() => {
    if (!userId || !resume || hasRestoredDraft) return;
    setHasRestoredDraft(true);
    const rawDraft = localStorage.getItem(draftKey(userId));
    if (!rawDraft) return;

    (async () => {
      try {
        const draft = JSON.parse(rawDraft) as ResumeDrillDraft;
        if (!draft.sessionId) {
          localStorage.removeItem(draftKey(userId));
          return;
        }

        const detail = await getSessionDetail(draft.sessionId);
        if (detail.status !== "active" || detail.session_type !== SessionType.RESUME_DRILL) {
          localStorage.removeItem(draftKey(userId));
          return;
        }

        let restoredMessages = draft.messages.map(deserializeMessage);
        if (restoredMessages.length === 0) {
          const recovered = await recoverQuestions(draft.sessionId, true);
          restoredMessages = recovered
            .filter((question) => question.content)
            .map((question) => ({
              id: question.question_id,
              sender: "ai" as const,
              content: question.content,
              timestamp: new Date(question.created_at),
            }));
        }

        setSessionId(draft.sessionId);
        setMessages(restoredMessages);
        setCurrentQuestion(
          draft.currentQuestion ? deserializeMessage(draft.currentQuestion) : null,
        );
        setCurrentAnswer(draft.currentAnswer);
        setConversationHistory(draft.conversationHistory);
        setOriginalQuestion(draft.originalQuestion);
        setMainQuestionId(draft.mainQuestionId);
        setQuestionNumber(draft.questionNumber);
        setTopicDepth(draft.topicDepth ?? 0);
        setAwaitingAnswer(draft.awaitingAnswer);
        setIsStarted(draft.isStarted);
        setIsComplete(draft.isComplete);
        setSelectedProjectIndex(Math.min(draft.selectedProjectIndex, resume.projects.length - 1));
        setActiveProjectIndex(Math.min(draft.activeProjectIndex, resume.projects.length - 1));
        setDrillPointCount(draft.drillPointCount ?? draft.questionsPerProject ?? 3);
        setFollowUpsPerPoint(draft.followUpsPerPoint ?? 1);
      } catch {
        localStorage.removeItem(draftKey(userId));
      }
    })();
  }, [hasRestoredDraft, resume, userId]);

  useEffect(() => {
    if (!userId || !resume) return;
    if (!sessionId && !isStarted && messages.length === 0) {
      localStorage.removeItem(draftKey(userId));
      return;
    }

    const draft: ResumeDrillDraft = {
      sessionId,
      messages: messages.map(serializeMessage),
      currentQuestion: currentQuestion ? serializeMessage(currentQuestion) : null,
      currentAnswer,
      conversationHistory,
      originalQuestion,
      mainQuestionId,
      questionNumber,
      awaitingAnswer,
      isStarted,
      isComplete,
      selectedProjectIndex,
      activeProjectIndex,
      drillPointCount,
      followUpsPerPoint,
      topicDepth,
    };
    localStorage.setItem(draftKey(userId), JSON.stringify(draft));
  }, [
    activeProjectIndex,
    awaitingAnswer,
    conversationHistory,
    currentAnswer,
    currentQuestion,
    drillPointCount,
    followUpsPerPoint,
    isComplete,
    isStarted,
    mainQuestionId,
    messages,
    originalQuestion,
    questionNumber,
    resume,
    selectedProjectIndex,
    sessionId,
    topicDepth,
    userId,
  ]);

  const addEvaluationMessage = useCallback((evaluation: EvaluateAnswerResponse) => {
    const content = formatEvaluationContent(evaluation);
    const message: Message = {
      id: evaluation.evaluation_id,
      sender: "ai",
      content,
      timestamp: new Date(evaluation.created_at),
      score: evaluation.score,
      feedback: content,
      strengths: evaluation.strengths,
      improvements: evaluation.improvements,
      keywordsCovered: evaluation.keywords_covered,
      keywordsMissed: evaluation.keywords_missed,
      evaluation_details: evaluation.evaluation_details,
    };
    setMessages((prev) => [...prev, message]);
  }, []);

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    if (!openaiApiKey.trim()) {
      setError("Please enter your OpenAI API key before uploading a resume.");
      return;
    }
    setIsUploading(true);
    setError("");
    try {
      const response = await uploadResume({
        userId,
        file,
        openaiApiKey,
        openaiModel,
        language,
      });
      setResume(response.resume);
      setSelectedProjectIndex(0);
      setActiveProjectIndex(0);
      setMessages([]);
      setCurrentQuestion(null);
      setCurrentAnswer("");
      setConversationHistory([]);
      setOriginalQuestion("");
      setMainQuestionId(null);
      setQuestionNumber(0);
      setTopicDepth(0);
      setAwaitingAnswer(false);
      setIsStarted(false);
      setIsComplete(false);
      setSessionId(null);
      localStorage.removeItem(draftKey(userId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload resume.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteResume = async () => {
    setError("");
    try {
      await deleteCurrentResume(userId);
      setResume(null);
      setMessages([]);
      setCurrentQuestion(null);
      setCurrentAnswer("");
      setConversationHistory([]);
      setOriginalQuestion("");
      setMainQuestionId(null);
      setQuestionNumber(0);
      setTopicDepth(0);
      setAwaitingAnswer(false);
      setIsStarted(false);
      setIsComplete(false);
      setSessionId(null);
      localStorage.removeItem(draftKey(userId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete resume.");
    }
  };

  const streamQuestion = useCallback(
    async (
      projectIndex: number,
      nextQuestionNumber: number,
      history: ConversationEntry[],
      sessionIdOverride?: string,
      topicDepthOverride?: number,
      forceNewTopic = false,
    ) => {
      if (!resume) return;
      const project = resume.projects[projectIndex];
      if (!project) return;
      const pointNumber = Math.max(
        1,
        Math.min(drillPointCount, Math.ceil(nextQuestionNumber / questionsPerPoint)),
      );

      const placeholderId = `temp-resume-${Date.now()}`;
      const placeholder: Message = {
        id: placeholderId,
        sender: "ai",
        content: "",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, placeholder]);
      setIsLoading(true);

      const onDelta = (delta: string) => {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === placeholderId
              ? { ...message, content: `${message.content || ""}${delta}` }
              : message,
          ),
        );
      };

      const final =
        nextQuestionNumber === 1
          ? await generateResumeQuestionStream(
              {
                resume_id: resume.id,
                project,
                resume_summary: resumeSummary,
                question_number: nextQuestionNumber,
                questions_per_project: questionsPerProject,
                point_count: drillPointCount,
                followups_per_point: followUpsPerPoint,
                point_number: pointNumber,
                position: selectedPosition,
                difficulty: selectedDifficulty,
                user_id: userId,
                openai_api_key: openaiApiKey,
                openai_model: openaiModel,
                language,
                creativity: questionCreativity,
                session_id: sessionIdOverride || sessionId || undefined,
              },
              onDelta,
            )
          : await generateResumeFollowUpStream(
              {
                resume_id: resume.id,
                project,
                resume_summary: resumeSummary,
                question_number: nextQuestionNumber,
                questions_per_project: questionsPerProject,
                point_count: drillPointCount,
                followups_per_point: followUpsPerPoint,
                point_number: pointNumber,
                position: selectedPosition,
                difficulty: selectedDifficulty,
                user_id: userId,
                openai_api_key: openaiApiKey,
                openai_model: openaiModel,
                language,
                creativity: questionCreativity,
                session_id: sessionIdOverride || sessionId || undefined,
                original_question: originalQuestion,
                conversation_history: history,
                topic_depth: topicDepthOverride ?? topicDepth,
                force_new_topic: forceNewTopic,
              },
              onDelta,
            );

      setMessages((prev) =>
        prev.map((message) =>
          message.id === placeholderId
            ? {
                ...message,
                id: final.question_id,
                content: final.content,
                timestamp: new Date(final.created_at),
              }
            : message,
        ),
      );

      const nextQuestion: Message = {
        id: final.question_id,
        sender: "ai",
        content: final.content,
        timestamp: new Date(final.created_at),
      };

      const nextHistory = [...history, { role: "interviewer" as const, content: final.content }];
      if (nextQuestionNumber === 1) {
        setOriginalQuestion(final.content);
        setMainQuestionId(final.question_id);
      }
      setConversationHistory(nextHistory);
      setQuestionNumber(nextQuestionNumber);
      setTopicDepth(
        nextQuestionNumber <= 1 || forceNewTopic ? 0 : (topicDepthOverride ?? topicDepth),
      );
      setCurrentQuestion(nextQuestion);
      setAwaitingAnswer(true);
      setIsLoading(false);
    },
    [
      language,
      openaiApiKey,
      openaiModel,
      originalQuestion,
      drillPointCount,
      followUpsPerPoint,
      questionsPerPoint,
      questionsPerProject,
      questionCreativity,
      resume,
      resumeSummary,
      selectedDifficulty,
      selectedPosition,
      sessionId,
      topicDepth,
      userId,
    ],
  );

  const startDrill = async () => {
    if (!resume || resume.projects.length === 0) {
      setError("Upload a resume with at least one project first.");
      return;
    }
    if (!openaiApiKey.trim()) {
      setError("Please enter your OpenAI API key before starting resume drill.");
      return;
    }
    setError("");
    setMessages([]);
    setIsComplete(false);
    const startIndex = selectedProjectIndex;
    setActiveProjectIndex(startIndex);
    setIsStarted(true);
    setConversationHistory([]);
    setOriginalQuestion("");
    setMainQuestionId(null);
    setQuestionNumber(0);
    setTopicDepth(0);
    try {
      const session = await startInterviewSession({
        user_id: userId,
        position: selectedPosition,
        session_type: SessionType.RESUME_DRILL,
      });
      setSessionId(session.session_id);
      await streamQuestion(startIndex, 1, [], session.session_id);
    } catch (err: unknown) {
      setIsStarted(false);
      setError(err instanceof Error ? err.message : "Failed to start resume drill.");
    }
  };

  const resetDrillState = () => {
    stopRecording();
    setMessages([]);
    setCurrentQuestion(null);
    setCurrentAnswer("");
    setConversationHistory([]);
    setOriginalQuestion("");
    setMainQuestionId(null);
    setQuestionNumber(0);
    setTopicDepth(0);
    setAwaitingAnswer(false);
    setIsLoading(false);
    setIsStarted(false);
    setIsComplete(false);
    setSessionId(null);
    localStorage.removeItem(draftKey(userId));
  };

  const cancelDrill = async () => {
    const currentSessionId = sessionId;
    resetDrillState();
    if (!currentSessionId) return;
    try {
      await completeSession(currentSessionId, { user_id: userId });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to cancel resume drill.");
    }
  };

  const completeProject = async (history: ConversationEntry[]) => {
    if (!activeProject || !mainQuestionId) return;
    const candidateAnswers = history
      .filter((entry) => entry.role === "candidate")
      .map((entry) => entry.content)
      .join("\n---\n");

    const evaluation =
      history.length > 2
        ? await evaluateFollowUpConversation({
            question_id: mainQuestionId,
            user_id: userId,
            original_question: originalQuestion,
            conversation_history: history,
            session_id: sessionId || undefined,
            openai_api_key: openaiApiKey,
            openai_model: openaiModel,
          })
        : await evaluateAnswer({
            question_id: mainQuestionId,
            user_id: userId,
            answer: candidateAnswers,
            session_id: sessionId || undefined,
            openai_api_key: openaiApiKey,
            openai_model: openaiModel,
          });

    addEvaluationMessage(evaluation);
    await saveInterviewRecord(userId, {
      id: null,
      question_content: `${projectContext(activeProject)}\n\n${originalQuestion}`,
      answer: candidateAnswers,
      score: evaluation.score,
      feedback: formatEvaluationContent(evaluation),
      position: selectedPosition,
      session_id: sessionId,
      question_id: mainQuestionId,
      user_id: userId,
      evaluation_details: evaluation.evaluation_details,
      created_at: null,
    });

    setCurrentQuestion(null);
    setAwaitingAnswer(false);
  };

  const handleSendAnswer = async () => {
    stopRecording();
    if (!currentAnswer.trim() || !currentQuestion || !activeProject) return;

    const answerText = currentAnswer.trim();
    const userMessage: Message = {
      id: `answer-${Date.now()}`,
      sender: "user",
      content: answerText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setCurrentAnswer("");
    setAwaitingAnswer(false);
    setIsLoading(true);
    setError("");

    try {
      const updatedHistory = [
        ...conversationHistory,
        { role: "candidate" as const, content: answerText },
      ];
      setConversationHistory(updatedHistory);
      if (questionNumber < questionsPerProject) {
        const nextQuestionNumber = questionNumber + 1;
        const startsNewPoint = (nextQuestionNumber - 1) % questionsPerPoint === 0;
        const nextTopicDepth = startsNewPoint ? 0 : topicDepth + 1;
        await streamQuestion(
          activeProjectIndex,
          nextQuestionNumber,
          updatedHistory,
          undefined,
          nextTopicDepth,
          startsNewPoint,
        );
      } else {
        await completeProject(updatedHistory);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to process resume drill answer.");
    } finally {
      setIsLoading(false);
    }
  };

  const startProjectAt = async (projectIndex: number, sessionIdOverride?: string) => {
    stopRecording();
    setActiveProjectIndex(projectIndex);
    setSelectedProjectIndex(projectIndex);
    setMessages([]);
    setCurrentQuestion(null);
    setCurrentAnswer("");
    setConversationHistory([]);
    setOriginalQuestion("");
    setMainQuestionId(null);
    setQuestionNumber(0);
    setTopicDepth(0);
    setAwaitingAnswer(false);
    setIsStarted(true);
    setIsComplete(false);
    await streamQuestion(projectIndex, 1, [], sessionIdOverride);
  };

  const goNextProject = async () => {
    if (!resume) return;
    const nextIndex = activeProjectIndex + 1;
    if (nextIndex >= resume.projects.length) {
      if (sessionId) {
        await completeSession(sessionId, { user_id: userId });
      }
      setIsComplete(true);
      setIsStarted(false);
      setSessionId(null);
      localStorage.removeItem(draftKey(userId));
      return;
    }
    await startProjectAt(nextIndex);
  };

  const restartCurrentProject = async () => {
    if (!resume || !activeProject || !isStarted) return;
    setError("");

    try {
      await startProjectAt(activeProjectIndex);
    } catch (err: unknown) {
      setIsLoading(false);
      setError(err instanceof Error ? err.message : "Failed to restart this project.");
    }
  };

  const continueCurrentProject = async () => {
    if (!resume || !activeProject || !isStarted) return;
    stopRecording();
    setError("");
    setCurrentQuestion(null);
    setCurrentAnswer("");
    setAwaitingAnswer(false);

    try {
      await streamQuestion(
        activeProjectIndex,
        questionNumber + 1,
        conversationHistory,
        undefined,
        0,
        true,
      );
    } catch (err: unknown) {
      setIsLoading(false);
      setError(err instanceof Error ? err.message : "Failed to continue this project.");
    }
  };

  const handleProjectSelect = async (projectIndex: number) => {
    if (!isStarted || canAdvanceProject) {
      setSelectedProjectIndex(projectIndex);
      return;
    }
  };

  const startSelectedProject = async () => {
    if (!resume || !selectedProject) return;
    setError("");
    try {
      await startProjectAt(selectedProjectIndex);
    } catch (err: unknown) {
      setIsLoading(false);
      setError(err instanceof Error ? err.message : "Failed to start selected project.");
    }
  };

  return (
    <Box
      sx={{
        width: "100%",
        minWidth: 0,
        height: { xs: "calc(100dvh - 210px)", md: "calc(100dvh - 245px)" },
        minHeight: 0,
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(260px, 320px) minmax(0, 1fr)" },
        gridTemplateRows: { xs: "auto minmax(0, 1fr)", md: "minmax(0, 1fr)" },
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          minWidth: 0,
          borderRight: { md: "1px solid" },
          borderColor: "neutral.200",
          p: 2,
          bgcolor: "#fbfbf7",
          overflow: "auto",
        }}
      >
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Avatar size="sm" sx={{ bgcolor: "#111827", color: "#fff" }}>
              <GavelIcon fontSize="small" />
            </Avatar>
            <Box>
              <Typography level="title-md">Resume Drill</Typography>
              <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                Project-by-project pressure test
              </Typography>
            </Box>
          </Stack>

          <Button
            component="label"
            variant="solid"
            color="neutral"
            startDecorator={<UploadFileIcon />}
            loading={isUploading}
          >
            {resume ? "Replace Resume" : "Upload Resume"}
            <input
              hidden
              type="file"
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                void handleUpload(file);
                event.target.value = "";
              }}
            />
          </Button>

          {resume && (
            <Card variant="outlined" sx={{ bgcolor: "background.surface", boxShadow: "xs" }}>
              <CardContent>
                <Stack direction="row" spacing={1} justifyContent="space-between">
                  <Stack direction="row" spacing={1} sx={{ minWidth: 0 }}>
                    <DescriptionIcon sx={{ color: "neutral.500" }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography level="title-sm" noWrap>
                        {resume.filename}
                      </Typography>
                      <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                        {resume.projects.length} projects parsed
                      </Typography>
                    </Box>
                  </Stack>
                  <IconButton
                    size="sm"
                    color="danger"
                    variant="plain"
                    onClick={() => void handleDeleteResume()}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Stack>
              </CardContent>
            </Card>
          )}

          <Stack spacing={1}>
            <Box>
              <Typography level="body-sm" sx={{ fontWeight: 700 }}>
                Drill points per project
              </Typography>
              <Typography level="body-xs" sx={{ color: "neutral.500", lineHeight: 1.45 }}>
                Distinct project angles AI should cover.
              </Typography>
            </Box>
            <Select
              size="sm"
              value={drillPointCount}
              disabled={isStarted}
              onChange={(_, value) => value && setDrillPointCount(value as number)}
              sx={{ width: "100%" }}
            >
              {DRILL_POINT_OPTIONS.map((count) => (
                <Option key={count} value={count}>
                  {count} points
                </Option>
              ))}
            </Select>
          </Stack>

          <Stack spacing={1}>
            <Box>
              <Typography level="body-sm" sx={{ fontWeight: 700 }}>
                Follow-up rounds per point
              </Typography>
              <Typography level="body-xs" sx={{ color: "neutral.500", lineHeight: 1.45 }}>
                Consecutive follow-ups before AI moves to another point.
              </Typography>
            </Box>
            <Select
              size="sm"
              value={followUpsPerPoint}
              disabled={isStarted}
              onChange={(_, value) => value && setFollowUpsPerPoint(value as number)}
              sx={{ width: "100%" }}
            >
              {FOLLOW_UP_ROUND_OPTIONS.map((count) => (
                <Option key={count} value={count}>
                  {count} {count === 1 ? "round" : "rounds"}
                </Option>
              ))}
            </Select>
            <Typography level="body-xs" sx={{ color: "neutral.500" }}>
              {questionsPerProject} total questions per project.
            </Typography>
          </Stack>

          <Divider />

          <Stack spacing={1}>
            {projects.map((project, index) => (
              <Button
                key={project.project_id}
                variant={index === selectedProjectIndex ? "soft" : "plain"}
                color={index === activeProjectIndex && isStarted ? "warning" : "neutral"}
                disabled={isStarted && !canAdvanceProject}
                onClick={() => void handleProjectSelect(index)}
                sx={{ justifyContent: "flex-start", textAlign: "left", minHeight: 54 }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography level="body-sm" noWrap sx={{ fontWeight: 700 }}>
                    {project.name}
                  </Typography>
                  <Typography level="body-xs" noWrap sx={{ color: "neutral.500" }}>
                    {project.tech_stack.slice(0, 4).join(", ") || project.role || "Resume project"}
                  </Typography>
                </Box>
              </Button>
            ))}
          </Stack>
        </Stack>
      </Box>

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
                  Project {activeProjectIndex + 1}/{projects.length} · Point {activePointNumber}/
                  {drillPointCount} · Q {questionNumber}/{questionsPerProject}
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
                onChange={(event) => setCurrentAnswer(event.target.value)}
                sx={{
                  ...(isRecording && {
                    borderColor: "danger.500",
                    "&:focus-within": { borderColor: "danger.500" },
                  }),
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                    void handleSendAnswer();
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
                    onClick={() => void cancelDrill()}
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
                        onClick={toggleRecording}
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
                    onClick={() => void handleSendAnswer()}
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
                  onClick={() => void startSelectedProject()}
                >
                  Start Selected Project
                </Button>
              ) : (
                <>
                  <Button
                    color="neutral"
                    variant="outlined"
                    startDecorator={<ReplayIcon />}
                    onClick={() => void restartCurrentProject()}
                  >
                    Restart Project
                  </Button>
                  <Button
                    color="primary"
                    variant="soft"
                    onClick={() => void continueCurrentProject()}
                  >
                    Ask Another Angle
                  </Button>
                  <Button color="warning" variant="soft" onClick={() => void goNextProject()}>
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
                onClick={() => void startDrill()}
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
                onClick={() => void cancelDrill()}
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
    </Box>
  );
}
