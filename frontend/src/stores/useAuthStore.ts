import { create } from "zustand";
import { persist } from "zustand/middleware";

type AuthState = {
  isLoggedIn: boolean;
  username: string;
  user_id?: number;
  dailyQuestionCount: number;
  dailyQuestionDate: string;
  selectedPosition: string;
  sessionId: string | null;
  setDailyQuestionCount: (count: number) => void;
  setDailyQuestionDate: (date: string) => void;
  setSelectedPosition: (position: string) => void;
  setSessionId: (sessionId: string | null) => void;
  login: (username: string, user_id: number) => void;
  register: (username: string) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      username: "",
      user_id: undefined,
      dailyQuestionCount: 0,
      dailyQuestionDate: "",
      selectedPosition: "frontend",
      sessionId: null,
      setDailyQuestionCount: (count) => set({ dailyQuestionCount: count }),
      setDailyQuestionDate: (date) => set({ dailyQuestionDate: date }),
      setSelectedPosition: (position) => set({ selectedPosition: position }),
      setSessionId: (sessionId) => set({ sessionId }),
      login: (username, user_id) => set({ isLoggedIn: true, username, user_id }),
      register: (username) => set({ isLoggedIn: true, username }),
      logout: () => set({ isLoggedIn: false, username: "", user_id: undefined }),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        isLoggedIn: state.isLoggedIn,
        username: state.username,
        user_id: state.user_id,
        dailyQuestionCount: state.dailyQuestionCount,
        dailyQuestionDate: state.dailyQuestionDate,
        selectedPosition: state.selectedPosition,
        sessionId: state.sessionId,
      }),
    },
  ),
);
