import { Difficulty } from "./types/interview";

export const getDifficultyColor = (difficulty: Difficulty) => {
  return {
    [Difficulty.EASY]: "success",
    [Difficulty.MEDIUM]: "warning",
    [Difficulty.HARD]: "danger",
  }[difficulty];
};