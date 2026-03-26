import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 1314,
    fs: {
      // Repo root (for shared/interview_positions.json imports from src)
      allow: [".."],
    },
  },
});
