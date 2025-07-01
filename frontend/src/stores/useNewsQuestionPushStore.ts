import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PushHistory } from "../types/interview";

type NewsQuestionPushState = {
  // Push history by user ID
  pushHistories: Record<string, PushHistory>;
  // Last push time by user ID
  lastPushTimes: Record<string, number>;

  // Actions
  getPushHistory: (userId: number) => PushHistory;
  savePushHistory: (
    userId: number,
    questionId: string,
    status: "pending" | "answered" | "dismissed",
  ) => void;
  updatePushStatus: (userId: number, questionId: string, status: "answered" | "dismissed") => void;
  getLastPushTime: (userId: number) => number | null;
  setLastPushTime: (userId: number, time: number) => void;
};

export const useNewsQuestionPushStore = create<NewsQuestionPushState>()(
  persist(
    (set, get) => ({
      pushHistories: {},
      lastPushTimes: {},

      getPushHistory: (userId: number) => {
        const state = get();
        const userKey = userId.toString();
        return (
          state.pushHistories[userKey] || {
            userId: userKey,
            pushes: [],
          }
        );
      },

      savePushHistory: (
        userId: number,
        questionId: string,
        status: "pending" | "answered" | "dismissed",
      ) => {
        set((state) => {
          const userKey = userId.toString();
          const currentHistory = state.pushHistories[userKey] || {
            userId: userKey,
            pushes: [],
          };

          const newPush = {
            questionId,
            pushedAt: new Date().toISOString(),
            status,
          };

          const updatedPushes = [...currentHistory.pushes, newPush];

          // Keep only last 50 pushes
          if (updatedPushes.length > 50) {
            updatedPushes.splice(0, updatedPushes.length - 50);
          }

          return {
            ...state,
            pushHistories: {
              ...state.pushHistories,
              [userKey]: {
                ...currentHistory,
                pushes: updatedPushes,
              },
            },
            lastPushTimes: {
              ...state.lastPushTimes,
              [userKey]: Date.now(),
            },
          };
        });
      },

      updatePushStatus: (userId: number, questionId: string, status: "answered" | "dismissed") => {
        set((state) => {
          const userKey = userId.toString();
          const currentHistory = state.pushHistories[userKey];

          if (!currentHistory) return state;

          const pushIndex = currentHistory.pushes.findIndex(
            (push) => push.questionId === questionId,
          );

          if (pushIndex === -1) return state;

          const updatedPushes = [...currentHistory.pushes];
          updatedPushes[pushIndex] = {
            ...updatedPushes[pushIndex]!,
            status,
            ...(status === "answered" && { answeredAt: new Date().toISOString() }),
          };

          return {
            ...state,
            pushHistories: {
              ...state.pushHistories,
              [userKey]: {
                ...currentHistory,
                pushes: updatedPushes,
              },
            },
          };
        });
      },

      getLastPushTime: (userId: number) => {
        const state = get();
        const userKey = userId.toString();
        return state.lastPushTimes[userKey] || null;
      },

      setLastPushTime: (userId: number, time: number) => {
        set((state) => ({
          ...state,
          lastPushTimes: {
            ...state.lastPushTimes,
            [userId.toString()]: time,
          },
        }));
      },
    }),
    {
      name: "news-question-push-storage",
      partialize: (state) => ({
        pushHistories: state.pushHistories,
        lastPushTimes: state.lastPushTimes,
      }),
    },
  ),
);
