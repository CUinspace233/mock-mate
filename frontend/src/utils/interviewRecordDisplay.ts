import type { InterviewRecord } from "../types/interview";

export const RECORD_SECTION_SEPARATOR = "\n---\n";
const PROJECT_SECTION_PREFIX = "Project:";

export function formatRecordProjectSection(projectName: string): string {
  return `${PROJECT_SECTION_PREFIX} ${projectName}`;
}

export function splitRecordSections(value: string): string[] {
  return value
    .split(RECORD_SECTION_SEPARATOR)
    .map((section) => section.trim())
    .filter(Boolean);
}

function extractProjectName(projectSection: string): string | null {
  const projectText = projectSection.slice(PROJECT_SECTION_PREFIX.length).trim();
  const firstLine = projectText.split(/\r?\n/)[0]?.trim() || "";
  const nameOnly = firstLine.split(/\s+(?:Role|Tech):/)[0]?.trim() || firstLine;
  return nameOnly || null;
}

function extractLegacyQuestion(projectSection: string): string | null {
  const [, questionText] = projectSection.split(/\n\s*\n/, 2);
  return questionText?.trim() || null;
}

export function parseInterviewRecordDisplay(record: InterviewRecord) {
  const rawQuestionSections = splitRecordSections(record.question_content);
  const projectSection = rawQuestionSections.find((section) =>
    section.startsWith(PROJECT_SECTION_PREFIX),
  );
  const projectName = projectSection ? extractProjectName(projectSection) : null;
  const nonProjectQuestionSections = rawQuestionSections.filter(
    (section) => !section.startsWith(PROJECT_SECTION_PREFIX),
  );
  const legacyQuestion = projectSection ? extractLegacyQuestion(projectSection) : null;
  const questionSections =
    nonProjectQuestionSections.length > 0
      ? nonProjectQuestionSections
      : legacyQuestion
        ? [legacyQuestion]
        : rawQuestionSections;
  const answerSections = splitRecordSections(record.answer);

  return {
    projectName,
    questionSections,
    answerSections,
    questionPreview: questionSections[0] || record.question_content,
  };
}
