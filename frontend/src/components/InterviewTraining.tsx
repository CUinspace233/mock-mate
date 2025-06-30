import { useState, useEffect } from "react";
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
} from "@mui/joy";
import {
  Chat as ChatIcon,
  TrendingUp as TrendingUpIcon,
  History as HistoryIcon,
  Work as WorkIcon,
} from "@mui/icons-material";
import InterviewChat from "./InterviewChat.tsx";
import InterviewHistory from "./InterviewHistory.tsx";
import ProgressChart from "./ProgressChart.tsx";
import { startInterviewSession, completeSession } from "../api/api";
import type { Message, PositionKey } from "../types/interview.ts";
import { Difficulty } from "../types/interview";
import { getDifficultyColor } from "../utils";

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
  const [selectedPosition, setSelectedPosition] = useState<string>("frontend");
  const [activeTab, setActiveTab] = useState<number>(0);
  const [interviewStarted, setInterviewStarted] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [dailyQuestionCount, setDailyQuestionCount] = useState<number>(0);
  const [user_id, setUserId] = useState<number>(0);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>(Difficulty.EASY);

  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Message | null>(null);
  const [awaitingAnswer, setAwaitingAnswer] = useState(false);

  useEffect(() => {
    const savedPosition = localStorage.getItem(`${username}_selectedPosition`);
    const savedQuestionCount = localStorage.getItem(`${username}_dailyQuestionCount`);
    const savedUserId = localStorage.getItem("user_id");
    if (savedUserId) {
      setUserId(Number(savedUserId));
    }
    if (savedPosition) {
      setSelectedPosition(savedPosition);
    }
    if (savedQuestionCount) {
      setDailyQuestionCount(parseInt(savedQuestionCount));
    }
    const savedSessionId = localStorage.getItem(`${username}_sessionId`);
    if (savedSessionId && !interviewStarted) {
      (async () => {
        await handleInterviewComplete(savedSessionId);
      })();
    }
  }, [username, user_id]);

  const handlePositionChange = (position: string) => {
    setSelectedPosition(position);
    localStorage.setItem(`${username}_selectedPosition`, position);
    setInterviewStarted(false);
  };

  const handleStartInterview = async () => {
    try {
      const res = await startInterviewSession({
        user_id,
        position: selectedPosition as PositionKey,
      });
      setSessionId(res.session_id);
      setInterviewStarted(true);
      localStorage.setItem(`${username}_sessionId`, res.session_id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleInterviewComplete = async (sid?: string) => {
    const realSessionId = sid || sessionId;
    if (!realSessionId) return;
    try {
      await completeSession(realSessionId, { user_id });
    } catch (err) {
      console.error("Failed to complete session:", err);
    }
    const newCount = dailyQuestionCount + 1;
    setDailyQuestionCount(newCount);
    localStorage.setItem(`${username}_dailyQuestionCount`, newCount.toString());
    setInterviewStarted(false);

    setMessages([]);
    setCurrentQuestion(null);
    setAwaitingAnswer(false);
    localStorage.removeItem(`${username}_sessionId`);
  };

  const resetDailyProgress = () => {
    setDailyQuestionCount(0);
    localStorage.setItem(`${username}_dailyQuestionCount`, "0");
  };

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
                Mock Mate — Your AI Interview Coach
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
              <Stack direction="row" spacing={1} sx={{ width: { xs: "100%", sm: "auto" } }}>
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
        </CardContent>
      </Card>

      {/* Position Selection */}
      <Card variant="outlined" sx={{ mb: { xs: 2, sm: 3 } }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", lg: "center" }}
          >
            <Typography level="title-md" sx={{ flexShrink: 0 }}>
              Select Target Position:
            </Typography>
            <Select
              value={selectedPosition}
              onChange={(_, value) => value && handlePositionChange(value)}
              sx={{ minWidth: { xs: "100%", sm: 200 } }}
            >
              {jobPositions.map((position) => (
                <Option key={position.value} value={position.value}>
                  {position.label}
                </Option>
              ))}
            </Select>
            <Typography level="title-md" sx={{ flexShrink: 0 }}>
              Select Difficulty:
            </Typography>
            <Select
              value={selectedDifficulty}
              onChange={(_, value) => value && setSelectedDifficulty(value as Difficulty)}
              color={getDifficultyColor(selectedDifficulty) as ColorPaletteProp}
              sx={{ minWidth: { xs: "100%", sm: 150 } }}
            >
              <Option value={Difficulty.EASY}>
                <Chip color="success" variant="soft" size="sm">
                  Easy
                </Chip>
              </Option>
              <Option value={Difficulty.MEDIUM}>
                <Chip color="warning" variant="soft" size="sm">
                  Medium
                </Chip>
              </Option>
              <Option value={Difficulty.HARD}>
                <Chip color="danger" variant="soft" size="sm">
                  Hard
                </Chip>
              </Option>
            </Select>
          </Stack>
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
              user_id={user_id}
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
            />
          </TabPanel>

          <TabPanel value={1} sx={{ p: 0 }}>
            <InterviewHistory selectedPosition={selectedPosition} />
          </TabPanel>

          <TabPanel value={2} sx={{ p: 0 }}>
            <ProgressChart username={username} selectedPosition={selectedPosition} />
          </TabPanel>
        </Tabs>
      </Card>
    </Sheet>
  );
}
