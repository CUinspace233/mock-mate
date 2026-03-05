import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Card,
  Typography,
  Button,
  Select,
  Option,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Sheet,
  Chip,
  Stack,
  type ColorPaletteProp,
  Input,
  CircularProgress,
  Divider,
  IconButton,
} from "@mui/joy";
import {
  Chat as ChatIcon,
  TrendingUp as TrendingUpIcon,
  History as HistoryIcon,
  Check as CheckIcon,
  Cancel as CancelIcon,
  ArrowBack as ArrowBackIcon,
} from "@mui/icons-material";
import InterviewChat from "./InterviewChat.tsx";
import InterviewHistory from "./InterviewHistory.tsx";
import ProgressChart from "./ProgressChart.tsx";
import { startInterviewSession, completeSession } from "../api/api";
import type { Message } from "../types/interview.ts";
import { Difficulty, QuestionType } from "../types/interview";
import { getDifficultyColor } from "../utils";
import NewsQuestionPush from "./NewsQuestionPush.tsx";
import type { NewsQuestion } from "../types/interview.ts";
import { useAuthStore } from "../stores/useAuthStore.ts";
import { useDebounceWithImmediate } from "../hooks/useDebounce.ts";
import { decryptApiKey } from "../crypto.ts";

interface InterviewTrainingProps {
  username: string;
  onLogout: () => void;
}

// Job positions data
const jobPositions = [
  { value: "frontend", label: "Frontend Engineer" },
  { value: "backend", label: "Backend Engineer" },
  { value: "fullstack", label: "Fullstack Engineer" },
  { value: "mobile", label: "Mobile Developer" },
  { value: "devops", label: "DevOps Engineer" },
  { value: "ai", label: "AI Engineer" },
  { value: "qa", label: "QA Engineer" },
  { value: "product", label: "Product Manager" },
  { value: "ui", label: "UI/UX Designer" },
  { value: "data", label: "Data Analyst" },
  { value: "__custom__", label: "Custom..." },
];

