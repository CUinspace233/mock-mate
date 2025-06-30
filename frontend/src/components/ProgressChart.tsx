import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Select,
  Option,
  Stack,
  Chip,
  LinearProgress,
  Alert,
} from "@mui/joy";
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as RemoveIcon,
} from "@mui/icons-material";
import { PositionLabels, type PositionKey } from "../types/interview";

interface InterviewRecord {
  id: string;
  position: string;
  question: string;
  answer: string;
  score: number;
  feedback: string;
  timestamp: string;
}

interface ProgressChartProps {
  username: string;
  selectedPosition: string;
}

interface ProgressData {
  date: string;
  score: number;
  count: number;
}

export default function ProgressChart({ username, selectedPosition }: ProgressChartProps) {
  const [records, setRecords] = useState<InterviewRecord[]>([]);
  const [timeRange, setTimeRange] = useState<string>("7days");
  const [progressData, setProgressData] = useState<ProgressData[]>([]);

  useEffect(() => {
    loadRecords();
  }, [username]);

  useEffect(() => {
    generateProgressData();
  }, [records, timeRange, selectedPosition]);

  const loadRecords = () => {
    const savedRecords = JSON.parse(localStorage.getItem(`${username}_interviewRecords`) || "[]");
    setRecords(savedRecords);
  };

  const generateProgressData = () => {
    const filteredRecords = records.filter((record) => record.position === selectedPosition);

    const days = timeRange === "7days" ? 7 : timeRange === "30days" ? 30 : 90;
    const data: ProgressData[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toLocaleDateString();

      const dayRecords = filteredRecords.filter((record) => {
        const recordDate = new Date(record.timestamp).toLocaleDateString();
        return recordDate === dateString;
      });

      const averageScore =
        dayRecords.length > 0
          ? dayRecords.reduce((sum, record) => sum + record.score, 0) / dayRecords.length
          : 0;

      data.push({
        date: dateString,
        score: Math.round(averageScore),
        count: dayRecords.length,
      });
    }

    setProgressData(data);
  };

  const calculateOverallStats = () => {
    const filteredRecords = records.filter((record) => record.position === selectedPosition);

    if (filteredRecords.length === 0) {
      return {
        totalQuestions: 0,
        averageScore: 0,
        improvement: 0,
        bestScore: 0,
        worstScore: 0,
        streak: 0,
      };
    }

    const totalQuestions = filteredRecords.length;
    const averageScore = Math.round(
      filteredRecords.reduce((sum, record) => sum + record.score, 0) / totalQuestions,
    );

    const scores = filteredRecords.map((record) => record.score);
    const bestScore = Math.max(...scores);
    const worstScore = Math.min(...scores);

    // Calculate improvement (comparing first half to second half)
    const halfPoint = Math.floor(totalQuestions / 2);
    const firstHalf = filteredRecords.slice(halfPoint);
    const secondHalf = filteredRecords.slice(0, halfPoint);

    const firstHalfAvg =
      firstHalf.length > 0
        ? firstHalf.reduce((sum, record) => sum + record.score, 0) / firstHalf.length
        : 0;
    const secondHalfAvg =
      secondHalf.length > 0
        ? secondHalf.reduce((sum, record) => sum + record.score, 0) / secondHalf.length
        : 0;

    const improvement = Math.round(secondHalfAvg - firstHalfAvg);

    // Calculate streak (consecutive days with practice)
    let streak = 0;
    const today = new Date().toLocaleDateString();
    const currentDate = new Date();

    while (true) {
      const dateString = currentDate.toLocaleDateString();
      const hasRecord = filteredRecords.some(
        (record) => new Date(record.timestamp).toLocaleDateString() === dateString,
      );

      if (hasRecord || dateString === today) {
        if (hasRecord) streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return {
      totalQuestions,
      averageScore,
      improvement,
      bestScore,
      worstScore,
      streak,
    };
  };

  const stats = calculateOverallStats();
  const maxScore = Math.max(...progressData.map((d) => d.score), 100);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography level="h4">
          {PositionLabels[selectedPosition as PositionKey]} - Progress Trend
        </Typography>
        <Select
          value={timeRange}
          onChange={(_, value) => setTimeRange(value || "7days")}
          sx={{ minWidth: 120 }}
        >
          <Option value="7days">Last 7 Days</Option>
          <Option value="30days">Last 30 Days</Option>
          <Option value="90days">Last 90 Days</Option>
        </Select>
      </Stack>

      {records.filter((r) => r.position === selectedPosition).length === 0 ? (
        <Alert color="neutral" variant="soft">
          No practice records for this position yet. Start practicing to track your progress!
        </Alert>
      ) : (
        <>
          {/* Statistics Cards */}
          <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
            <Card variant="soft" color="primary" sx={{ flex: 1 }}>
              <CardContent>
                <Typography level="body-sm" color="primary">
                  Total Questions
                </Typography>
                <Typography level="h3">{stats.totalQuestions}</Typography>
              </CardContent>
            </Card>

            <Card variant="soft" color="success" sx={{ flex: 1 }}>
              <CardContent>
                <Typography level="body-sm" color="success">
                  Average Score
                </Typography>
                <Typography level="h3">{stats.averageScore}</Typography>
              </CardContent>
            </Card>

            <Card
              variant="soft"
              color={stats.improvement >= 0 ? "success" : "danger"}
              sx={{ flex: 1 }}
            >
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography level="body-sm">Improvement</Typography>
                  {stats.improvement > 0 ? (
                    <TrendingUpIcon />
                  ) : stats.improvement < 0 ? (
                    <TrendingDownIcon />
                  ) : (
                    <RemoveIcon />
                  )}
                </Stack>
                <Typography level="h3">
                  {stats.improvement > 0 ? "+" : ""}
                  {stats.improvement}
                </Typography>
              </CardContent>
            </Card>

            <Card variant="soft" color="warning" sx={{ flex: 1 }}>
              <CardContent>
                <Typography level="body-sm" color="warning">
                  Streak
                </Typography>
                <Typography level="h3">{stats.streak} Days</Typography>
              </CardContent>
            </Card>
          </Stack>

          {/* Score Range */}
          <Card variant="outlined" sx={{ mb: 4 }}>
            <CardContent>
              <Typography level="title-md" sx={{ mb: 2 }}>
                Score Range
              </Typography>
              <Stack direction="row" spacing={3}>
                <Box>
                  <Typography level="body-sm" color="success">
                    Highest Score
                  </Typography>
                  <Chip color="success" size="lg">
                    {stats.bestScore}
                  </Chip>
                </Box>
                <Box>
                  <Typography level="body-sm" color="danger">
                    Lowest Score
                  </Typography>
                  <Chip color="danger" size="lg">
                    {stats.worstScore}
                  </Chip>
                </Box>
                <Box>
                  <Typography level="body-sm" color="primary">
                    Score Gap
                  </Typography>
                  <Chip color="primary" size="lg">
                    {stats.bestScore - stats.worstScore}
                  </Chip>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* Daily Progress Chart */}
          <Card variant="outlined">
            <CardContent>
              <Typography level="title-md" sx={{ mb: 3 }}>
                Daily Performance Trend
              </Typography>
              <Stack spacing={2}>
                {progressData.map((day) => (
                  <Box key={day.date}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ mb: 1 }}
                    >
                      <Typography level="body-sm">{day.date}</Typography>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Typography level="body-sm" color="neutral">
                          Practiced {day.count} questions
                        </Typography>
                        {day.score > 0 && (
                          <Chip
                            size="sm"
                            color={
                              day.score >= 80 ? "success" : day.score >= 70 ? "warning" : "danger"
                            }
                          >
                            {day.score} points
                          </Chip>
                        )}
                      </Stack>
                    </Stack>

                    <LinearProgress
                      determinate
                      value={day.score > 0 ? (day.score / maxScore) * 100 : 0}
                      color={
                        day.score >= 80
                          ? "success"
                          : day.score >= 70
                          ? "warning"
                          : day.score > 0
                          ? "danger"
                          : "neutral"
                      }
                      sx={{ height: 8, mb: 1 }}
                    />

                    {day.count === 0 && (
                      <Typography level="body-xs" color="neutral" sx={{ fontStyle: "italic" }}>
                        No practice
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}
