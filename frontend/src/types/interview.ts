export const PositionLabels = {
  frontend: "Frontend Engineer",
  backend: "Backend Engineer",
  fullstack: "Fullstack Engineer",
  mobile: "Mobile Developer",
  devops: "DevOps Engineer",
  ai: "AI Engineer",
  qa: "QA Engineer",
  product: "Product Manager",
  ui: "UI/UX Designer",
  data: "Data Analyst",
} as const;

export type PositionKey = keyof typeof PositionLabels;

export enum Difficulty {
  EASY = "easy",
  MEDIUM = "medium",
  HARD = "hard",
}

export enum SessionType {
  PRACTICE = "practice",
  MOCK_INTERVIEW = "mock_interview",
}

export interface Message {
  id: string;
  sender: "ai" | "user";
  content: string;
  timestamp: Date;
  score?: number;
  feedback?: string;
  strengths?: string[];
  improvements?: string[];
  keywordsCovered?: string[];
  keywordsMissed?: string[];
  evaluation_details?: EvaluationDetails;
}

export interface GenerateQuestionRequest {
  position: PositionKey;
  difficulty: Difficulty | null;
  topic: string | null;
  user_id: number;
}

export interface GenerateQuestionResponse {
  question_id: string;
  content: string;
  position: string;
  difficulty: string;
  topic: string | null;
  expected_keywords: string[];
  created_at: string;
}

export interface EvaluateAnswerRequest {
  question_id: string;
  user_id: number;
  answer: string;
  session_id?: string;
}

export interface EvaluationDetails {
  technical_accuracy: number;
  communication_clarity: number;
  completeness: number;
  practical_experience: number;
}

export interface EvaluateAnswerResponse {
  evaluation_id: string;
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  keywords_covered: string[];
  keywords_missed: string[];
  evaluation_details: EvaluationDetails;
  created_at: string;
}

export interface InterviewRecord {
  id: string | null;
  question_content: string;
  answer: string;
  score: number;
  feedback: string;
  position: PositionKey;
  session_id: string | null;
  question_id: string;
  user_id: number;
  evaluation_details: EvaluationDetails;
  created_at: string | null;
}

export interface InterviewRecordSaveResponse {
  record_id: string;
  message: string;
}

export interface GetInterviewRecordsResponse {
  records: InterviewRecord[];
  total_count: number;
  pagination: Record<string, unknown>;
}

export interface StartSessionRequest {
  user_id: number;
  position: PositionKey;
  session_type?: SessionType;
}

export interface StartSessionResponse {
  session_id: string;
  user_id: number;
  position: string;
  status: string;
  started_at: string;
}

export interface SessionDetailResponse {
  session_id: string;
  user_id: number;
  position: string;
  status: string;
  session_type: SessionType;
  started_at: string;
  completed_at: string | null;
  records_count: number;
}

export interface CompleteSessionRequest {
  user_id: number;
}

export interface SessionSummary {
  total_questions: number;
  average_score: number;
  total_duration: number;
  strengths: string[];
  areas_for_improvement: string[];
}

export interface CompleteSessionResponse {
  session_id: string;
  status: string;
  completed_at: string;
  summary: SessionSummary;
}
