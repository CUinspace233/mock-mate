import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Box,
} from "@mui/joy";
import InterviewChat from "./InterviewChat.tsx";
import InterviewHistory from "./InterviewHistory.tsx";
import ProgressChart from "./ProgressChart.tsx";
import ResumeDrill from "./ResumeDrill.tsx";
import {
  startInterviewSession,
  completeSession,
  getSessionDetail,
  recoverQuestions,
} from "../api/api";
import type { Message } from "../types/interview.ts";
import {
  QuestionType,
} from "../types/interview";
import NewsQuestionPush from "./NewsQuestionPush.tsx";
import type { NewsQuestion } from "../types/interview.ts";
import { useAuthStore } from "../stores/useAuthStore.ts";
import { useDebounceWithImmediate } from "../hooks/useDebounce.ts";
import { decryptApiKey } from "../crypto.ts";
import AppShell from "./app-shell/AppShell.tsx";
import WorkspaceMain from "./app-shell/WorkspaceMain.tsx";
import PracticeSetupPanel from "./interview/PracticeSetupPanel.tsx";

interface InterviewTrainingProps {
  username: string;
  onLogout: () => void;
}

export default function InterviewTraining({ username, onLogout }: InterviewTrainingProps) {
  const location = useLocation();
  const navigate = useNavigate();
  // zustand hooks
  const user_id = useAuthStore((state) => state.user_id);
  const dailyQuestionCount = useAuthStore((state) => state.dailyQuestionCount);
  const setDailyQuestionCount = useAuthStore((state) => state.setDailyQuestionCount);
  const dailyQuestionDate = useAuthStore((state) => state.dailyQuestionDate);
  const setDailyQuestionDate = useAuthStore((state) => state.setDailyQuestionDate);
  const selectedPosition = useAuthStore((state) => state.selectedPosition);
  const setSelectedPosition = useAuthStore((state) => state.setSelectedPosition);
  const selectedDifficulty = useAuthStore((state) => state.selectedDifficulty);
  const setSelectedDifficulty = useAuthStore((state) => state.setSelectedDifficulty);
  const sessionId = useAuthStore((state) => state.sessionId);
  const setSessionId = useAuthStore((state) => state.setSessionId);
  const questionCountTarget = useAuthStore((state) => state.questionCountTarget);
  const setQuestionCountTarget = useAuthStore((state) => state.setQuestionCountTarget);
  const followUpLimit = useAuthStore((state) => state.followUpLimit);
  const setFollowUpLimit = useAuthStore((state) => state.setFollowUpLimit);
  const language = useAuthStore((state) => state.language);
  const setLanguage = useAuthStore((state) => state.setLanguage);
  const openaiModel = useAuthStore((state) => state.openaiModel);
  const setOpenaiModel = useAuthStore((state) => state.setOpenaiModel);
  const questionCreativity = useAuthStore((state) => state.questionCreativity);
  const setQuestionCreativity = useAuthStore((state) => state.setQuestionCreativity);
  const encryptedApiKey = useAuthStore((state) => state.openaiApiKey);
  const setOpenaiApiKey = useAuthStore((state) => state.setOpenaiApiKey);
  const [displayApiKey, setDisplayApiKey] = useState("");
  const [apiKeyRestored, setApiKeyRestored] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Restore persisted key once after storage hydration (never on every encrypt update).
  useEffect(() => {
    const restorePersistedApiKey = async () => {
      const encrypted = useAuthStore.getState().openaiApiKey;
      if (!encrypted) return;
      const plain = await decryptApiKey(encrypted);
      if (plain) {
        setDisplayApiKey(plain);
        setApiKeyRestored(true);
      }
    };

    if (useAuthStore.persist.hasHydrated()) {
      void restorePersistedApiKey();
      return;
    }

    return useAuthStore.persist.onFinishHydration(() => {
      void restorePersistedApiKey();
    });
  }, []);

  // Reflect external clears (e.g. logout) without decrypting stale encrypted values.
  useEffect(() => {
    if (!encryptedApiKey) {
      setDisplayApiKey("");
      setApiKeyRestored(false);
    }
  }, [encryptedApiKey]);

  const isResumeDrillTab = location.pathname === "/resume-drill";
  const [interviewStarted, setInterviewStarted] = useState<boolean>(false);
  const [isRecoveredSession, setIsRecoveredSession] = useState(false);
  const [selectedQuestionType, setSelectedQuestionType] = useState<QuestionType>(
    QuestionType.TECHNICAL,
  );

  const [currentQuestionNumber, setCurrentQuestionNumber] = useState(0);

  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Message | null>(null);
  const [awaitingAnswer, setAwaitingAnswer] = useState(false);
  const [jobDescription, setJobDescription] = useState("");

  const handleQuestionNumberIncrement = useCallback(
    () => setCurrentQuestionNumber((n) => n + 1),
    [],
  );

  const [pendingNewsQuestion, setPendingNewsQuestion] = useState<NewsQuestion | null>(null);

  useEffect(() => {
    if (location.pathname === "/") {
      navigate("/chat", { replace: true });
      return;
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (dailyQuestionDate !== today) {
      setDailyQuestionCount(0);
      setDailyQuestionDate(today);
    }
    if (sessionId && !interviewStarted) {
      // Try to recover the session instead of completing it
      (async () => {
        try {
          const detail = await getSessionDetail(sessionId);
          if (detail.status === "active") {
            // Session is still active — recover completed questions
            const recovered = await recoverQuestions(sessionId, true);
            const questionsWithContent = recovered.filter((q) => q.content);
            const restoredMessages: Message[] = questionsWithContent.map((q) => ({
              id: q.question_id,
              sender: "ai" as const,
              content: q.content,
              timestamp: new Date(q.created_at),
            }));
            setMessages(restoredMessages);
            setCurrentQuestionNumber(questionsWithContent.length);
            setIsRecoveredSession(true);
            setInterviewStarted(true);
          } else {
            // Session already completed — clear stale sessionId
            setSessionId(null);
          }
        } catch {
          // Session not found or error — clear stale sessionId
          setSessionId(null);
        }
      })();
    }
    // eslint-disable-next-line
  }, [username, user_id]);

  const handlePositionChange = (position: string) => {
    setSelectedPosition(position);
    setInterviewStarted(false);
  };

  const handleStartInterview = async () => {
    try {
      const res = await startInterviewSession({
        user_id: user_id || 0,
        position: selectedPosition,
      });
      setSessionId(res.session_id);
      setIsRecoveredSession(false);
      setInterviewStarted(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleInterviewComplete = async (sid?: string) => {
    const realSessionId = sid || sessionId;
    if (!realSessionId) return;
    const hasAnswered = messages.some(
      (message) => message.sender === "user" && message.content.trim().length > 0,
    );
    try {
      await completeSession(realSessionId, { user_id: user_id || 0 });
    } catch (err) {
      console.error("Failed to complete session:", err);
    }
    if (hasAnswered) {
      useAuthStore.getState().incrementDailySessionCount();
    }
    setInterviewStarted(false);

    setMessages([]);
    setCurrentQuestion(null);
    setAwaitingAnswer(false);
    setCurrentQuestionNumber(0);
    setJobDescription("");
    setSessionId(null);
  };

  const handleStartInterviewWithNews = async (newsQuestion?: NewsQuestion) => {
    try {
      const res = await startInterviewSession({
        user_id: user_id || 0,
        position: selectedPosition,
      });
      setSessionId(res.session_id);
      setInterviewStarted(true);

      if (newsQuestion) {
        setPendingNewsQuestion(newsQuestion);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Function to clear news question after it's used
  const handleNewsQuestionUsed = () => {
    setPendingNewsQuestion(null);
  };

  const [apiKeyStatus, setApiKeyStatus] = useState<"valid" | "invalid" | "checking" | "idle">(
    "idle",
  );

  const parseModels = useCallback((data: { data: { id: string }[] }) => {
    // Only keep modern GPT families (Responses API compatible)
    // Exclude fine-tune snapshots (contain ":"), old gpt-3.5/gpt-4-* legacy, and non-chat models
    const ALLOWED_PREFIXES = ["gpt-5", "gpt-4.1", "gpt-4o", "gpt-4.5", "gpt-4-turbo"];
    const EXCLUDED_KEYWORDS = ["tts", "transcribe", "audio", "realtime", "search"];
    const models = data.data
      .map((m) => m.id)
      .filter(
        (id) =>
          ALLOWED_PREFIXES.some((prefix) => id.startsWith(prefix)) &&
          !id.includes(":") &&
          !EXCLUDED_KEYWORDS.some((kw) => id.includes(kw)),
      )
      .sort((a, b) => b.localeCompare(a)); // reverse alpha: newest (4.5, 4.1) first
    setAvailableModels(models);
    const firstModel = models[0];
    if (firstModel && !models.includes(openaiModel)) {
      setOpenaiModel(firstModel);
    }
  }, [openaiModel, setOpenaiModel]);

  const fetchModels = useCallback(
    async (key: string) => {
      try {
        const response = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (response.ok) {
          parseModels(await response.json());
        } else {
          setAvailableModels([]);
          setApiKeyStatus("invalid");
        }
      } catch {
        setAvailableModels([]);
        setApiKeyStatus("invalid");
      }
    },
    [parseModels],
  );

  const validateOpenaiApiKey = useDebounceWithImmediate(
    async (key: string) => {
      if (!key.trim()) {
        setApiKeyStatus("idle");
        setAvailableModels([]);
        setOpenaiModel("");
        return;
      }

      try {
        const response = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (response.ok) {
          setApiKeyStatus("valid");
          parseModels(await response.json());
        } else {
          setApiKeyStatus("invalid");
          setAvailableModels([]);
        }
      } catch {
        setApiKeyStatus("invalid");
        setAvailableModels([]);
      }
    },
    5000,
    (key: string) => {
      if (key.trim()) {
        setApiKeyStatus("checking");
      } else {
        setApiKeyStatus("idle");
      }
    },
  );

  useEffect(() => {
    // Skip validation when restoring from storage on mount
    if (apiKeyRestored) {
      setApiKeyStatus(displayApiKey.trim() ? "valid" : "idle");
      if (displayApiKey.trim()) {
        fetchModels(displayApiKey);
      }
      setApiKeyRestored(false);
      return;
    }
    if (displayApiKey.trim()) {
      setApiKeyStatus("checking");
      validateOpenaiApiKey(displayApiKey);
    } else {
      setApiKeyStatus("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayApiKey]);

  const handleApiKeyChange = (value: string) => {
    setDisplayApiKey(value);
    setOpenaiApiKey(value);
    setApiKeyStatus(value.trim() ? "checking" : "idle");
    if (!value.trim()) {
      setAvailableModels([]);
      setOpenaiModel("");
    }
    validateOpenaiApiKey(value);
  };

  const setupPanel = (
    <PracticeSetupPanel
      selectedPosition={selectedPosition}
      onPositionChange={handlePositionChange}
      selectedDifficulty={selectedDifficulty}
      onDifficultyChange={setSelectedDifficulty}
      selectedQuestionType={selectedQuestionType}
      onQuestionTypeChange={setSelectedQuestionType}
      questionCountTarget={questionCountTarget}
      onQuestionCountTargetChange={setQuestionCountTarget}
      followUpLimit={followUpLimit}
      onFollowUpLimitChange={setFollowUpLimit}
      language={language}
      onLanguageChange={setLanguage}
      questionCreativity={questionCreativity}
      onQuestionCreativityChange={setQuestionCreativity}
      openaiModel={openaiModel}
      onOpenaiModelChange={setOpenaiModel}
      availableModels={availableModels}
      displayApiKey={displayApiKey}
      onApiKeyChange={handleApiKeyChange}
      apiKeyStatus={apiKeyStatus}
      jobDescription={jobDescription}
      onJobDescriptionChange={setJobDescription}
      mode={isResumeDrillTab ? "resume" : "chat"}
    />
  );

  const chatContent = (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <Box
        sx={{
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 30,
          bgcolor: "background.body",
        }}
      >
        {setupPanel}
        <Box sx={{ mb: 1.5 }}>
          <NewsQuestionPush
            userId={user_id || 0}
            selectedPosition={selectedPosition}
            onStartAnswering={(_, newsQuestion) => {
              navigate("/chat");
              if (!interviewStarted) {
                handleStartInterviewWithNews(newsQuestion);
              } else {
                setPendingNewsQuestion(newsQuestion);
              }
            }}
            isInterviewActive={interviewStarted}
            openaiApiKey={displayApiKey}
            openaiModel={openaiModel}
          />
        </Box>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <InterviewChat
        selectedPosition={selectedPosition}
        selectedDifficulty={selectedDifficulty}
        user_id={user_id || 0}
        interviewStarted={interviewStarted}
        isRecoveredSession={isRecoveredSession}
        sessionId={sessionId}
        onInterviewComplete={handleInterviewComplete}
        onInterviewStart={handleStartInterview}
        messages={messages}
        setMessages={setMessages}
        currentQuestion={currentQuestion}
        setCurrentQuestion={setCurrentQuestion}
        awaitingAnswer={awaitingAnswer}
        setAwaitingAnswer={setAwaitingAnswer}
        presetQuestion={pendingNewsQuestion}
        onPresetQuestionUsed={handleNewsQuestionUsed}
        questionType={selectedQuestionType}
        openaiApiKey={displayApiKey}
        questionCountTarget={questionCountTarget}
        currentQuestionNumber={currentQuestionNumber}
        onQuestionNumberIncrement={handleQuestionNumberIncrement}
        followUpLimit={followUpLimit}
        language={language}
        openaiModel={openaiModel}
        questionCreativity={questionCreativity}
        jobDescription={jobDescription}
        setJobDescription={setJobDescription}
      />
      </Box>
    </Box>
  );

  return (
    <AppShell
      username={username}
      dailyQuestionCount={dailyQuestionCount}
      onLogout={onLogout}
    >
      {location.pathname === "/resume-drill" ? (
        <WorkspaceMain variant="fluid">
          {setupPanel}
          <ResumeDrill
            isActive={isResumeDrillTab}
            userId={user_id || 0}
            selectedPosition={selectedPosition}
            selectedDifficulty={selectedDifficulty}
            openaiApiKey={displayApiKey}
            openaiModel={openaiModel}
            language={language}
            questionCreativity={questionCreativity}
          />
        </WorkspaceMain>
      ) : location.pathname === "/history" ? (
        <WorkspaceMain variant="wide">
          <InterviewHistory selectedPosition={selectedPosition} />
        </WorkspaceMain>
      ) : location.pathname === "/progress" ? (
        <WorkspaceMain variant="wide">
          <ProgressChart userId={user_id || 0} selectedPosition={selectedPosition} />
        </WorkspaceMain>
      ) : (
        <WorkspaceMain variant="chat">{chatContent}</WorkspaceMain>
      )}
    </AppShell>
  );
}
