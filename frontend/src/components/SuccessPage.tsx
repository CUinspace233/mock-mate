import InterviewTraining from "./InterviewTraining";

interface SuccessPageProps {
  username: string;
  onLogout: () => void;
}

export default function SuccessPage({ username, onLogout }: SuccessPageProps) {
  return <InterviewTraining username={username} onLogout={onLogout} />;
}
