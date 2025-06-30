import {
  Modal,
  ModalDialog,
  ModalClose,
  Box,
  Typography,
  Stack,
  Chip,
  Divider,
  Card,
  CardContent,
} from "@mui/joy";
import { type InterviewRecord, PositionLabels, type PositionKey } from "../types/interview";

interface InterviewRecordDetailsModalProps {
  open: boolean;
  onClose: () => void;
  record: InterviewRecord | null;
  getScoreColor: (score: number) => "success" | "primary" | "warning" | "danger";
}

export default function InterviewRecordDetailsModal({
  open,
  onClose,
  record,
  getScoreColor,
}: InterviewRecordDetailsModalProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ maxWidth: 800, width: "90vw" }}>
        <ModalClose />
        {record && (
          <Box sx={{ maxHeight: "90vh", overflow: "auto" }}>
            <Typography level="h4" sx={{ mb: 2 }}>
              Interview Record Details
            </Typography>

            <Stack spacing={2}>
              <Box>
                <Typography level="title-sm" color="primary">
                  Position
                </Typography>
                <Chip variant="soft">{PositionLabels[record.position as PositionKey]}</Chip>
              </Box>

              <Box>
                <Typography level="title-sm" color="primary">
                  Time
                </Typography>
                <Typography level="body-sm">
                  {record.created_at ? new Date(record.created_at).toLocaleString() : "N/A"}
                </Typography>
              </Box>

              <Divider />

              <Box>
                <Typography level="title-sm" color="primary" sx={{ mb: 1 }}>
                  Interview Question
                </Typography>
                <Card variant="soft">
                  <CardContent>
                    <Typography level="body-md">{record.question_content}</Typography>
                  </CardContent>
                </Card>
              </Box>

              <Box>
                <Typography level="title-sm" color="primary" sx={{ mb: 1 }}>
                  My Answer
                </Typography>
                <Card variant="outlined">
                  <CardContent>
                    <Typography level="body-md" sx={{ whiteSpace: "pre-wrap" }}>
                      {record.answer}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              <Box>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                  <Typography level="title-sm" color="primary">
                    AI Score & Feedback
                  </Typography>
                  <Chip color={getScoreColor(record.score)}>{record.score}/100</Chip>
                </Stack>
                <Card variant="soft" color={getScoreColor(record.score)}>
                  <CardContent>
                    <Typography level="body-md" sx={{ whiteSpace: "pre-wrap" }}>
                      {record.feedback}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            </Stack>
          </Box>
        )}
      </ModalDialog>
    </Modal>
  );
}
