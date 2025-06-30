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
