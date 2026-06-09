import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Input,
  Option,
  Select,
  Stack,
  Textarea,
  Typography,
  type ColorPaletteProp,
} from "@mui/joy";
import {
  Check as CheckIcon,
  Cancel as CancelIcon,
  Clear as ClearIcon,
  Tune as TuneIcon,
  ExpandLess as CollapseIcon,
} from "@mui/icons-material";
import {
  CreativityLevel,
  type CodeQuestionMode,
  Difficulty,
  JOB_POSITION_OPTIONS,
  QuestionType,
} from "../../types/interview";
import { getDifficultyColor } from "../../utils";

type ApiKeyStatus = "valid" | "invalid" | "checking" | "idle";

interface PracticeSetupPanelProps {
  selectedPosition: string;
  onPositionChange: (position: string) => void;
  selectedDifficulty: Difficulty;
  onDifficultyChange: (difficulty: Difficulty) => void;
  selectedQuestionType: QuestionType;
  onQuestionTypeChange: (type: QuestionType) => void;
  questionCountTarget: number;
  onQuestionCountTargetChange: (count: number) => void;
  followUpLimit: number;
  onFollowUpLimitChange: (limit: number) => void;
  language: string;
  onLanguageChange: (language: string) => void;
  questionCreativity: CreativityLevel;
  onQuestionCreativityChange: (creativity: CreativityLevel) => void;
  codeQuestionMode: CodeQuestionMode;
  onCodeQuestionModeChange: (mode: CodeQuestionMode) => void;
  openaiModel: string;
  onOpenaiModelChange: (model: string) => void;
  availableModels: string[];
  displayApiKey: string;
  onApiKeyChange: (apiKey: string) => void;
  apiKeyStatus: ApiKeyStatus;
  jobDescription: string;
  onJobDescriptionChange: (description: string) => void;
  mode?: "chat" | "resume";
}

const apiStatusLabel: Record<ApiKeyStatus, string> = {
  valid: "API ready",
  invalid: "API invalid",
  checking: "Checking API",
  idle: "API needed",
};

const languageLabels: Record<string, string> = {
  en: "English",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
};

const codeQuestionModeLabels: Record<CodeQuestionMode, string> = {
  mixed: "code optional",
  include: "include code",
  exclude: "no code",
};

function fieldLabel(label: string) {
  return (
    <Typography level="body-xs" sx={{ color: "neutral.500", fontWeight: 700 }}>
      {label}
    </Typography>
  );
}

