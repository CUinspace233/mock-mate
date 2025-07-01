import { useState, useEffect, useRef } from "react";
import { Modal, ModalDialog, ModalClose, Box, Typography, Alert, Stack, Button } from "@mui/joy";
import { Newspaper } from "@mui/icons-material";
import NewsQuestionCard from "./NewsQuestionCard";
import { NewsQuestionPushService } from "../services/newsQuestionPushService";
import { getTrendingQuestions } from "../api/api";
import type { NewsQuestion } from "../types/interview";

interface NewsQuestionPushProps {
  userId: number;
  selectedPosition: string;
  onStartAnswering: (questionId: string, newsQuestion: NewsQuestion) => void;
  isInterviewActive: boolean;
}

export default function NewsQuestionPush({
  userId,
  selectedPosition,
  onStartAnswering,
  isInterviewActive,
}: NewsQuestionPushProps) {
  const [currentQuestion, setCurrentQuestion] = useState<NewsQuestion | null>(null);
  const [showPushModal, setShowPushModal] = useState(false);
  const [isServiceStarted, setIsServiceStarted] = useState(false);
  const [error, setError] = useState<string>("");
  const [isLoadingManual, setIsLoadingManual] = useState(false);

  const pushServiceRef = useRef<NewsQuestionPushService | null>(null);

  useEffect(() => {
    // Initialize push service
    if (userId && !pushServiceRef.current) {
      pushServiceRef.current = new NewsQuestionPushService(userId);

      pushServiceRef.current.setCallbacks(
        // onPush callback
        (question: NewsQuestion) => {
          setCurrentQuestion(question);
          setShowPushModal(true);
        },
        // onReminder callback
        (question: NewsQuestion) => {
          setCurrentQuestion(question);
          setShowPushModal(true);
        },
      );
    }

    return () => {
      // Cleanup on unmount
      if (pushServiceRef.current) {
        pushServiceRef.current.stopPushService();
      }
    };
  }, [userId]);

  useEffect(() => {
    // Start/stop service based on interview status
    if (pushServiceRef.current && !isInterviewActive && !isServiceStarted) {
      pushServiceRef.current
        .startPushService()
        .then(() => {
          setIsServiceStarted(true);
          setError("");
        })
        .catch((err) => {
          setError("Failed to start push service: " + err.message);
        });
    } else if (pushServiceRef.current && isInterviewActive && isServiceStarted) {
      // Pause during interview but don't stop completely
      console.log("Interview active, push service will skip notifications");
    }
  }, [isInterviewActive, isServiceStarted]);

  const handleStartAnswer = (questionId: string) => {
    if (pushServiceRef.current) {
      pushServiceRef.current.updatePushStatus(questionId, "answered");
    }
    setShowPushModal(false);

    // Pass the complete news question object
    if (currentQuestion) {
      onStartAnswering(questionId, currentQuestion);
    }
    setCurrentQuestion(null);
  };

  const handleDismiss = (questionId: string) => {
    if (pushServiceRef.current) {
      pushServiceRef.current.updatePushStatus(questionId, "dismissed");

      // Set reminder for 1 hour
      if (currentQuestion) {
        pushServiceRef.current.setReminder(currentQuestion);
      }
    }
    setShowPushModal(false);
    setCurrentQuestion(null);
  };

  const handleCloseModal = () => {
    setShowPushModal(false);
    // Don't clear currentQuestion here in case user reopens
  };

  // Handle manual fetch of news questions
  const handleManualFetch = async () => {
    setIsLoadingManual(true);
    setError("");

    try {
      const response = await getTrendingQuestions({
        position: selectedPosition,
        limit: 1,
        days_back: 7,
      });

      if (response.questions.length === 0) {
        setError("No related news question, please try again later");
        return;
      }

      const question = response.questions[0];
      if (!question) {
        setError("No related news question, please try again later");
        return;
      }
      setCurrentQuestion(question);
      setShowPushModal(true);
    } catch (err: unknown) {
      setError(
        "Failed to fetch news question: " + (err instanceof Error ? err.message : "network error"),
      );
    } finally {
      setIsLoadingManual(false);
    }
  };

  // Component to render the manual fetch button
  const ManualFetchButton = () => (
    <Button
      variant="outlined"
      color="primary"
      size="sm"
      onClick={handleManualFetch}
      loading={isLoadingManual}
      startDecorator={!isLoadingManual && <Newspaper />}
      sx={{
        flex: { xs: 1, sm: "none" },
        minWidth: { sm: 140 },
      }}
    >
      {isLoadingManual ? "Fetching..." : "Daily Trending Question"}
    </Button>
  );

  return (
    <>
      {/* Manual Fetch Button - expose this component */}
      {ManualFetchButton()}

      {/* Error Alert */}
      {error && (
        <Alert color="warning" variant="soft" sx={{ mb: 2 }}>
          <Typography level="body-sm">{error}</Typography>
          <Button size="sm" variant="plain" onClick={() => setError("")} sx={{ ml: 1 }}>
            Close
          </Button>
        </Alert>
      )}

      {/* Push Statistics (optional debug info) */}
      {import.meta.env.VITE_NODE_ENV === "development" && pushServiceRef.current && (
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <Typography level="body-xs" color="neutral">
            Push service status: {isServiceStarted ? "✅ Active" : "⏸️ Not started"}
          </Typography>
        </Stack>
      )}

      {/* Push Modal */}
      <Modal
        open={showPushModal && currentQuestion !== null}
        onClose={handleCloseModal}
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          p: 2,
        }}
      >
        <ModalDialog
          variant="outlined"
          sx={{
            maxWidth: "95vw",
            maxHeight: "95vh",
            overflow: "auto",
            p: 0,
          }}
        >
          <ModalClose />
          <Box sx={{ p: 1 }}>
            {currentQuestion && (
              <NewsQuestionCard
                question={currentQuestion}
                onAnswer={handleStartAnswer}
                onDismiss={handleDismiss}
              />
            )}
          </Box>
        </ModalDialog>
      </Modal>
    </>
  );
}

