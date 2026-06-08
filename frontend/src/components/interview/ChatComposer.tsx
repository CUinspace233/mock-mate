import { Button, IconButton, Stack, Textarea, Tooltip, Typography } from "@mui/joy";
import {
  Mic as MicIcon,
  Send as SendIcon,
  Stop as StopIcon,
} from "@mui/icons-material";

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  loading?: boolean;
  isRecording?: boolean;
  isSupported?: boolean;
  onToggleRecording?: () => void;
  placeholder?: string;
  leftAction?: React.ReactNode;
}

export default function ChatComposer({
  value,
  onChange,
  onSend,
  disabled,
  loading,
  isRecording,
  isSupported,
  onToggleRecording,
  placeholder = "Type your answer...",
  leftAction,
}: ChatComposerProps) {
  const canSend = !disabled && !loading && !!value.trim();

  return (
    <Stack
      spacing={1}
      sx={{
        maxWidth: 860,
        mx: "auto",
        p: 1,
        bgcolor: "background.surface",
        border: "1px solid",
        borderColor: isRecording ? "danger.300" : "neutral.200",
        borderRadius: "lg",
        boxShadow: "md",
      }}
    >
      <Textarea
        minRows={2}
        maxRows={7}
        variant="plain"
        value={value}
        placeholder={isRecording ? "Listening..." : placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            if (canSend) onSend();
          }
        }}
        sx={{
          px: 1,
          "--Textarea-focusedThickness": "0px",
          "--Textarea-focusedHighlight": "transparent",
        }}
      />
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          {leftAction}
          <Typography level="body-xs" sx={{ color: "neutral.500" }}>
            Ctrl/Cmd+Enter to send
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.75}>
          {isSupported && onToggleRecording && (
            <Tooltip title={isRecording ? "Stop recording" : "Start voice input"}>
              <IconButton
                variant={isRecording ? "solid" : "soft"}
                color={isRecording ? "danger" : "neutral"}
                size="sm"
                onClick={onToggleRecording}
                disabled={loading}
              >
                {isRecording ? <StopIcon /> : <MicIcon />}
              </IconButton>
            </Tooltip>
          )}
          <Button
            size="sm"
            startDecorator={<SendIcon />}
            disabled={!canSend}
            loading={loading}
            onClick={onSend}
          >
            Send
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}