export default function PracticeSetupPanel({
  selectedPosition,
  onPositionChange,
  selectedDifficulty,
  onDifficultyChange,
  selectedQuestionType,
  onQuestionTypeChange,
  questionCountTarget,
  onQuestionCountTargetChange,
  followUpLimit,
  onFollowUpLimitChange,
  language,
  onLanguageChange,
  questionCreativity,
  onQuestionCreativityChange,
  codeQuestionMode,
  onCodeQuestionModeChange,
  openaiModel,
  onOpenaiModelChange,
  availableModels,
  displayApiKey,
  onApiKeyChange,
  apiKeyStatus,
  jobDescription,
  onJobDescriptionChange,
  mode = "chat",
}: PracticeSetupPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [customPositionMode, setCustomPositionMode] = useState(false);
  const [customPositionInput, setCustomPositionInput] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;

      // Keep open while interacting with Joy UI select popovers.
      if (target instanceof Element) {
        if (target.closest('[role="listbox"]') || target.closest(".MuiPopper-root")) {
          return;
        }
      }

      setExpanded(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [expanded]);
  const trimmedJobDescription = jobDescription.trim();
  const selectedModel = availableModels.includes(openaiModel) ? openaiModel : null;
  const modelSummaryLabel =
    selectedModel ||
    (apiKeyStatus === "checking"
      ? "Loading models"
      : apiKeyStatus === "valid"
        ? "Select model"
        : "Model unavailable");

  return (
    <Box
      ref={panelRef}
      sx={{
        mb: 1.5,
        position: "relative",
        zIndex: expanded ? 20 : "auto",
        border: "1px solid",
        borderColor: "neutral.200",
        borderRadius: "lg",
        bgcolor: "background.surface",
        boxShadow: "xs",
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
        sx={{
          p: 1.25,
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip size="sm" variant="soft" color="primary">
            {selectedPosition}
          </Chip>
          <Chip size="sm" variant="soft" color={getDifficultyColor(selectedDifficulty) as ColorPaletteProp}>
            {selectedDifficulty}
          </Chip>
          {mode === "chat" && (
            <>
              <Chip size="sm" variant="soft" color="neutral">
                {selectedQuestionType}
              </Chip>
              <Chip size="sm" variant="soft" color="neutral">
                {questionCountTarget} questions
              </Chip>
              <Chip size="sm" variant="soft" color="neutral">
                {followUpLimit ? `${followUpLimit} follow-ups` : "follow-ups off"}
              </Chip>
              <Chip size="sm" variant="soft" color="neutral">
                {codeQuestionModeLabels[codeQuestionMode]}
              </Chip>
            </>
          )}
          <Chip size="sm" variant="soft" color="neutral">
            {languageLabels[language] || language}
          </Chip>
          <Chip size="sm" variant="soft" color="neutral">
            {modelSummaryLabel}
          </Chip>
          <Chip
            size="sm"
            variant="soft"
            color={
              apiKeyStatus === "valid"
                ? "success"
                : apiKeyStatus === "invalid"
                  ? "danger"
                  : apiKeyStatus === "checking"
                    ? "warning"
                    : "neutral"
            }
          >
            {apiStatusLabel[apiKeyStatus]}
          </Chip>
        </Stack>
        <Box
          sx={{
            width: { xs: "100%", sm: "auto" },
            display: "flex",
            justifyContent: { xs: "flex-end", sm: "flex-start" },
            mt: { xs: 0.25, sm: 0 },
          }}
        >
          <Button
            size="sm"
            variant="plain"
            color="neutral"
            startDecorator={expanded ? <CollapseIcon /> : <TuneIcon />}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Hide setup" : "Setup"}
          </Button>
        </Box>
      </Stack>

      {expanded && (
        <Box
          sx={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            zIndex: 21,
            border: "1px solid",
            borderColor: "neutral.200",
            borderRadius: "lg",
            bgcolor: "background.surface",
            boxShadow: "lg",
            maxHeight: { xs: "calc(100dvh - 132px)", md: "calc(100dvh - 160px)" },
            overflow: "auto",
          }}
        >
          <Divider sx={{ display: { xs: "none", sm: "block" } }} />
          <Stack spacing={2} sx={{ p: 1.5 }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                  lg: "repeat(4, minmax(0, 1fr))",
                },
                gap: 1.25,
              }}
            >
              <Stack spacing={0.5}>
                {fieldLabel("Position")}
                {customPositionMode ? (
                  <Input
                    size="sm"
                    placeholder="e.g. Game Developer"
                    value={customPositionInput}
                    autoFocus
                    onChange={(event) => {
                      setCustomPositionInput(event.target.value);
                      if (event.target.value.trim()) onPositionChange(event.target.value.trim());
                    }}
                    onBlur={() => {
                      if (!customPositionInput.trim()) {
                        setCustomPositionMode(false);
                        onPositionChange("frontend");
                      }
                    }}
                  />
                ) : (
                  <Select
                    size="sm"
                    value={selectedPosition}
                    onChange={(_, value) => {
                      if (value === "__custom__") {
                        setCustomPositionMode(true);
                        setCustomPositionInput("");
                        return;
                      }
                      if (value) onPositionChange(value);
                    }}
                  >
                    {JOB_POSITION_OPTIONS.map((position) => (
                      <Option key={position.value} value={position.value}>
                        {position.label}
                      </Option>
                    ))}
                  </Select>
                )}
              </Stack>

              {mode === "chat" && (
                <Stack spacing={0.5}>
                  {fieldLabel("Question type")}
                  <Select
                    size="sm"
                    value={selectedQuestionType}
                    onChange={(_, value) => value && onQuestionTypeChange(value as QuestionType)}
                  >
                    <Option value={QuestionType.TECHNICAL}>Technical</Option>
                    <Option value={QuestionType.BEHAVIORAL}>Behavioral</Option>
                    <Option value={QuestionType.OPINION}>Opinion</Option>
                  </Select>
                </Stack>
              )}

              <Stack spacing={0.5}>
                {fieldLabel("Difficulty")}
                <Select
                  size="sm"
                  value={selectedDifficulty}
                  color={getDifficultyColor(selectedDifficulty) as ColorPaletteProp}
                  onChange={(_, value) => value && onDifficultyChange(value as Difficulty)}
                >
                  <Option value={Difficulty.EASY}>Easy</Option>
                  <Option value={Difficulty.MEDIUM}>Medium</Option>
                  <Option value={Difficulty.HARD}>Hard</Option>
                </Select>
              </Stack>

              {mode === "chat" && (
                <Stack spacing={0.5}>
                  {fieldLabel("Questions")}
                  <Select
                    size="sm"
                    value={questionCountTarget}
                    onChange={(_, value) => value && onQuestionCountTargetChange(value as number)}
                  >
                    <Option value={3}>3</Option>
                    <Option value={5}>5</Option>
                    <Option value={8}>8</Option>
                    <Option value={10}>10</Option>
                  </Select>
                </Stack>
              )}

              {mode === "chat" && (
                <Stack spacing={0.5}>
                  {fieldLabel("Follow-ups")}
                  <Select
                    size="sm"
                    value={followUpLimit}
                    onChange={(_, value) => value !== null && onFollowUpLimitChange(value as number)}
                  >
                    <Option value={0}>Off</Option>
                    <Option value={1}>1</Option>
                    <Option value={2}>2</Option>
                    <Option value={3}>3</Option>
                    <Option value={4}>4</Option>
                    <Option value={5}>5</Option>
                  </Select>
                </Stack>
              )}

              {mode === "chat" && (
                <Stack spacing={0.5}>
                  {fieldLabel("Code questions")}
                  <Select
                    size="sm"
                    value={codeQuestionMode}
                    onChange={(_, value) => value && onCodeQuestionModeChange(value as CodeQuestionMode)}
                  >
                    <Option value="mixed">Mixed</Option>
                    <Option value="include">Include code</Option>
                    <Option value="exclude">No code</Option>
                  </Select>
                </Stack>
              )}

              <Stack spacing={0.5}>
                {fieldLabel("Language")}
                <Select size="sm" value={language} onChange={(_, value) => value && onLanguageChange(value)}>
                  <Option value="en">English</Option>
                  <Option value="zh">中文</Option>
                  <Option value="ja">日本語</Option>
                  <Option value="ko">한국어</Option>
                </Select>
              </Stack>

              <Stack spacing={0.5}>
                {fieldLabel("Creativity")}
                <Select
                  size="sm"
                  value={questionCreativity}
                  onChange={(_, value) => value && onQuestionCreativityChange(value as CreativityLevel)}
                >
                  <Option value={CreativityLevel.FOCUSED}>Focused</Option>
                  <Option value={CreativityLevel.BALANCED}>Balanced</Option>
                  <Option value={CreativityLevel.CREATIVE}>Creative</Option>
                </Select>
              </Stack>

              <Stack spacing={0.5}>
                {fieldLabel("Model")}
                <Select
                  size="sm"
                  value={selectedModel}
                  placeholder={
                    apiKeyStatus === "checking"
                      ? "Loading models..."
                      : apiKeyStatus === "valid"
                        ? "No compatible models found"
                        : "Enter a valid API key"
                  }
                  disabled={apiKeyStatus !== "valid" || availableModels.length === 0}
                  onChange={(_, value) => value && onOpenaiModelChange(value)}
                >
                  {availableModels.map((model) => (
                    <Option key={model} value={model}>
                      {model}
                    </Option>
                  ))}
                </Select>
              </Stack>
            </Box>

            <Stack spacing={0.75}>
              {fieldLabel("OpenAI API key")}
              <Input
                placeholder="sk-..."
                value={displayApiKey}
                onChange={(event) => onApiKeyChange(event.target.value)}
                type="password"
                size="sm"
                endDecorator={
                  <Stack direction="row" spacing={0.25} alignItems="center">
                    {displayApiKey.length > 0 && (
                      <IconButton
                        size="sm"
                        variant="plain"
                        color="neutral"
                        aria-label="Clear API key"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => onApiKeyChange("")}
                      >
                        <ClearIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    )}
                    {apiKeyStatus === "valid" ? (
                      <CheckIcon color="success" sx={{ fontSize: 16 }} />
                    ) : apiKeyStatus === "invalid" ? (
                      <CancelIcon color="error" sx={{ fontSize: 16 }} />
                    ) : apiKeyStatus === "checking" ? (
                      <CircularProgress size="sm" />
                    ) : null}
                  </Stack>
                }
              />
            </Stack>

            {mode === "chat" && (
              <Stack spacing={0.75}>
                {fieldLabel("Target job description")}
                <Textarea
                  minRows={3}
                  maxRows={7}
                  value={jobDescription}
                  onChange={(event) => onJobDescriptionChange(event.target.value.slice(0, 6000))}
                  placeholder="Optional: paste the target job description so questions and feedback can focus on the role."
                  endDecorator={
                    <Typography level="body-xs" sx={{ ml: "auto", color: "neutral.400" }}>
                      {trimmedJobDescription.length}/6000
                    </Typography>
                  }
                />
              </Stack>
            )}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
