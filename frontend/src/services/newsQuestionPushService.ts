import { getTrendingQuestions, getUserPreferences } from "../api/api";
import type { NewsQuestion, UserPreferences, PushHistory } from "../types/interview";
import { useNewsQuestionPushStore } from "../stores/useNewsQuestionPushStore";
import { useAuthStore } from "../stores/useAuthStore";

export class NewsQuestionPushService {
  private static readonly PUSH_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private static readonly REMINDER_INTERVAL = 60 * 60 * 1000; // 1 hour for reminders

  private pushTimer: ReturnType<typeof setInterval> | null = null;
  private reminderTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private userId: number;
  private onPushCallback?: (question: NewsQuestion) => void;
  private onReminderCallback?: (question: NewsQuestion) => void;

  constructor(userId: number) {
    this.userId = userId;
  }

  // Set callbacks for handling push notifications
  setCallbacks(
    onPush: (question: NewsQuestion) => void,
    onReminder?: (question: NewsQuestion) => void,
  ) {
    this.onPushCallback = onPush;
    this.onReminderCallback = onReminder;
  }

  // Start the push service
  async startPushService(): Promise<void> {
    try {
      // Request notification permission
      await this.requestNotificationPermission();

      // Start immediate push if no recent pushes
      const initialPreferences = await getUserPreferences(this.userId);
      if (this.shouldPushImmediate()) {
        await this.pushNewsQuestion(initialPreferences);
      }

      // Set up periodic pushing
      this.pushTimer = setInterval(async () => {
        try {
          const preferences = await getUserPreferences(this.userId);
          await this.pushNewsQuestion(preferences);
        } catch (error) {
          console.error("Failed to fetch preferences or push news question:", error);
        }
      }, NewsQuestionPushService.PUSH_INTERVAL);

      console.log("News question push service started");
    } catch (error) {
      console.error("Failed to start push service:", error);
    }
  }

  // Stop the push service
  stopPushService(): void {
    if (this.pushTimer) {
      clearInterval(this.pushTimer);
      this.pushTimer = null;
    }

    // Clear all reminder timers
    this.reminderTimers.forEach((timer) => clearTimeout(timer));
    this.reminderTimers.clear();

    console.log("News question push service stopped");
  }

  // Main push logic
  private async pushNewsQuestion(preferences: UserPreferences): Promise<void> {
    try {
      // Check if user is currently in interview (skip pushing during active sessions)
      if (this.isUserInInterview()) {
        console.log("User is in interview, skipping push");
        return;
      }

      // Fetch trending questions
      const response = await getTrendingQuestions({
        position: preferences.preferred_position,
        limit: 1,
        days_back: 7,
      });

      if (response.questions.length === 0) {
        console.log("No trending questions available");
        return;
      }

      const question = response.questions[0];
      if (!question) {
        console.log("No trending questions available");
        return;
      }

      // Check if we've already pushed this question recently
      if (this.isQuestionRecentlyPushed(question.id)) {
        console.log("Question already pushed recently, skipping");
        return;
      }

      // Show push notification
      this.showPushNotification(question);

      // Save push history using Zustand store
      this.savePushHistory(question.id, "pending");

      // Call the callback to show in-app notification
      if (this.onPushCallback) {
        this.onPushCallback(question);
      }
    } catch (error) {
      console.error("Failed to push news question:", error);
    }
  }

  // Request browser notification permission
  private async requestNotificationPermission(): Promise<void> {
    if ("Notification" in window) {
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
    }
  }

  // Show browser notification
  private showPushNotification(question: NewsQuestion): void {
    if ("Notification" in window && Notification.permission === "granted") {
      const notification = new Notification("Today's Interview Challenge", {
        body: `Based on the latest news: ${question.source_title.substring(0, 50)}...`,
        icon: "/icon-192x192.png",
        tag: "news-question",
        requireInteraction: true,
        data: { questionId: question.id },
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto close after 10 seconds
      setTimeout(() => notification.close(), 10000);
    }
  }

  // Check if user is currently in an interview session
  private isUserInInterview(): boolean {
    const sessionId = useAuthStore.getState().sessionId;
    return Boolean(sessionId);
  }

  // Check if should push immediately (first time or 24 hours since last push)
  private shouldPushImmediate(): boolean {
    const lastPushTime = useNewsQuestionPushStore.getState().getLastPushTime(this.userId);
    if (!lastPushTime) return true;

    const timeSinceLastPush = Date.now() - lastPushTime;
    return timeSinceLastPush >= NewsQuestionPushService.PUSH_INTERVAL;
  }

  // Check if a question was recently pushed
  private isQuestionRecentlyPushed(questionId: string): boolean {
    const history = this.getPushHistory();
    const recentThreshold = Date.now() - 24 * 60 * 60 * 1000; // 24 hours

    return history.pushes.some(
      (push) =>
        push.questionId === questionId && new Date(push.pushedAt).getTime() > recentThreshold,
    );
  }

  // Save push history using Zustand store
  private savePushHistory(questionId: string, status: "pending" | "answered" | "dismissed"): void {
    useNewsQuestionPushStore.getState().savePushHistory(this.userId, questionId, status);
  }

  // Get push history using Zustand store
  private getPushHistory(): PushHistory {
    return useNewsQuestionPushStore.getState().getPushHistory(this.userId);
  }

  // Update push status (when user answers or dismisses)
  updatePushStatus(questionId: string, status: "answered" | "dismissed"): void {
    useNewsQuestionPushStore.getState().updatePushStatus(this.userId, questionId, status);
  }

  // Set reminder for a dismissed question
  setReminder(question: NewsQuestion): void {
    const timerId = setTimeout(() => {
      if (this.onReminderCallback) {
        this.onReminderCallback(question);
      }
      this.reminderTimers.delete(question.id);
    }, NewsQuestionPushService.REMINDER_INTERVAL);

    this.reminderTimers.set(question.id, timerId);
    console.log(`Reminder set for question ${question.id} in 1 hour`);
  }

  // Clear a specific reminder
  clearReminder(questionId: string): void {
    const timer = this.reminderTimers.get(questionId);
    if (timer) {
      clearTimeout(timer);
      this.reminderTimers.delete(questionId);
    }
  }

  // Get push statistics for analytics
  getPushStatistics(): {
    totalPushes: number;
    answeredCount: number;
    dismissedCount: number;
    pendingCount: number;
  } {
    const history = this.getPushHistory();

    return {
      totalPushes: history.pushes.length,
      answeredCount: history.pushes.filter((p) => p.status === "answered").length,
      dismissedCount: history.pushes.filter((p) => p.status === "dismissed").length,
      pendingCount: history.pushes.filter((p) => p.status === "pending").length,
    };
  }
}
