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
import { formatLocalDateTime } from "../utils/dateTime";
import { parseInterviewRecordDisplay } from "../utils/interviewRecordDisplay";

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
  const displayRecord = record ? parseInterviewRecordDisplay(record) : null;
  const questionSections = displayRecord?.questionSections || [];
  const answerSections = displayRecord?.answerSections || [];
  const shouldRenderConversation = questionSections.length > 1 || answerSections.length > 1;
  const conversationTurnCount = Math.max(questionSections.length, answerSections.length);

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
                <Typography level="title-sm" sx={{ color: "primary.600" }}>
                  Position
                </Typography>
                <Chip variant="soft">{PositionLabels[record.position as PositionKey]}</Chip>
              </Box>

              {displayRecord?.projectName && (
                <Box>
                  <Typography level="title-sm" sx={{ color: "primary.600" }}>
                    Project
                  </Typography>
                  <Chip variant="soft" color="warning">
                    {displayRecord.projectName}
                  </Chip>
                </Box>
              )}

              <Box>
                <Typography level="title-sm" sx={{ color: "primary.600" }}>
                  Time
                </Typography>
                <Typography level="body-sm">{formatLocalDateTime(record.created_at)}</Typography>
              </Box>

              <Divider />

              {shouldRenderConversation ? (
                <Box>
                  <Typography level="title-sm" sx={{ color: "primary.600", mb: 1 }}>
                    Interview Conversation
                  </Typography>
                  <Stack spacing={1.5}>
                    {Array.from({ length: conversationTurnCount }, (_, index) => (
                      <Stack key={index} spacing={1}>
                        {questionSections[index] && (
                          <Card
                            variant="soft"
                            sx={{
                              bgcolor: "primary.50",
                              borderLeft: "4px solid",
                              borderLeftColor: "primary.500",
                            }}
                          >
                            <CardContent>
                              <Typography level="body-xs" sx={{ color: "primary.600", mb: 0.5 }}>
                                Question {index + 1}
                              </Typography>
                              <Typography level="body-md" sx={{ whiteSpace: "pre-wrap" }}>
                                {questionSections[index]}
                              </Typography>
                            </CardContent>
                          </Card>
                        )}
                        {answerSections[index] && (
                          <Card
                            variant="outlined"
                            sx={{
                              borderLeft: "4px solid",
                              borderLeftColor: "neutral.400",
                            }}
                          >
                            <CardContent>
                              <Typography level="body-xs" sx={{ color: "neutral.600", mb: 0.5 }}>
                                Answer {index + 1}
                              </Typography>
                              <Typography level="body-md" sx={{ whiteSpace: "pre-wrap" }}>
                                {answerSections[index]}
                              </Typography>
                            </CardContent>
                          </Card>
                        )}
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              ) : (
                <>
                  <Box>
                    <Typography level="title-sm" sx={{ color: "primary.600", mb: 1 }}>
                      Interview Question
                    </Typography>
                    <Card
                      variant="soft"
                      sx={{
                        bgcolor: "primary.50",
                        borderLeft: "4px solid",
                        borderLeftColor: "primary.500",
                      }}
                    >
                      <CardContent>
                        <Typography level="body-md">{record.question_content}</Typography>
                      </CardContent>
                    </Card>
                  </Box>

                  <Box>
                    <Typography level="title-sm" sx={{ color: "primary.600", mb: 1 }}>
                      My Answer
                    </Typography>
                    <Card
                      variant="outlined"
                      sx={{
                        borderLeft: "4px solid",
                        borderLeftColor: "neutral.400",
                      }}
                    >
                      <CardContent>
                        <Typography level="body-md" sx={{ whiteSpace: "pre-wrap" }}>
                          {record.answer}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Box>
                </>
              )}

              <Box>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                  <Typography level="title-sm" sx={{ color: "primary.600" }}>
                    AI Score & Feedback
                  </Typography>
                  <Chip color={getScoreColor(record.score)}>{record.score}/100</Chip>
                </Stack>
                <Card
                  variant="soft"
                  color={getScoreColor(record.score)}
                  sx={{
                    borderLeft: "4px solid",
                    borderLeftColor: `${getScoreColor(record.score)}.500`,
                  }}
                >
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
