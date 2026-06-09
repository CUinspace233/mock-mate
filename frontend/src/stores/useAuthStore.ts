import { create } from "zustand";
import { persist } from "zustand/middleware";
import { encryptApiKey, decryptApiKey } from "../crypto";
import { CreativityLevel, Difficulty, type CodeQuestionMode } from "../types/interview";

type AuthState = {
  isLoggedIn: boolean;
  username: string;
  user_id?: number;
  dailyQuestionCount: number;
  dailyQuestionDate: string;
  selectedPosition: string;
  selectedDifficulty: Difficulty;
  sessionId: string | null;
  questionCountTarget: number;
  setQuestionCountTarget: (count: number) => void;
  followUpLimit: number;
  setFollowUpLimit: (limit: number) => void;
  language: string;
  setLanguage: (language: string) => void;
  openaiModel: string;
  setOpenaiModel: (model: string) => void;
  questionCreativity: CreativityLevel;
  setQuestionCreativity: (creativity: CreativityLevel) => void;
  codeQuestionMode: CodeQuestionMode;
  setCodeQuestionMode: (mode: CodeQuestionMode) => void;
  openaiApiKey: string; // stored encrypted
  setOpenaiApiKey: (apiKey: string) => void;
  getDecryptedApiKey: () => Promise<string>;
  setDailyQuestionCount: (count: number) => void;
  setDailyQuestionDate: (date: string) => void;
  incrementDailySessionCount: () => void;
  setSelectedPosition: (position: string) => void;
  setSelectedDifficulty: (difficulty: Difficulty) => void;
  setSessionId: (sessionId: string | null) => void;
  login: (username: string, user_id: number) => void;
  register: (username: string) => void;
  logout: () => void;
};

let encryptVersion = 0;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isLoggedIn: false,
      username: "",
      user_id: undefined,
      dailyQuestionCount: 0,
      dailyQuestionDate: "",
      selectedPosition: "frontend",
      selectedDifficulty: Difficulty.EASY,
      sessionId: null,
      questionCountTarget: 5,
      setQuestionCountTarget: (count) => set({ questionCountTarget: count }),
      followUpLimit: 2,
      setFollowUpLimit: (limit) => set({ followUpLimit: limit }),
      language: "en",
      setLanguage: (language) => set({ language }),
      openaiModel: "",
      setOpenaiModel: (model) => set({ openaiModel: model }),
      questionCreativity: CreativityLevel.BALANCED,
      setQuestionCreativity: (creativity) => set({ questionCreativity: creativity }),
      codeQuestionMode: "mixed",
      setCodeQuestionMode: (mode) => set({ codeQuestionMode: mode }),
      openaiApiKey: "",
      setOpenaiApiKey: (apiKey) => {
        const ver = ++encryptVersion;
        if (!apiKey) {
          set({ openaiApiKey: "" });
          return;
        }
        encryptApiKey(apiKey).then((encrypted) => {
          if (ver === encryptVersion) {
            set({ openaiApiKey: encrypted });
          }
        });
      },
      getDecryptedApiKey: () => decryptApiKey(get().openaiApiKey),
      setDailyQuestionCount: (count) => set({ dailyQuestionCount: count }),
      setDailyQuestionDate: (date) => set({ dailyQuestionDate: date }),
      incrementDailySessionCount: () => {
        const today = new Date().toISOString().slice(0, 10);
        const { dailyQuestionCount, dailyQuestionDate } = get();
        const baseCount = dailyQuestionDate === today ? dailyQuestionCount : 0;
        set({
          dailyQuestionCount: baseCount + 1,
          dailyQuestionDate: today,
        });
      },
      setSelectedPosition: (position) => set({ selectedPosition: position }),
      setSelectedDifficulty: (difficulty) => set({ selectedDifficulty: difficulty }),
      setSessionId: (sessionId) => set({ sessionId }),
      login: (username, user_id) => set({ isLoggedIn: true, username, user_id }),
      register: (username) => set({ isLoggedIn: true, username }),
      logout: () => set({ isLoggedIn: false, username: "", user_id: undefined, openaiApiKey: "" }),
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
        selectedDifficulty: state.selectedDifficulty,
        sessionId: state.sessionId,
        questionCountTarget: state.questionCountTarget,
        followUpLimit: state.followUpLimit,
        language: state.language,
        openaiModel: state.openaiModel,
        questionCreativity: state.questionCreativity,
        codeQuestionMode: state.codeQuestionMode,
        openaiApiKey: state.openaiApiKey,
      }),
    },
  ),
);