export default function InterviewTraining({ username, onLogout }: InterviewTrainingProps) {
  // zustand hooks
  const user_id = useAuthStore((state) => state.user_id);
  const dailyQuestionCount = useAuthStore((state) => state.dailyQuestionCount);
  const setDailyQuestionCount = useAuthStore((state) => state.setDailyQuestionCount);
  const dailyQuestionDate = useAuthStore((state) => state.dailyQuestionDate);
  const setDailyQuestionDate = useAuthStore((state) => state.setDailyQuestionDate);
  const selectedPosition = useAuthStore((state) => state.selectedPosition);
  const setSelectedPosition = useAuthStore((state) => state.setSelectedPosition);
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
  const encryptedApiKey = useAuthStore((state) => state.openaiApiKey);
  const setOpenaiApiKey = useAuthStore((state) => state.setOpenaiApiKey);
  const [displayApiKey, setDisplayApiKey] = useState("");
  const [apiKeyRestored, setApiKeyRestored] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Decrypt stored key on mount / when encrypted value changes
  useEffect(() => {
    if (encryptedApiKey) {
      decryptApiKey(encryptedApiKey).then((plain) => {
        if (plain) {
          setDisplayApiKey(plain);
          setApiKeyRestored(true);
        }
      });
    } else {
      setDisplayApiKey("");
    }
  }, [encryptedApiKey]);

  const [customPositionMode, setCustomPositionMode] = useState(false);
  const [customPositionInput, setCustomPositionInput] = useState("");
  const [activeTab, setActiveTab] = useState<number>(0);
  const [interviewStarted, setInterviewStarted] = useState<boolean>(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>(Difficulty.EASY);
  const [selectedQuestionType, setSelectedQuestionType] = useState<QuestionType>(
    QuestionType.TECHNICAL,
  );

  const [currentQuestionNumber, setCurrentQuestionNumber] = useState(0);

  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Message | null>(null);
  const [awaitingAnswer, setAwaitingAnswer] = useState(false);

  const handleQuestionNumberIncrement = useCallback(
    () => setCurrentQuestionNumber((n) => n + 1),
    [],
  );

  const [pendingNewsQuestion, setPendingNewsQuestion] = useState<NewsQuestion | null>(null);
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (dailyQuestionDate !== today) {
      setDailyQuestionCount(0);
      setDailyQuestionDate(today);
    }
    if (sessionId && !interviewStarted) {
      (async () => {
        await handleInterviewComplete(sessionId);
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
      setInterviewStarted(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleInterviewComplete = async (sid?: string) => {
    const realSessionId = sid || sessionId;
    if (!realSessionId) return;
    try {
      await completeSession(realSessionId, { user_id: user_id || 0 });
    } catch (err) {
      console.error("Failed to complete session:", err);
    }
    const newCount = dailyQuestionCount + 1;
    setDailyQuestionCount(newCount);
    setDailyQuestionDate(new Date().toISOString().slice(0, 10));
    setInterviewStarted(false);

    setMessages([]);
    setCurrentQuestion(null);
    setAwaitingAnswer(false);
    setCurrentQuestionNumber(0);
    setSessionId(null);
  };

  const resetDailyProgress = () => {
    setDailyQuestionCount(0);
    setDailyQuestionDate(new Date().toISOString().slice(0, 10));
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
      .filter((id) =>
        ALLOWED_PREFIXES.some((prefix) => id.startsWith(prefix))
        && !id.includes(":")
        && !EXCLUDED_KEYWORDS.some((kw) => id.includes(kw))
      )
      .sort((a, b) => b.localeCompare(a)); // reverse alpha: newest (4.5, 4.1) first
    setAvailableModels(models);
  }, []);

  const fetchModels = useCallback(async (key: string) => {
    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (response.ok) {
        parseModels(await response.json());
      }
    } catch {
      // silently fail — model list is best-effort
    }
  }, [parseModels]);

  const validateOpenaiApiKey = useDebounceWithImmediate(
    async (key: string) => {
      if (!key.trim()) {
        setApiKeyStatus("idle");
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
        }
      } catch {
        setApiKeyStatus("invalid");
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

  return (
    <Sheet
      sx={{
        minHeight: "100vh",
        bgcolor: "background.body",
        padding: { xs: 1, sm: 2 },
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: "auto" }}>
        {/* Header Row 1: Brand + Actions */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 1, pt: 0.5 }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography
              level="title-lg"
              sx={{
                fontWeight: 700,
                fontSize: { xs: "1.1rem", sm: "1.25rem" },
                background: "linear-gradient(135deg, #2563eb, #172554)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              MockMate
            </Typography>
            <Chip color="primary" variant="soft" size="sm">
              {dailyQuestionCount} today
            </Chip>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Button
              variant="outlined"
              size="sm"
              onClick={resetDailyProgress}
              sx={{ display: { xs: "none", sm: "inline-flex" } }}
            >
              Reset
            </Button>
            <Button
              variant="soft"
              color="danger"
              size="sm"
              onClick={onLogout}
            >
              Logout
            </Button>
          </Stack>
        </Stack>

        {/* Header Row 2: API Key + Trending */}
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ mb: 1 }}
        >
          <Input
            placeholder="OpenAI API Key"
            value={displayApiKey}
            onChange={(e) => {
              const value = e.target.value;
              setDisplayApiKey(value);
              setOpenaiApiKey(value);
              if (value.trim()) {
                setApiKeyStatus("checking");
              } else {
                setApiKeyStatus("idle");
              }
              validateOpenaiApiKey(value);
            }}
            type="password"
            size="sm"
            sx={{ flex: 1, maxWidth: { sm: 280 } }}
            endDecorator={
              apiKeyStatus === "valid" ? (
                <CheckIcon color="success" sx={{ fontSize: 16 }} />
              ) : apiKeyStatus === "invalid" ? (
                <CancelIcon color="error" sx={{ fontSize: 16 }} />
              ) : apiKeyStatus === "checking" ? (
                <CircularProgress size="sm" />
              ) : null
            }
          />
          <NewsQuestionPush
            userId={user_id || 0}
            selectedPosition={selectedPosition}
            onStartAnswering={(_, newsQuestion) => {
              setActiveTab(0);
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
        </Stack>

        {/* Settings Row */}
        <Box
          sx={{
            mb: 1.5,
            py: 0.75,
            px: 1.5,
            bgcolor: "neutral.50",
            borderRadius: "lg",
            display: "flex",
            flexWrap: "wrap",
            gap: 1,
            alignItems: "center",
          }}
        >
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
            <Typography level="body-xs" sx={{ fontWeight: 700, color: "neutral.500", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.65rem" }}>
              Position
            </Typography>
            {customPositionMode ? (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <IconButton size="sm" variant="plain" onClick={() => {
                  setCustomPositionMode(false);
                  if (!customPositionInput.trim()) {
                    handlePositionChange("frontend");
                  }
                }}>
                  <ArrowBackIcon sx={{ fontSize: 16 }} />
                </IconButton>
                <Input
                  size="sm"
                  variant="plain"
                  placeholder="e.g. Game Developer"
                  value={customPositionInput}
                  onChange={(e) => {
                    setCustomPositionInput(e.target.value);
                    if (e.target.value.trim()) {
                      handlePositionChange(e.target.value.trim());
                    }
                  }}
                  autoFocus
                  sx={{ minWidth: { xs: 130, md: 160 } }}
                />
              </Stack>
            ) : (
              <Select variant="plain" value={selectedPosition} onChange={(_, value) => {
                if (value === "__custom__") {
                  setCustomPositionMode(true);
                  setCustomPositionInput("");
                } else if (value) {
                  handlePositionChange(value);
                }
              }} size="sm" sx={{ minWidth: { xs: 110, md: 140 } }}>
                {jobPositions.filter(p => p.value !== "__custom__").map((position) => (
                  <Option key={position.value} value={position.value}>{position.label}</Option>
                ))}
                <Divider sx={{ my: 0.5 }} />
                <Option value="__custom__" sx={{ color: "primary.600", fontWeight: 600 }}>
                  + Custom Position
                </Option>
              </Select>
            )}
          </Stack>

          <Divider orientation="vertical" sx={{ display: { xs: "none", lg: "block" } }} />

          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
            <Typography level="body-xs" sx={{ fontWeight: 700, color: "neutral.500", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.65rem" }}>
              Type
            </Typography>
            <Select variant="plain" value={selectedQuestionType} onChange={(_, value) => value && setSelectedQuestionType(value as QuestionType)} size="sm" sx={{ minWidth: { xs: 95, md: 120 } }}>
              <Option value={QuestionType.TECHNICAL}>Technical</Option>
              <Option value={QuestionType.BEHAVIORAL}>Behavioral</Option>
              <Option value={QuestionType.OPINION}>Opinion</Option>
            </Select>
          </Stack>

          <Divider orientation="vertical" sx={{ display: { xs: "none", lg: "block" } }} />

          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
            <Typography level="body-xs" sx={{ fontWeight: 700, color: "neutral.500", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.65rem" }}>
              <Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>Difficulty</Box>
              <Box component="span" sx={{ display: { xs: "inline", md: "none" } }}>Diff</Box>
            </Typography>
            <Select variant="plain" value={selectedDifficulty} onChange={(_, value) => value && setSelectedDifficulty(value as Difficulty)} color={getDifficultyColor(selectedDifficulty) as ColorPaletteProp} size="sm" sx={{ minWidth: 75 }}>
              <Option value={Difficulty.EASY}><Chip color="success" variant="soft" size="sm">Easy</Chip></Option>
              <Option value={Difficulty.MEDIUM}><Chip color="warning" variant="soft" size="sm">Medium</Chip></Option>
              <Option value={Difficulty.HARD}><Chip color="danger" variant="soft" size="sm">Hard</Chip></Option>
            </Select>
          </Stack>

          <Divider orientation="vertical" sx={{ display: { xs: "none", lg: "block" } }} />

          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
            <Typography level="body-xs" sx={{ fontWeight: 700, color: "neutral.500", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.65rem" }}>
              <Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>Questions</Box>
              <Box component="span" sx={{ display: { xs: "inline", md: "none" } }}>Qty</Box>
            </Typography>
            <Select variant="plain" value={questionCountTarget} onChange={(_, value) => value && setQuestionCountTarget(value as number)} size="sm" sx={{ minWidth: 50 }}>
              <Option value={3}>3</Option>
              <Option value={5}>5</Option>
              <Option value={8}>8</Option>
              <Option value={10}>10</Option>
            </Select>
          </Stack>

          <Divider orientation="vertical" sx={{ display: { xs: "none", lg: "block" } }} />

          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
            <Typography level="body-xs" sx={{ fontWeight: 700, color: "neutral.500", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.65rem" }}>
Follow-ups
            </Typography>
            <Select variant="plain" value={followUpLimit} onChange={(_, value) => value !== null && setFollowUpLimit(value as number)} size="sm" sx={{ minWidth: 50 }}>
              <Option value={0}>Off</Option>
              <Option value={1}>1</Option>
              <Option value={2}>2</Option>
              <Option value={3}>3</Option>
              <Option value={4}>4</Option>
              <Option value={5}>5</Option>
            </Select>
          </Stack>

          <Divider orientation="vertical" sx={{ display: { xs: "none", lg: "block" } }} />

          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
            <Typography level="body-xs" sx={{ fontWeight: 700, color: "neutral.500", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.65rem" }}>
              <Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>Language</Box>
              <Box component="span" sx={{ display: { xs: "inline", md: "none" } }}>Lang</Box>
            </Typography>
            <Select variant="plain" value={language} onChange={(_, value) => value && setLanguage(value as string)} size="sm" sx={{ minWidth: 75 }}>
              <Option value="en">English</Option>
              <Option value="zh">中文</Option>
              <Option value="ja">日本語</Option>
              <Option value="ko">한국어</Option>
            </Select>
          </Stack>

          <Divider orientation="vertical" sx={{ display: { xs: "none", lg: "block" } }} />

          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
            <Typography level="body-xs" sx={{ fontWeight: 700, color: "neutral.500", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.65rem" }}>
              Model
            </Typography>
            <Select variant="plain" value={openaiModel} onChange={(_, value) => value && setOpenaiModel(value as string)} size="sm" sx={{ minWidth: { xs: 120, md: 160 } }}>
              {availableModels.length > 0 ? (
                availableModels.map((model) => (
                  <Option key={model} value={model}>{model}</Option>
                ))
              ) : (
                <Option value="gpt-4.1-nano">gpt-4.1-nano</Option>
              )}
            </Select>
          </Stack>
        </Box>

        {/* Main Content Tabs */}
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value as number)}
        >
          <TabList
            sx={{
              bgcolor: "neutral.100",
              borderRadius: "lg",
              p: 0.5,
              mb: 1,
              gap: 0.5,
              overflowX: "auto",
              flexWrap: "nowrap",
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": { display: "none" },
              "& .MuiTab-root": {
                borderRadius: "md",
                fontWeight: 600,
                flex: { xs: "1 0 auto", sm: "none" },
                whiteSpace: "nowrap",
                "&[aria-selected='true']": {
                  bgcolor: "background.surface",
                  boxShadow: "sm",
                },
              },
            }}
          >
            <Tab>
              <ChatIcon sx={{ mr: 0.5, fontSize: { xs: 18, sm: 20 } }} />
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>Interview </Box>
              Chat
            </Tab>
            <Tab>
              <HistoryIcon sx={{ mr: 0.5, fontSize: { xs: 18, sm: 20 } }} />
              History
            </Tab>
            <Tab>
              <TrendingUpIcon sx={{ mr: 0.5, fontSize: { xs: 18, sm: 20 } }} />
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>Progress </Box>
              <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>Stats</Box>
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>Trend</Box>
            </Tab>
          </TabList>

          <Card variant="outlined" sx={{ boxShadow: "sm" }}>
            <TabPanel value={0} sx={{ p: 0 }}>
              <InterviewChat
                selectedPosition={selectedPosition}
                selectedDifficulty={selectedDifficulty}
                user_id={user_id || 0}
                interviewStarted={interviewStarted}
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
              />
            </TabPanel>

            <TabPanel value={1} sx={{ p: 0 }}>
              <InterviewHistory selectedPosition={selectedPosition} />
            </TabPanel>

            <TabPanel value={2} sx={{ p: 0 }}>
              <ProgressChart userId={user_id || 0} selectedPosition={selectedPosition} />
            </TabPanel>
          </Card>
        </Tabs>
      </Box>
    </Sheet>
  );
}
