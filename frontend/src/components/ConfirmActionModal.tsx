import { Box, Button, Modal, ModalClose, ModalDialog, Stack, Typography } from "@mui/joy";

interface ConfirmActionModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ConfirmActionModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  loading = false,
  onClose,
  onConfirm,
}: ConfirmActionModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        p: 2,
      }}
    >
      <ModalDialog variant="outlined" sx={{ maxWidth: 420, width: "90vw" }}>
        <ModalClose />
        <Box sx={{ p: 2 }}>
          <Typography level="h4" sx={{ mb: 1, textAlign: "center" }}>
            {title}
          </Typography>
          <Typography level="body-md" sx={{ mb: 3, textAlign: "center", color: "neutral.600" }}>
            {description}
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button variant="outlined" color="neutral" disabled={loading} onClick={onClose}>
              {cancelLabel}
            </Button>
            <Button color="danger" loading={loading} disabled={loading} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </Stack>
        </Box>
      </ModalDialog>
    </Modal>
  );
}
