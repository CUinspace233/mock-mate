import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  Chip,
  Button,
  Select,
  Option,
  Stack,
  IconButton,
} from "@mui/joy";
import {
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as RemoveIcon,
  Inbox as InboxIcon,
} from "@mui/icons-material";
import { type InterviewRecord, PositionLabels, type PositionKey } from "../types/interview";
import { getInterviewRecords } from "../api/api";
import InterviewRecordDetailsModal from "./InterviewRecordDetailsModal";
import { useAuthStore } from "../stores/useAuthStore";

interface InterviewHistoryProps {
  selectedPosition: string;
}

export default function InterviewHistory({ selectedPosition }: InterviewHistoryProps) {
  const [records, setRecords] = useState<InterviewRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<InterviewRecord[]>([]);
  const [filterPosition, setFilterPosition] = useState<string>(selectedPosition || "all");
  const [selectedRecord, setSelectedRecord] = useState<InterviewRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const userId = useAuthStore((state) => state.user_id);

  const filterRecords = useCallback(() => {
    if (filterPosition === "all") {
      setFilteredRecords(records);
    } else {
      setFilteredRecords(records.filter((record) => record.position === filterPosition));
    }
  }, [records, filterPosition]);

  useEffect(() => {
    filterRecords();
  }, [filterRecords]);

  useEffect(() => {
    if (selectedPosition && selectedPosition !== "all") {
      setFilterPosition(selectedPosition);
    }
  }, [selectedPosition]);

  const loadRecords = useCallback(async () => {
    if (userId === undefined) return;

    try {
      const res = await getInterviewRecords(userId, {
        position: filterPosition !== "all" ? filterPosition : undefined,
      });
      setRecords(
        res.records.sort(
          (a: InterviewRecord, b: InterviewRecord) =>
            new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime(),
        ),
      );
    } catch (error) {
      console.error(error);
      setRecords([]);
    }
  }, [userId, filterPosition]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleViewRecord = (record: InterviewRecord) => {
    setSelectedRecord(record);
    setModalOpen(true);
  };

  const handleDeleteRecord = (recordId: string) => {
    const updatedRecords = records.filter((record) => record.id !== recordId);
    setRecords(updatedRecords);
  };

  const clearAllRecords = () => {
    setRecords([]);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "success";
    if (score >= 80) return "primary";
    if (score >= 70) return "warning";
    return "danger";
  };

  const getScoreIcon = (score: number, prevScore?: number) => {
    if (!prevScore) return <RemoveIcon />;
    if (score > prevScore) return <TrendingUpIcon />;
    if (score < prevScore) return <TrendingDownIcon />;
    return <RemoveIcon />;
  };

  const calculateAverageScore = () => {
    if (filteredRecords.length === 0) return 0;
    const sum = filteredRecords.reduce((acc, record) => acc + record.score, 0);
    return Math.round(sum / filteredRecords.length);
  };

  const calculateImprovement = () => {
    if (filteredRecords.length < 2) return 0;
    const recent = filteredRecords.slice(0, 5);
    const older = filteredRecords.slice(-5);

    const recentAvg = recent.reduce((acc, record) => acc + record.score, 0) / recent.length;
    const olderAvg = older.reduce((acc, record) => acc + record.score, 0) / older.length;

    return Math.round(recentAvg - olderAvg);
  };

  const statCardSx = (accentColor: string, delay: number) => ({
    flex: 1,
    borderLeft: `4px solid`,
    borderLeftColor: accentColor,
    boxShadow: "sm",
    animation: `slideUp 0.4s ease-out ${delay * 0.1}s both`,
  });

  return (
    <Box sx={{ p: 3 }}>
      {/* Statistics Cards */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
        <Card sx={statCardSx("primary.500", 0)}>
          <CardContent>
            <Typography level="body-xs" sx={{ color: "neutral.500", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Total Practice Sessions
            </Typography>
            <Typography level="h3">{filteredRecords.length}</Typography>
          </CardContent>
        </Card>

        <Card sx={statCardSx("success.500", 1)}>
          <CardContent>
            <Typography level="body-xs" sx={{ color: "neutral.500", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Average Score
            </Typography>
            <Typography level="h3">{calculateAverageScore()}</Typography>
          </CardContent>
        </Card>

        <Card sx={statCardSx(calculateImprovement() >= 0 ? "success.500" : "danger.500", 2)}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography level="body-xs" sx={{ color: "neutral.500", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Recent Improvement
              </Typography>
              {getScoreIcon(calculateImprovement())}
            </Stack>
            <Typography level="h3">
              {calculateImprovement() > 0 ? "+" : ""}
              {calculateImprovement()}
            </Typography>
          </CardContent>
        </Card>
      </Stack>

      {/* Filter and Actions */}
      <Card variant="outlined" sx={{ mb: 3, boxShadow: "sm" }}>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography level="title-sm" sx={{ whiteSpace: "nowrap" }}>Filter:</Typography>
              <Select
                value={filterPosition}
                onChange={(_, value) => setFilterPosition(value || "all")}
                sx={{ minWidth: 150 }}
              >
                <Option value="all">All Positions</Option>
                {Object.entries(PositionLabels).map(([key, label]) => (
                  <Option key={key} value={key}>
                    {label}
                  </Option>
                ))}
              </Select>
            </Stack>

            <Button
              color="danger"
              variant="soft"
              startDecorator={<DeleteIcon />}
              onClick={clearAllRecords}
              disabled={records.length === 0}
            >
              Clear All Records
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Records Table */}
      {filteredRecords.length === 0 ? (
        <Box
          sx={{
            textAlign: "center",
            py: 6,
            animation: "fadeIn 0.4s ease-out",
          }}
        >
          <InboxIcon sx={{ fontSize: 48, color: "neutral.300", mb: 2 }} />
          <Typography level="body-lg" sx={{ color: "neutral.500" }}>
            No interview records yet
          </Typography>
          <Typography level="body-sm" sx={{ color: "neutral.400" }}>
            Start practicing to accumulate your records!
          </Typography>
        </Box>
      ) : (
        <Card variant="outlined" sx={{ borderRadius: "lg", overflow: "auto", boxShadow: "sm" }}>
          <Table
            sx={{
              "& tbody tr:nth-of-type(even)": {
                bgcolor: "neutral.50",
              },
            }}
          >
            <thead>
              <tr>
                <th style={{ width: "120px" }}>Date & Time</th>
                <th style={{ width: "120px" }}>Position</th>
                <th>Question</th>
                <th style={{ width: "80px" }}>Score</th>
                <th style={{ width: "100px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record, index) => (
                <tr key={record.id}>
                  <td>
                    <Typography level="body-sm">
                      {record.created_at ? new Date(record.created_at).toLocaleDateString() : ""}
                    </Typography>
                    <Typography level="body-xs" sx={{ color: "neutral.400" }}>
                      {record.created_at ? new Date(record.created_at).toLocaleTimeString() : ""}
                    </Typography>
                  </td>
                  <td>
                    <Chip size="sm" variant="soft">
                      {PositionLabels[record.position as PositionKey] || record.position}
                    </Chip>
                  </td>
                  <td>
                    <Typography
                      level="body-sm"
                      sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {record.question_content}
                    </Typography>
                  </td>
                  <td>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        size="sm"
                        color={getScoreColor(record.score)}
                        startDecorator={getScoreIcon(
                          record.score,
                          filteredRecords[index + 1]?.score,
                        )}
                      >
                        {record.score}
                      </Chip>
                    </Stack>
                  </td>
                  <td>
                    <Stack direction="row" spacing={0.5}>
                      <IconButton
                        size="sm"
                        variant="soft"
                        onClick={() => handleViewRecord(record)}
                      >
                        <ViewIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                      <IconButton
                        size="sm"
                        color="danger"
                        variant="soft"
                        onClick={() => handleDeleteRecord(record.id || "")}
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Stack>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {/* Interview Record Detail Modal */}
      <InterviewRecordDetailsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        record={selectedRecord}
        getScoreColor={getScoreColor}
      />
    </Box>
  );
}
