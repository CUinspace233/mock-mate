import { Box } from "@mui/joy";

interface MockMateIconProps {
  size?: number;
  alt?: string;
}

export default function MockMateIcon({ size = 28, alt = "MockMate" }: MockMateIconProps) {
  return (
    <Box
      component="img"
      src="/mock-mate.png"
      alt={alt}
      sx={{
        width: size,
        height: size,
        display: "block",
        objectFit: "contain",
        flexShrink: 0,
      }}
    />
  );
}
