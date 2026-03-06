import { create } from "zustand";
import { persist } from "zustand/middleware";
import { encryptApiKey, decryptApiKey } from "../crypto";

type AuthState = {
  isLoggedIn: boolean;
  username: string;
  user_id?: number;
  dailyQuestionCount: number;
  dailyQuestionDate: string;
  selectedPosition: string;
  sessionId: string | null;
  questionCountTarget: number;
  setQuestionCountTarget: (count: number) => void;
  followUpLimit: number;
  setFollowUpLimit: (limit: number) => void;
  language: string;
  setLanguage: (language: string) => void;
  openaiModel: string;
  setOpenaiModel: (model: string) => void;
  openaiApiKey: string; // stored encrypted
  setOpenaiApiKey: (apiKey: string) => void;
  getDecryptedApiKey: () => Promise<string>;
  setDailyQuestionCount: (count: number) => void;
  setDailyQuestionDate: (date: string) => void;
  setSelectedPosition: (position: string) => void;
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
      sessionId: null,
      questionCountTarget: 5,
      setQuestionCountTarget: (count) => set({ questionCountTarget: count }),
      followUpLimit: 2,
      setFollowUpLimit: (limit) => set({ followUpLimit: limit }),
      language: "en",
      setLanguage: (language) => set({ language }),
      openaiModel: "gpt-4.1-nano",
      setOpenaiModel: (model) => set({ openaiModel: model }),
      openaiApiKey: "",
      setOpenaiApiKey: (apiKey) => {
        const ver = ++encryptVersion;
        encryptApiKey(apiKey).then((encrypted) => {
          if (ver === encryptVersion) {
            set({ openaiApiKey: encrypted });
          }
        });
      },
      getDecryptedApiKey: () => decryptApiKey(get().openaiApiKey),
      setDailyQuestionCount: (count) => set({ dailyQuestionCount: count }),
      setDailyQuestionDate: (date) => set({ dailyQuestionDate: date }),
      setSelectedPosition: (position) => set({ selectedPosition: position }),
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
        sessionId: state.sessionId,
        questionCountTarget: state.questionCountTarget,
        followUpLimit: state.followUpLimit,
        language: state.language,
        openaiModel: state.openaiModel,
        openaiApiKey: state.openaiApiKey,
      }),
    },
  ),
);
