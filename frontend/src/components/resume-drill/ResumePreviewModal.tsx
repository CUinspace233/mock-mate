import type { ReactNode } from "react";
import { Box, Chip, Modal, ModalClose, ModalDialog, Stack, Typography } from "@mui/joy";
import type { ResumeResource } from "../../types/interview";

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        level="body-xs"
        sx={{
          color: "neutral.500",
          fontFamily: "monospace",
          fontWeight: 700,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Typography>
      <Box sx={{ mt: 0.5, minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

function ResumePreviewPanel({ resume }: { resume: ResumeResource }) {
  return (
    <Stack spacing={2} sx={{ minHeight: 0 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.4fr 0.8fr 0.8fr" },
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            border: "1px solid",
            borderColor: "neutral.200",
            borderRadius: "sm",
            p: 1.5,
            minWidth: 0,
          }}
        >
          <FieldBlock label="filename">
            <Typography level="title-sm" sx={{ overflowWrap: "anywhere" }}>
              {resume.filename}
            </Typography>
          </FieldBlock>
        </Box>
        <Box
          sx={{
            border: "1px solid",
            borderColor: "neutral.200",
            borderRadius: "sm",
            p: 1.5,
          }}
        >
          <FieldBlock label="projects">
            <Typography level="title-sm">{resume.projects.length}</Typography>
          </FieldBlock>
        </Box>
        <Box
          sx={{
            border: "1px solid",
            borderColor: "neutral.200",
            borderRadius: "sm",
            p: 1.5,
          }}
        >
          <FieldBlock label="resume_id">
            <Typography level="body-sm" sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}>
              {resume.id}
            </Typography>
          </FieldBlock>
        </Box>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.2fr) minmax(320px, 0.8fr)" },
          gap: 2,
          minHeight: 0,
        }}
      >
        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <Typography level="title-sm">projects</Typography>
          {resume.projects.map((project, index) => (
            <Box
              key={project.project_id}
              sx={{
                border: "1px solid",
                borderColor: "neutral.200",
                borderRadius: "sm",
                p: 1.5,
                bgcolor: "background.surface",
                minWidth: 0,
              }}
            >
              <Stack spacing={1.25}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                  <Chip size="sm" variant="soft" color="neutral">
                    {index}
                  </Chip>
                  <Typography level="title-sm" sx={{ overflowWrap: "anywhere" }}>
                    {project.name}
                  </Typography>
                </Stack>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "minmax(0, 0.8fr) minmax(0, 1.2fr)" },
                    gap: 1.25,
                  }}
                >
                  <FieldBlock label="project_id">
                    <Typography
                      level="body-sm"
                      sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}
                    >
                      {project.project_id}
                    </Typography>
                  </FieldBlock>
                  <FieldBlock label="role">
                    <Typography level="body-sm" sx={{ overflowWrap: "anywhere" }}>
                      {project.role || "-"}
                    </Typography>
                  </FieldBlock>
                </Box>

                <FieldBlock label="summary">
                  <Typography level="body-sm" sx={{ lineHeight: 1.55, overflowWrap: "anywhere" }}>
                    {project.summary || "-"}
                  </Typography>
                </FieldBlock>

                <FieldBlock label="tech_stack">
                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                    {project.tech_stack.length ? (
                      project.tech_stack.map((tech) => (
                        <Chip key={tech} size="sm" variant="soft" color="primary">
                          {tech}
                        </Chip>
                      ))
                    ) : (
                      <Typography level="body-sm">[]</Typography>
                    )}
                  </Stack>
                </FieldBlock>

                <FieldBlock label="evidence">
                  <Stack spacing={0.75}>
                    {project.evidence.length ? (
                      project.evidence.map((evidence, evidenceIndex) => (
                        <Box
                          key={`${project.project_id}-${evidenceIndex}`}
                          sx={{
                            borderLeft: "3px solid",
                            borderColor: "neutral.300",
                            pl: 1,
                            color: "neutral.700",
                          }}
                        >
                          <Typography
                            level="body-sm"
                            sx={{ lineHeight: 1.5, overflowWrap: "anywhere" }}
                          >
                            {evidence}
                          </Typography>
                        </Box>
                      ))
                    ) : (
                      <Typography level="body-sm">[]</Typography>
                    )}
                  </Stack>
                </FieldBlock>
              </Stack>
            </Box>
          ))}
        </Stack>

        <Box sx={{ minWidth: 0 }}>
          <Typography level="title-sm" sx={{ mb: 1 }}>
            content_text
          </Typography>
          <Box
            component="pre"
            sx={{
              m: 0,
              maxHeight: { xs: 320, lg: "calc(78vh - 190px)" },
              overflow: "auto",
              border: "1px solid",
              borderColor: "neutral.200",
              borderRadius: "sm",
              bgcolor: "neutral.50",
              color: "neutral.800",
              p: 1.5,
              fontFamily: "monospace",
              fontSize: 12,
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            {resume.content_text}
          </Box>
        </Box>
      </Box>
    </Stack>
  );
}

interface ResumePreviewModalProps {
  open: boolean;
  resume: ResumeResource | null;
  onClose: () => void;
}

export default function ResumePreviewModal({ open, resume, onClose }: ResumePreviewModalProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        variant="outlined"
        sx={{
          width: { xs: "calc(100vw - 24px)", md: "min(1120px, calc(100vw - 64px))" },
          maxHeight: { xs: "calc(100dvh - 24px)", md: "calc(100dvh - 64px)" },
          p: 0,
          overflow: "hidden",
        }}
      >
        <ModalClose />
        {resume && (
          <Stack sx={{ maxHeight: "inherit", minHeight: 0 }}>
            <Box
              sx={{
                p: 2,
                pr: 6,
                borderBottom: "1px solid",
                borderColor: "neutral.200",
                bgcolor: "background.surface",
              }}
            >
              <Typography level="title-md">Resume JSON Preview</Typography>
              <Typography level="body-sm" sx={{ color: "neutral.500", overflowWrap: "anywhere" }}>
                {resume.filename}
              </Typography>
            </Box>
            <Box sx={{ p: 2, overflow: "auto", minHeight: 0 }}>
              <ResumePreviewPanel resume={resume} />
            </Box>
          </Stack>
        )}
      </ModalDialog>
    </Modal>
  );
}
