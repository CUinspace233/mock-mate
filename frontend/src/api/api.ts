import axios from "axios";
import type {
  GenerateQuestionRequest,
  GenerateQuestionResponse,
  EvaluateAnswerRequest,
  EvaluateAnswerResponse,
  InterviewRecord,
  InterviewRecordSaveResponse,
  StartSessionRequest,
  StartSessionResponse,
  SessionDetailResponse,
  GetInterviewRecordsResponse,
  CompleteSessionRequest,
  CompleteSessionResponse,
  TrendingQuestionResponse,
  UserPreferences,
  NewsCategory,
  GetProgressResponse,
} from "../types/interview";

export async function login(username: string, password: string) {
  const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/users/login`, {
    username,
    password,
  });
  return res.data;
}

export async function register(username: string, email: string, password: string) {
  const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/users/register`, {
    username,
    email,
    password,
  });
  return res.data;
}

export async function generateQuestion(
  request: GenerateQuestionRequest,
): Promise<GenerateQuestionResponse> {
  const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/questions/generate`, request);
  return res.data;
}

export async function generateQuestionStream(
  request: GenerateQuestionRequest,
  onDelta: (delta: string) => void,
): Promise<GenerateQuestionResponse> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/questions/generate/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(request),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final: GenerateQuestionResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const chunk of parts) {
      const lines = chunk.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event: "));
      const dataLine = lines.find((l) => l.startsWith("data: "));
      if (!dataLine) continue;

      const payload = JSON.parse(dataLine.slice(6));
      const evt = eventLine ? eventLine.slice(7) : "message";

      if (evt === "content" && payload.delta) onDelta(payload.delta);
      if (evt === "final") final = payload as GenerateQuestionResponse;
    }
  }

  if (!final) throw new Error("Stream ended without final payload");
  return final;
}

export async function evaluateAnswer(
  request: EvaluateAnswerRequest,
): Promise<EvaluateAnswerResponse> {
  const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/answers/evaluate`, request);
  return res.data;
}

export async function saveInterviewRecord(
  userId: number,
  recordData: InterviewRecord,
): Promise<InterviewRecordSaveResponse> {
  const res = await axios.post(
    `${import.meta.env.VITE_API_URL}/api/users/${userId}/interview-records`,
    recordData,
  );
  return res.data;
}

export async function getInterviewRecords(
  userId: number,
  params?: {
    position?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  },
): Promise<GetInterviewRecordsResponse> {
  // Build query string from params
  const searchParams = new URLSearchParams();
  if (params?.position) searchParams.append("position", params.position);
  if (params?.date_from) searchParams.append("date_from", params.date_from);
  if (params?.date_to) searchParams.append("date_to", params.date_to);
  if (params?.limit !== undefined) searchParams.append("limit", params.limit.toString());
  if (params?.offset !== undefined) searchParams.append("offset", params.offset.toString());

  const res = await axios.get(
    `${
      import.meta.env.VITE_API_URL
    }/api/users/${userId}/interview-records?${searchParams.toString()}`,
  );
  return res.data;
}

export async function startInterviewSession(
  request: StartSessionRequest,
): Promise<StartSessionResponse> {
  const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/sessions/start`, request);
  return res.data;
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetailResponse> {
  const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/sessions/${sessionId}`);
  return res.data;
}

export async function completeSession(
  sessionId: string,
  request: CompleteSessionRequest,
): Promise<CompleteSessionResponse> {
  const res = await axios.put(
    `${import.meta.env.VITE_API_URL}/api/sessions/${sessionId}/complete`,
    request,
  );
  return res.data;
}

export async function getTrendingQuestions(params?: {
  position?: string;
  category?: NewsCategory;
  limit?: number;
  days_back?: number;
}): Promise<TrendingQuestionResponse> {
  const searchParams = new URLSearchParams();
  if (params?.position) searchParams.append("position", params.position);
  if (params?.category) searchParams.append("category", params.category);
  if (params?.limit !== undefined) searchParams.append("limit", params.limit.toString());
  if (params?.days_back !== undefined)
    searchParams.append("days_back", params.days_back.toString());

  const res = await axios.get(
    `${import.meta.env.VITE_API_URL}/api/trending/trending-questions?${searchParams.toString()}`,
  );
  return res.data;
}

export async function getUserPreferences(userId: number): Promise<UserPreferences> {
  const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/users/${userId}/preferences`);
  return res.data;
}

export async function getUserProgress(
  userId: number,
  params?: {
    position?: string;
    time_range?: "7days" | "30days" | "90days";
  },
): Promise<GetProgressResponse> {
  const searchParams = new URLSearchParams();
  if (params?.position) searchParams.append("position", params.position);
  if (params?.time_range) searchParams.append("time_range", params.time_range);

  const res = await axios.get(
    `${import.meta.env.VITE_API_URL}/api/users/${userId}/progress?${searchParams.toString()}`,
  );
  return res.data;
}
