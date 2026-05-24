import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Option,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/joy";
import {
  Delete as DeleteIcon,
  Description as DescriptionIcon,
  Gavel as GavelIcon,
  UploadFile as UploadFileIcon,
  Visibility as VisibilityIcon,
} from "@mui/icons-material";
import type { ResumeProject, ResumeResource } from "../../types/interview";

const DRILL_POINT_OPTIONS = [1, 2, 3, 5];
const FOLLOW_UP_ROUND_OPTIONS = [1, 2, 3];

function extractionStatusLabel(status: ResumeResource["extraction_status"]) {
  if (status === "ai") return "AI parsed";
  if (status === "fallback") return "Fallback parser";
  return "Parser status unknown";
}

interface ResumeDrillSidebarProps {
  resume: ResumeResource | null;
  projects: ResumeProject[];
  isUploading: boolean;
  isStarted: boolean;
  canAdvanceProject: boolean;
  selectedProjectIndex: number;
  activeProjectIndex: number;
  drillPointCount: number;
  followUpsPerPoint: number;
  questionsPerProject: number;
  isResumePreviewOpen: boolean;
  onUpload: (file: File | null) => void;
  onDeleteResume: () => void;
  onPreviewResume: () => void;
  onDrillPointCountChange: (count: number) => void;
  onFollowUpsPerPointChange: (count: number) => void;
  onProjectSelect: (projectIndex: number) => void;
}

export default function ResumeDrillSidebar({
  resume,
  projects,
  isUploading,
  isStarted,
  canAdvanceProject,
  selectedProjectIndex,
  activeProjectIndex,
  drillPointCount,
  followUpsPerPoint,
  questionsPerProject,
  isResumePreviewOpen,
  onUpload,
  onDeleteResume,
  onPreviewResume,
  onDrillPointCountChange,
  onFollowUpsPerPointChange,
  onProjectSelect,
}: ResumeDrillSidebarProps) {
  return (
    <Box
      sx={{
        minWidth: 0,
        borderRight: { md: "1px solid" },
        borderColor: "neutral.200",
        p: 2,
        bgcolor: "#fbfbf7",
        overflow: "auto",
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Avatar size="sm" sx={{ bgcolor: "#111827", color: "#fff" }}>
            <GavelIcon fontSize="small" />
          </Avatar>
          <Box>
            <Typography level="title-md">Resume Drill</Typography>
            <Typography level="body-xs" sx={{ color: "neutral.500" }}>
              Project-by-project pressure test
            </Typography>
          </Box>
        </Stack>

        <Button
          component="label"
          variant="solid"
          color="neutral"
          startDecorator={<UploadFileIcon />}
          loading={isUploading}
        >
          {resume ? "Replace Resume" : "Upload Resume"}
          <input
            hidden
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              onUpload(file);
              event.target.value = "";
            }}
          />
        </Button>

        {resume && (
          <Card variant="outlined" sx={{ bgcolor: "background.surface", boxShadow: "xs" }}>
            <CardContent>
              <Stack direction="row" spacing={1} justifyContent="space-between">
                <Stack direction="row" spacing={1} sx={{ minWidth: 0 }}>
                  <DescriptionIcon sx={{ color: "neutral.500" }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography level="title-sm" noWrap>
                      {resume.filename}
                    </Typography>
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                      <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                        {resume.projects.length} projects parsed
                      </Typography>
                      <Chip
                        size="sm"
                        variant="soft"
                        color={resume.extraction_status === "fallback" ? "warning" : "success"}
                      >
                        {extractionStatusLabel(resume.extraction_status)}
                      </Chip>
                    </Stack>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                  <Tooltip title={isResumePreviewOpen ? "Hide parsed JSON" : "Preview parsed JSON"}>
                    <IconButton
                      size="sm"
                      color="neutral"
                      variant={isResumePreviewOpen ? "soft" : "plain"}
                      onClick={onPreviewResume}
                    >
                      <VisibilityIcon />
                    </IconButton>
                  </Tooltip>
                  <IconButton size="sm" color="danger" variant="plain" onClick={onDeleteResume}>
                    <DeleteIcon />
                  </IconButton>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        )}

        <Stack spacing={1}>
          <Box>
            <Typography level="body-sm" sx={{ fontWeight: 700 }}>
              Drill points per project
            </Typography>
            <Typography level="body-xs" sx={{ color: "neutral.500", lineHeight: 1.45 }}>
              Distinct project angles AI should cover.
            </Typography>
          </Box>
          <Select
            size="sm"
            value={drillPointCount}
            disabled={isStarted}
            onChange={(_, value) => value && onDrillPointCountChange(value as number)}
            sx={{ width: "100%" }}
          >
            {DRILL_POINT_OPTIONS.map((count) => (
              <Option key={count} value={count}>
                {count} points
              </Option>
            ))}
          </Select>
        </Stack>

        <Stack spacing={1}>
          <Box>
            <Typography level="body-sm" sx={{ fontWeight: 700 }}>
              Follow-up rounds per point
            </Typography>
            <Typography level="body-xs" sx={{ color: "neutral.500", lineHeight: 1.45 }}>
              Consecutive follow-ups before AI moves to another point.
            </Typography>
          </Box>
          <Select
            size="sm"
            value={followUpsPerPoint}
            disabled={isStarted}
            onChange={(_, value) => value && onFollowUpsPerPointChange(value as number)}
            sx={{ width: "100%" }}
          >
            {FOLLOW_UP_ROUND_OPTIONS.map((count) => (
              <Option key={count} value={count}>
                {count} {count === 1 ? "round" : "rounds"}
              </Option>
            ))}
          </Select>
          <Typography level="body-xs" sx={{ color: "neutral.500" }}>
            {questionsPerProject} total questions per project.
          </Typography>
        </Stack>

        <Divider />

        <Stack spacing={1}>
          {projects.map((project, index) => (
            <Button
              key={project.project_id}
              variant={index === selectedProjectIndex ? "soft" : "plain"}
              color={index === activeProjectIndex && isStarted ? "warning" : "neutral"}
              disabled={isStarted && !canAdvanceProject}
              onClick={() => onProjectSelect(index)}
              sx={{ justifyContent: "flex-start", textAlign: "left", minHeight: 54 }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography level="body-sm" noWrap sx={{ fontWeight: 700 }}>
                  {project.name}
                </Typography>
                <Typography level="body-xs" noWrap sx={{ color: "neutral.500" }}>
                  {project.tech_stack.slice(0, 4).join(", ") || project.role || "Resume project"}
                </Typography>
              </Box>
            </Button>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}
