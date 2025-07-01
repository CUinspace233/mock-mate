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

export enum QuestionType {
  OPINION = "opinion",
  TECHNICAL = "technical",
  BEHAVIORAL = "behavioral",
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
  question_type: QuestionType;
  user_id: number;
}

export interface GenerateQuestionResponse {
  question_id: string;
  content: string;
  position: string;
  difficulty: string;
  question_type: QuestionType;
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

// News Question Push related types
export interface NewsQuestion {
  id: string;
  content: string;
  position: string;
  difficulty: string;
  source_title: string;
  source_url: string;
  published_at: string;
  relevance_score: number;
  question_type: QuestionType;
  ai_reasoning: string;
  created_at: string;
}

export interface TrendingQuestionResponse {
  questions: NewsQuestion[];
  total_count: number;
}

export interface UserPreferences {
  preferred_position: string;
  difficulty_level: string;
  daily_question_goal: number;
  notification_settings: {
    daily_reminder: boolean;
    progress_updates: boolean;
    achievement_alerts: boolean;
  };
}

export interface PushHistory {
  userId: string;
  pushes: Array<{
    questionId: string;
    pushedAt: string;
    status: "pending" | "answered" | "dismissed";
    answeredAt?: string;
  }>;
}

// Progress Analytics types
export interface ProgressData {
  date: string;
  score: number;
  question_count: number;
}

export interface PositionBreakdown {
  position: string;
  question_count: number;
  average_score: number;
}

export interface ProgressStatistics {
  total_questions: number;
  average_score: number;
  improvement_rate: number;
  best_score: number;
  worst_score: number;
  current_streak: number;
  total_practice_time: number;
}

export interface GetProgressResponse {
  progress_data: ProgressData[];
  statistics: ProgressStatistics;
  position_breakdown: PositionBreakdown[];
}

export type NewsCategory = "ai" | "web_dev" | "mobile" | "devops" | "general_tech";
