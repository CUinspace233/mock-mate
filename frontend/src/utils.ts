import { Difficulty } from "./types/interview";

export const getDifficultyColor = (difficulty: Difficulty) => {
  return {
    [Difficulty.EASY]: "success",
    [Difficulty.MEDIUM]: "warning",
    [Difficulty.HARD]: "danger",
  }[difficulty];
};

// Format relative time for news
export const formatRelativeTime = (timestamp: string): string => {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;

  return time.toLocaleDateString("en-US");
};

// Check if browser supports notifications
export const isNotificationSupported = (): boolean => {
  return "Notification" in window;
};

// Get notification permission status
export const getNotificationPermission = (): NotificationPermission | null => {
  return isNotificationSupported() ? Notification.permission : null;
};
