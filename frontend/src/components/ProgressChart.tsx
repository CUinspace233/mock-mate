import { useState, useEffect, useCallback } from "react";
import { Box, Typography, Card, CardContent, Select, Option, Stack, Chip, Alert } from "@mui/joy";
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as RemoveIcon,
} from "@mui/icons-material";
import { PositionLabels, type PositionKey } from "../types/interview";
import { getUserProgress } from "../api/api";
import type { ProgressData, ProgressStatistics, PositionBreakdown } from "../types/interview";
import { BarChart } from "@mui/x-charts/BarChart";

interface ProgressChartProps {
  userId: number;
  selectedPosition: string;
}

export default function ProgressChart({ userId, selectedPosition }: ProgressChartProps) {
  const [progressData, setProgressData] = useState<ProgressData[]>([]);
  const [statistics, setStatistics] = useState<ProgressStatistics | null>(null);
  const [positionBreakdown, setPositionBreakdown] = useState<PositionBreakdown[]>([]);
  const [timeRange, setTimeRange] = useState<"7days" | "30days" | "90days">("7days");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadProgressData = useCallback(async () => {
    if (userId === 0) return;

    setLoading(true);
    setError(null);

    try {
      const response = await getUserProgress(userId, {
        position: selectedPosition,
        time_range: timeRange,
      });

      setProgressData(response.progress_data);
      setStatistics(response.statistics);
      setPositionBreakdown(response.position_breakdown);
    } catch (err) {
      console.error("Failed to load progress data:", err);
      setError("Failed to load progress data. Please try again.");
      // Reset to empty states on error
      setProgressData([]);
      setStatistics(null);
      setPositionBreakdown([]);
    } finally {
      setLoading(false);
    }
  }, [userId, selectedPosition, timeRange]);

  useEffect(() => {
    loadProgressData();
  }, [loadProgressData]);

  // Format chart data for display
  const chartData = progressData.map((item) => ({
    date: new Date(item.date).toLocaleDateString(),
    score: item.score,
    question_count: item.question_count,
  }));

  const getImprovementIcon = (rate: number) => {
    if (rate > 0) return <TrendingUpIcon />;
    if (rate < 0) return <TrendingDownIcon />;
    return <RemoveIcon />;
  };

  const getImprovementColor = (rate: number): "success" | "danger" | "neutral" => {
    if (rate > 0) return "success";
    if (rate < 0) return "danger";
    return "neutral";
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography level="h4">
          {PositionLabels[selectedPosition as PositionKey]} - Progress Analytics
        </Typography>
        <Select
          value={timeRange}
          onChange={(_, value) => setTimeRange(value || "7days")}
          sx={{ minWidth: 120 }}
          disabled={loading}
        >
          <Option value="7days">Last 7 Days</Option>
          <Option value="30days">Last 30 Days</Option>
          <Option value="90days">Last 90 Days</Option>
        </Select>
      </Stack>

      {/* Loading State */}
      {loading && (
        <Alert color="neutral" variant="soft">
          Loading progress data...
        </Alert>
      )}

      {/* Error State */}
      {error && (
        <Alert color="danger" variant="soft">
          {error}
        </Alert>
      )}

      {/* No Data State */}
      {!loading && !error && statistics?.total_questions === 0 && (
        <Alert color="neutral" variant="soft">
          No practice records for this position yet. Start practicing to track your progress!
        </Alert>
      )}

      {/* Main Content */}
      {!loading && !error && statistics && statistics.total_questions > 0 && (
        <>
          {/* Statistics Cards */}
          <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
            <Card variant="soft" color="primary" sx={{ flex: 1 }}>
              <CardContent>
                <Typography level="body-sm" color="primary">
                  Total Questions
                </Typography>
                <Typography level="h3">{statistics.total_questions}</Typography>
              </CardContent>
            </Card>

            <Card variant="soft" color="success" sx={{ flex: 1 }}>
              <CardContent>
                <Typography level="body-sm" color="success">
                  Average Score
                </Typography>
                <Typography level="h3">{Math.round(statistics.average_score)}</Typography>
              </CardContent>
            </Card>

            <Card
              variant="soft"
              color={getImprovementColor(statistics.improvement_rate)}
              sx={{ flex: 1 }}
            >
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography level="body-sm">Improvement</Typography>
                  {getImprovementIcon(statistics.improvement_rate)}
                </Stack>
                <Typography level="h3">
                  {statistics.improvement_rate > 0 ? "+" : ""}
                  {statistics.improvement_rate.toFixed(1)}%
                </Typography>
              </CardContent>
            </Card>

            <Card variant="soft" color="warning" sx={{ flex: 1 }}>
              <CardContent>
                <Typography level="body-sm" color="warning">
                  Current Streak
                </Typography>
                <Typography level="h3">{statistics.current_streak} Days</Typography>
              </CardContent>
            </Card>
          </Stack>

          {/* Additional Statistics Row */}
          <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
            <Card variant="outlined" sx={{ flex: 1 }}>
              <CardContent>
                <Typography level="body-sm" color="success">
                  Best Score
                </Typography>
                <Chip color="success" size="lg">
                  {statistics.best_score}
                </Chip>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ flex: 1 }}>
              <CardContent>
                <Typography level="body-sm" color="danger">
                  Lowest Score
                </Typography>
                <Chip color="danger" size="lg">
                  {statistics.worst_score}
                </Chip>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ flex: 1 }}>
              <CardContent>
                <Typography level="body-sm" color="primary">
                  Practice Time
                </Typography>
                <Chip color="primary" size="lg">
                  {Math.round(statistics.total_practice_time / 60)}h
                </Chip>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ flex: 1 }}>
              <CardContent>
                <Typography level="body-sm" color="neutral">
                  Score Range
                </Typography>
                <Chip color="neutral" size="lg">
                  {statistics.best_score - statistics.worst_score}
                </Chip>
              </CardContent>
            </Card>
          </Stack>

          {/* Position Breakdown (if multiple positions) */}
          {positionBreakdown.length > 1 && (
            <Card variant="outlined" sx={{ mb: 4 }}>
              <CardContent>
                <Typography level="title-md" sx={{ mb: 2 }}>
                  Position Breakdown
                </Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  {positionBreakdown.map((breakdown) => (
                    <Box key={breakdown.position} sx={{ minWidth: 150 }}>
                      <Typography level="body-sm" color="neutral">
                        {PositionLabels[breakdown.position as PositionKey] || breakdown.position}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip size="sm" color="primary">
                          {breakdown.question_count} questions
                        </Chip>
                        <Chip size="sm" color="success">
                          {Math.round(breakdown.average_score)} avg
                        </Chip>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Daily Progress Chart */}
          <Card variant="outlined">
            <CardContent>
              <Typography level="title-md" sx={{ mb: 3 }}>
                Daily Performance Trend
              </Typography>
              {chartData.length > 0 ? (
                <BarChart
                  dataset={chartData}
                  xAxis={[
                    {
                      dataKey: "date",
                      label: "Date",
                      tickPlacement: "middle",
                      tickLabelPlacement: "middle",
                    },
                  ]}
                  series={[
                    {
                      dataKey: "score",
                      label: "Average Score",
                      color: "#1976d2",
                    },
                  ]}
                  height={300}
                  yAxis={[{ label: "Score", width: 60, min: 0, max: 100 }]}
                />
              ) : (
                <Alert color="neutral" variant="soft">
                  No daily data available for the selected time range.
                </Alert>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}
