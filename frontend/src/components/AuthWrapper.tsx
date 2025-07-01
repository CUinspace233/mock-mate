import { useState } from "react";
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";
import SuccessPage from "./SuccessPage";
import { useAuthStore } from "../stores/useAuthStore";

type AuthMode = "login" | "register";

export default function AuthWrapper() {
  const { isLoggedIn, username, login, register, logout } = useAuthStore();
  const [authMode, setAuthMode] = useState<AuthMode>("login");

  const handleLoginSuccess = (username: string, user_id: number) => {
    login(username, user_id);
  };

  const handleRegisterSuccess = (username: string) => {
    register(username);
  };

  const handleLogout = () => {
    logout();
    setAuthMode("login");
  };

  const switchToRegister = () => {
    setAuthMode("register");
  };

  const switchToLogin = () => {
    setAuthMode("login");
  };

  if (isLoggedIn) {
    return <SuccessPage username={username} onLogout={handleLogout} />;
  }

  return authMode === "login" ? (
    <LoginPage onLoginSuccess={handleLoginSuccess} onSwitchToRegister={switchToRegister} />
  ) : (
    <RegisterPage onRegisterSuccess={handleRegisterSuccess} onSwitchToLogin={switchToLogin} />
  );
}