// Export the manual fetch button as a separate component
export function NewsQuestionButton({
  selectedPosition,
  onStartAnswering,
}: {
  selectedPosition: string;
  onStartAnswering: (questionId: string, newsQuestion: NewsQuestion) => void;
}) {
  const [currentQuestion, setCurrentQuestion] = useState<NewsQuestion | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const handleFetch = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await getTrendingQuestions({
        position: selectedPosition,
        limit: 1,
        days_back: 7,
      });

      if (response.questions.length === 0) {
        setError("No related news question, please try again later");
        return;
      }

      const question = response.questions[0];
      if (!question) {
        setError("No related news question, please try again later");
        return;
      }
      setCurrentQuestion(question);
      setShowModal(true);
    } catch (err: unknown) {
      setError(
        "Failed to fetch news question: " + (err instanceof Error ? err.message : "network error"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartAnswer = (questionId: string) => {
    setShowModal(false);

    // Pass the complete news question object
    if (currentQuestion) {
      onStartAnswering(questionId, currentQuestion);
    }
    setCurrentQuestion(null);
  };

  const handleDismiss = () => {
    setShowModal(false);
    setCurrentQuestion(null);
  };

  return (
    <>
      <Button
        variant="outlined"
        color="primary"
        size="sm"
        onClick={handleFetch}
        loading={isLoading}
        startDecorator={!isLoading && <Newspaper />}
        sx={{
          flex: { xs: 1, sm: "none" },
          minWidth: { sm: 140 },
        }}
      >
        {isLoading ? "Fetching..." : "Daily Trending Question"}
      </Button>

      {/* Error display */}
      {error && (
        <Alert
          color="warning"
          variant="soft"
          sx={{ mt: 1 }}
          endDecorator={
            <Button size="sm" variant="plain" onClick={() => setError("")}>
              ×
            </Button>
          }
        >
          <Typography level="body-sm">{error}</Typography>
        </Alert>
      )}

      {/* Modal */}
      <Modal
        open={showModal && currentQuestion !== null}
        onClose={() => setShowModal(false)}
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          p: 2,
        }}
      >
        <ModalDialog
          variant="outlined"
          sx={{
            maxWidth: "95vw",
            maxHeight: "95vh",
            overflow: "auto",
            p: 0,
          }}
        >
          <ModalClose />
          <Box sx={{ p: 1 }}>
            {currentQuestion && (
              <NewsQuestionCard
                question={currentQuestion}
                onAnswer={handleStartAnswer}
                onDismiss={handleDismiss}
              />
            )}
          </Box>
        </ModalDialog>
      </Modal>
    </>
  );
}
