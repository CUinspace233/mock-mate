import * as React from "react";
import Box from "@mui/joy/Box";
import Alert from "@mui/joy/Alert";
import IconButton from "@mui/joy/IconButton";
import Typography from "@mui/joy/Typography";
import type { ColorPaletteProp } from "@mui/joy/styles";
import InfoIcon from "@mui/icons-material/Info";
import WarningIcon from "@mui/icons-material/Warning";
import ReportIcon from "@mui/icons-material/Report";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

interface CustomAlertProps {
  type?: "success" | "warning" | "error" | "neutral";
  title?: string;
  message: string;
  onClose?: () => void;
}

const iconMap: Record<string, React.ReactElement> = {
  success: <CheckCircleIcon />,
  warning: <WarningIcon />,
  error: <ReportIcon />,
  neutral: <InfoIcon />,
};

const colorMap: Record<string, ColorPaletteProp> = {
  success: "success",
  warning: "warning",
  error: "danger",
  neutral: "neutral",
};

export default function CustomAlert({
  type = "neutral",
  title,
  message,
  onClose,
}: CustomAlertProps) {
  const color = colorMap[type];
  const icon = iconMap[type];

  return (
    <Box sx={{ width: "100%" }}>
      <Alert
        sx={{ alignItems: "flex-start" }}
        startDecorator={icon}
        variant="soft"
        color={color}
        endDecorator={
          onClose && (
            <IconButton variant="soft" color={color} onClick={onClose}>
              <CloseRoundedIcon />
            </IconButton>
          )
        }
      >
        <div>
          {title && <div>{title}</div>}
          <Typography level="body-sm" color={color}>
            {message}
          </Typography>
        </div>
      </Alert>
    </Box>
  );
}
