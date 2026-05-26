import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/joy";
import ResumeDrillChatPanel from "./resume-drill/ResumeDrillChatPanel";
import ResumeDrillSidebar from "./resume-drill/ResumeDrillSidebar";
import ResumePreviewModal from "./resume-drill/ResumePreviewModal";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import {
  formatRecordProjectSection,
  RECORD_SECTION_SEPARATOR,
} from "../utils/interviewRecordDisplay";
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
  type ResumeResource,
} from "../types/interview";

interface ResumeDrillProps {
  isActive: boolean;
  userId: number;
  selectedPosition: string;
  selectedDifficulty: Difficulty;
  openaiApiKey: string;
  openaiModel: string;
  language: string;
  questionCreativity: CreativityLevel;
}

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
  currentRoundQuestionLimit?: number;
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

function formatConversationEntries(
  history: ConversationEntry[],
  role: ConversationEntry["role"],
): string {
  return history
    .filter((entry) => entry.role === role)
    .map((entry) => entry.content.trim())
    .filter(Boolean)
    .join(RECORD_SECTION_SEPARATOR);
}

export default function ResumeDrill({
  isActive,
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
  const [currentRoundQuestionLimit, setCurrentRoundQuestionLimit] = useState(0);
  const [topicDepth, setTopicDepth] = useState(0);
  const [awaitingAnswer, setAwaitingAnswer] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState("");
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [isResumePreviewOpen, setIsResumePreviewOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const shouldJumpToBottomRef = useRef(true);
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
  const activeQuestionLimit = currentRoundQuestionLimit || questionsPerProject;
  const activePointNumber =
    questionNumber > 0
      ? Math.min(drillPointCount, Math.ceil(questionNumber / questionsPerPoint))
      : 0;
  const canAdvanceProject =
    isStarted &&
    !!activeProject &&
    questionNumber >= activeQuestionLimit &&
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
    const scrollContainer = messagesScrollRef.current;
    if (!scrollContainer) return;

    const scrollToBottom = (behavior: ScrollBehavior) => {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior,
      });
    };

    if (shouldJumpToBottomRef.current) {
      shouldJumpToBottomRef.current = false;
      scrollToBottom("auto");
      requestAnimationFrame(() => scrollToBottom("auto"));
      return;
    }

    scrollToBottom("smooth");
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isActive) return;
    shouldJumpToBottomRef.current = true;

    const scrollContainer = messagesScrollRef.current;
    if (!scrollContainer) return;

    const scrollToBottom = () => {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: "auto",
      });
    };

    scrollToBottom();
    requestAnimationFrame(scrollToBottom);
  }, [isActive]);

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

        shouldJumpToBottomRef.current = true;
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
        setCurrentRoundQuestionLimit(draft.currentRoundQuestionLimit ?? questionsPerProject);
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
  }, [hasRestoredDraft, questionsPerProject, resume, userId]);

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
      currentRoundQuestionLimit: activeQuestionLimit,
      topicDepth,
    };
    localStorage.setItem(draftKey(userId), JSON.stringify(draft));
  }, [
    activeProjectIndex,
    activeQuestionLimit,
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
      setIsResumePreviewOpen(false);
      setSelectedProjectIndex(0);
      setActiveProjectIndex(0);
      setMessages([]);
      setCurrentQuestion(null);
      setCurrentAnswer("");
      setConversationHistory([]);
      setOriginalQuestion("");
      setMainQuestionId(null);
      setQuestionNumber(0);
      setCurrentRoundQuestionLimit(questionsPerProject);
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
      setIsResumePreviewOpen(false);
      setMessages([]);
      setCurrentQuestion(null);
      setCurrentAnswer("");
      setConversationHistory([]);
      setOriginalQuestion("");
      setMainQuestionId(null);
      setQuestionNumber(0);
      setCurrentRoundQuestionLimit(questionsPerProject);
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
      questionLimitOverride?: number,
      promptHistory?: ConversationEntry[],
    ) => {
      if (!resume) return;
      const project = resume.projects[projectIndex];
      if (!project) return;
      const questionLimit = questionLimitOverride ?? activeQuestionLimit;
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

      const historyForPrompt = promptHistory ?? history;
      const final =
        nextQuestionNumber === 1 && !promptHistory?.length
          ? await generateResumeQuestionStream(
              {
                resume_id: resume.id,
                project,
                resume_summary: resumeSummary,
                question_number: nextQuestionNumber,
                questions_per_project: questionLimit,
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
                questions_per_project: questionLimit,
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
                conversation_history: historyForPrompt,
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
      activeQuestionLimit,
      drillPointCount,
      followUpsPerPoint,
      questionsPerPoint,
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
    setCurrentRoundQuestionLimit(questionsPerProject);
    setTopicDepth(0);
    try {
      const session = await startInterviewSession({
        user_id: userId,
        position: selectedPosition,
        session_type: SessionType.RESUME_DRILL,
      });
      setSessionId(session.session_id);
      await streamQuestion(
        startIndex,
        1,
        [],
        session.session_id,
        undefined,
        false,
        questionsPerProject,
      );
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
    setCurrentRoundQuestionLimit(questionsPerProject);
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
    const interviewerQuestions =
      formatConversationEntries(history, "interviewer") || originalQuestion;
    const questionContent = [
      formatRecordProjectSection(activeProject.name),
      interviewerQuestions,
    ].join(RECORD_SECTION_SEPARATOR);
    const candidateAnswers = formatConversationEntries(history, "candidate");

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
      question_content: questionContent,
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
      if (questionNumber < activeQuestionLimit) {
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
          activeQuestionLimit,
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
    setCurrentRoundQuestionLimit(questionsPerProject);
    setTopicDepth(0);
    setAwaitingAnswer(false);
    setIsStarted(true);
    setIsComplete(false);
    await streamQuestion(
      projectIndex,
      1,
      [],
      sessionIdOverride,
      undefined,
      false,
      questionsPerProject,
    );
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
    const previousHistory = conversationHistory;
    setError("");
    setCurrentQuestion(null);
    setCurrentAnswer("");
    setConversationHistory([]);
    setOriginalQuestion("");
    setMainQuestionId(null);
    setQuestionNumber(0);
    setCurrentRoundQuestionLimit(questionsPerPoint);
    setAwaitingAnswer(false);

    try {
      await streamQuestion(
        activeProjectIndex,
        1,
        [],
        undefined,
        0,
        true,
        questionsPerPoint,
        previousHistory,
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
        height: { xs: "auto", md: "calc(100dvh - 245px)" },
        minHeight: 0,
        display: "grid",
        gridTemplateColumns: {
          xs: "minmax(0, 1fr)",
          md: isSidebarCollapsed ? "64px minmax(0, 1fr)" : "minmax(260px, 320px) minmax(0, 1fr)",
        },
        gridTemplateRows: { xs: "auto auto", md: "minmax(0, 1fr)" },
        overflow: { xs: "visible", md: "hidden" },
      }}
    >
      <ResumeDrillSidebar
        resume={resume}
        projects={projects}
        isUploading={isUploading}
        isStarted={isStarted}
        canAdvanceProject={canAdvanceProject}
        selectedProjectIndex={selectedProjectIndex}
        activeProjectIndex={activeProjectIndex}
        drillPointCount={drillPointCount}
        followUpsPerPoint={followUpsPerPoint}
        questionsPerProject={questionsPerProject}
        isResumePreviewOpen={isResumePreviewOpen}
        isCollapsed={isSidebarCollapsed}
        onUpload={(file) => void handleUpload(file)}
        onDeleteResume={() => void handleDeleteResume()}
        onPreviewResume={() => setIsResumePreviewOpen((open) => !open)}
        onToggleCollapse={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
        onDrillPointCountChange={setDrillPointCount}
        onFollowUpsPerPointChange={setFollowUpsPerPoint}
        onProjectSelect={(projectIndex) => void handleProjectSelect(projectIndex)}
      />

      <ResumeDrillChatPanel
        resume={resume}
        previewProject={previewProject}
        selectedProject={selectedProject}
        activeProject={activeProject}
        activeProjectIndex={activeProjectIndex}
        activePointNumber={activePointNumber}
        drillPointCount={drillPointCount}
        questionNumber={questionNumber}
        questionsPerProject={activeQuestionLimit}
        error={error}
        hasPendingProjectSelection={hasPendingProjectSelection}
        visibleMessages={visibleMessages}
        isComplete={isComplete}
        awaitingAnswer={awaitingAnswer}
        currentQuestion={currentQuestion}
        isRecording={isRecording}
        currentAnswer={currentAnswer}
        isSupported={isSupported}
        isLoading={isLoading}
        isUploading={isUploading}
        isStarted={isStarted}
        canAdvanceProject={canAdvanceProject}
        advanceProjectLabel={advanceProjectLabel}
        messagesScrollRef={messagesScrollRef}
        onAnswerChange={setCurrentAnswer}
        onSendAnswer={() => void handleSendAnswer()}
        onCancelDrill={() => void cancelDrill()}
        onToggleRecording={toggleRecording}
        onStartSelectedProject={() => void startSelectedProject()}
        onRestartCurrentProject={() => void restartCurrentProject()}
        onContinueCurrentProject={() => void continueCurrentProject()}
        onGoNextProject={() => void goNextProject()}
        onStartDrill={() => void startDrill()}
      />

      <ResumePreviewModal
        open={isResumePreviewOpen}
        resume={resume}
        onClose={() => setIsResumePreviewOpen(false)}
      />
    </Box>
  );
}
