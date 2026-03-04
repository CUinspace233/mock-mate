import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
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
} from "@mui/joy";
import {
  Chat as ChatIcon,
  TrendingUp as TrendingUpIcon,
  History as HistoryIcon,
  Work as WorkIcon,
  Check as CheckIcon,
  Cancel as CancelIcon,
} from "@mui/icons-material";
import InterviewChat from "./InterviewChat.tsx";
import InterviewHistory from "./InterviewHistory.tsx";
import ProgressChart from "./ProgressChart.tsx";
import { startInterviewSession, completeSession } from "../api/api";
import type { Message, PositionKey } from "../types/interview.ts";
import { Difficulty, QuestionType } from "../types/interview";
import { getDifficultyColor } from "../utils";
import NewsQuestionPush from "./NewsQuestionPush.tsx";
import type { NewsQuestion } from "../types/interview.ts";
import { useAuthStore } from "../stores/useAuthStore.ts";
import { useDebounceWithImmediate } from "../hooks/useDebounce.ts";

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
  const openaiApiKey = useAuthStore((state) => state.openaiApiKey);
  const setOpenaiApiKey = useAuthStore((state) => state.setOpenaiApiKey);

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
        position: selectedPosition as PositionKey,
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
        position: selectedPosition as PositionKey,
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
        setApiKeyStatus(response.ok ? "valid" : "invalid");
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
    if (openaiApiKey.trim()) {
      setApiKeyStatus("checking");
      validateOpenaiApiKey(openaiApiKey);
    } else {
      setApiKeyStatus("idle");
    }
  }, [openaiApiKey, validateOpenaiApiKey]);

  return (
    <Sheet
      sx={{
        minHeight: "100vh",
        backgroundColor: "background.surface",
        padding: { xs: 1, sm: 2 },
      }}
    >
      {/* Header */}
      <Card variant="soft" sx={{ mb: { xs: 2, sm: 3 } }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            spacing={{ xs: 2, md: 0 }}
          >
            <Box>
              <Typography
                level="h3"
                startDecorator={<WorkIcon />}
                sx={{
                  fontSize: { xs: "1.2rem", sm: "1.5rem" },
                  lineHeight: 1.2,
                }}
              >
                MockMate — Your AI Interview Coach
              </Typography>
              <Typography level="body-sm" color="neutral" sx={{ mt: 0.5 }}>
                Welcome, {username}! Start your interview training journey
              </Typography>
            </Box>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={{ xs: 1, sm: 2 }}
              alignItems={{ xs: "stretch", sm: "center" }}
              sx={{ width: { xs: "100%", md: "auto" } }}
            >
              <Chip color="primary" variant="soft" sx={{ textAlign: "center" }}>
                Today's Practice: {dailyQuestionCount} questions
              </Chip>
              <Stack direction="row" spacing={1.5} sx={{ width: { xs: "100%", sm: "auto" } }}>
                <Button
                  variant="outlined"
                  size="sm"
                  onClick={resetDailyProgress}
                  sx={{ flex: { xs: 1, sm: "none" } }}
                >
                  Reset Progress
                </Button>
                <Button
                  variant="soft"
                  color="danger"
                  onClick={onLogout}
                  sx={{ flex: { xs: 1, sm: "none" } }}
                >
                  Logout
                </Button>
              </Stack>
            </Stack>
          </Stack>
          {/* Daily Trending Question */}
          <Stack direction={{ xs: "column", lg: "row" }} spacing={{ xs: 2, lg: 3 }} sx={{ mt: 2 }}>
            {/* Left side spacer or content area for large screens */}
            <Box sx={{ display: { xs: "none", lg: "block" }, flex: 1 }} />
            <Stack direction="column" spacing={1} sx={{ mt: 2, width: { xs: "100%", sm: "auto" } }}>
              <Typography level="body-md">
                Set your OpenAI API key to start your interview training
              </Typography>
              <Stack spacing={1}>
                <Input
                  placeholder="OpenAI API key"
                  value={openaiApiKey}
                  onChange={(e) => {
                    const value = e.target.value;
                    setOpenaiApiKey(value);
                    if (value.trim()) {
                      setApiKeyStatus("checking");
                    } else {
                      setApiKeyStatus("idle");
                    }
                    validateOpenaiApiKey(value);
                  }}
                  type="password"
                  sx={{ maxWidth: 400 }}
                  endDecorator={
                    apiKeyStatus === "valid" ? (
                      <CheckIcon color="success" />
                    ) : apiKeyStatus === "invalid" ? (
                      <CancelIcon color="error" />
                    ) : apiKeyStatus === "checking" ? (
                      <CircularProgress size="sm" />
                    ) : null
                  }
                />
                {apiKeyStatus === "invalid" && (
                  <Typography level="body-sm" color="danger">
                    Invalid API key format
                  </Typography>
                )}
                {apiKeyStatus === "checking" && (
                  <Typography level="body-sm" color="neutral">
                    Validating API key...
                  </Typography>
                )}
              </Stack>
            </Stack>
            <NewsQuestionPush
              userId={user_id || 0}
              selectedPosition={selectedPosition}
              onStartAnswering={(_, newsQuestion) => {
                // Switch to chat tab and start interview with specific question
                setActiveTab(0);
                if (!interviewStarted) {
                  handleStartInterviewWithNews(newsQuestion);
                } else {
                  // If interview is already started, just set the news question
                  setPendingNewsQuestion(newsQuestion);
                }
              }}
              isInterviewActive={interviewStarted}
              openaiApiKey={openaiApiKey}
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Position Selection */}
      <Card variant="outlined" sx={{ mb: { xs: 2, sm: 3 } }}>
        <CardContent>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography level="title-md" noWrap>Position:</Typography>
              <Select
                value={selectedPosition}
                onChange={(_, value) => value && handlePositionChange(value)}
                sx={{ minWidth: 160 }}
              >
                {jobPositions.map((position) => (
                  <Option key={position.value} value={position.value}>
                    {position.label}
                  </Option>
                ))}
              </Select>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <Typography level="title-md" noWrap>Type:</Typography>
              <Select
                value={selectedQuestionType}
                onChange={(_, value) => value && setSelectedQuestionType(value as QuestionType)}
                sx={{ minWidth: 140 }}
              >
                <Option value={QuestionType.TECHNICAL}>Technical</Option>
                <Option value={QuestionType.BEHAVIORAL}>Behavioral</Option>
                <Option value={QuestionType.OPINION}>Opinion</Option>
              </Select>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <Typography level="title-md" noWrap>Difficulty:</Typography>
              <Select
                value={selectedDifficulty}
                onChange={(_, value) => value && setSelectedDifficulty(value as Difficulty)}
                color={getDifficultyColor(selectedDifficulty) as ColorPaletteProp}
                sx={{ minWidth: 110 }}
              >
                <Option value={Difficulty.EASY}>
                  <Chip color="success" variant="soft" size="sm">Easy</Chip>
                </Option>
                <Option value={Difficulty.MEDIUM}>
                  <Chip color="warning" variant="soft" size="sm">Medium</Chip>
                </Option>
                <Option value={Difficulty.HARD}>
                  <Chip color="danger" variant="soft" size="sm">Hard</Chip>
                </Option>
              </Select>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <Typography level="title-md" noWrap>Questions:</Typography>
              <Select
                value={questionCountTarget}
                onChange={(_, value) => value && setQuestionCountTarget(value as number)}
                sx={{ minWidth: 70 }}
              >
                <Option value={3}>3</Option>
                <Option value={5}>5</Option>
                <Option value={8}>8</Option>
                <Option value={10}>10</Option>
              </Select>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <Typography level="title-md" noWrap>Follow-ups:</Typography>
              <Select
                value={followUpLimit}
                onChange={(_, value) => value !== null && setFollowUpLimit(value as number)}
                sx={{ minWidth: 80 }}
              >
                <Option value={0}>Off</Option>
                <Option value={1}>1</Option>
                <Option value={2}>2</Option>
                <Option value={3}>3</Option>
                <Option value={4}>4</Option>
                <Option value={5}>5</Option>
              </Select>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <Typography level="title-md" noWrap>Language:</Typography>
              <Select
                value={language}
                onChange={(_, value) => value && setLanguage(value as string)}
                sx={{ minWidth: 120 }}
              >
                <Option value="en">English</Option>
                <Option value="zh">中文</Option>
                <Option value="ja">日本語</Option>
                <Option value="ko">한국어</Option>
              </Select>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Card variant="outlined">
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value as number)}
          sx={{
            "& .MuiTabList-root": {
              overflowX: "auto",
            },
          }}
        >
          <TabList>
            <Tab sx={{ minWidth: { xs: "auto", sm: "120px" } }}>
              <ChatIcon sx={{ mr: { xs: 0.5, sm: 1 } }} />
              <Box sx={{ display: { xs: "none", sm: "block" } }}>Interview Chat</Box>
              <Box sx={{ display: { xs: "block", sm: "none" } }}>Chat</Box>
            </Tab>
            <Tab sx={{ minWidth: { xs: "auto", sm: "120px" } }}>
              <HistoryIcon sx={{ mr: { xs: 0.5, sm: 1 } }} />
              <Box sx={{ display: { xs: "none", sm: "block" } }}>History</Box>
              <Box sx={{ display: { xs: "block", sm: "none" } }}>History</Box>
            </Tab>
            <Tab sx={{ minWidth: { xs: "auto", sm: "120px" } }}>
              <TrendingUpIcon sx={{ mr: { xs: 0.5, sm: 1 } }} />
              <Box sx={{ display: { xs: "none", sm: "block" } }}>Progress Trend</Box>
              <Box sx={{ display: { xs: "block", sm: "none" } }}>Progress</Box>
            </Tab>
          </TabList>

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
              openaiApiKey={openaiApiKey}
              questionCountTarget={questionCountTarget}
              currentQuestionNumber={currentQuestionNumber}
              onQuestionNumberIncrement={handleQuestionNumberIncrement}
              followUpLimit={followUpLimit}
              language={language}
            />
          </TabPanel>

          <TabPanel value={1} sx={{ p: 0 }}>
            <InterviewHistory selectedPosition={selectedPosition} />
          </TabPanel>

          <TabPanel value={2} sx={{ p: 0 }}>
            <ProgressChart userId={user_id || 0} selectedPosition={selectedPosition} />
          </TabPanel>
        </Tabs>
      </Card>
    </Sheet>
  );
}
