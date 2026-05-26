import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";
import SuccessPage from "./SuccessPage";
import { useAuthStore } from "../stores/useAuthStore";

type AuthMode = "login" | "register";

const APP_ROUTES = new Set(["/chat", "/resume-drill", "/history", "/progress"]);

function loginRedirectPath(pathname: string): string {
  return APP_ROUTES.has(pathname) ? pathname : "/chat";
}

export default function AuthWrapper() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, username, login, register, logout } = useAuthStore();
  const [authMode, setAuthMode] = useState<AuthMode>("login");

  const handleLoginSuccess = (username: string, user_id: number) => {
    login(username, user_id);
    navigate(loginRedirectPath(location.pathname), { replace: true });
  };

  const handleRegisterSuccess = (username: string) => {
    register(username);
    navigate(loginRedirectPath(location.pathname), { replace: true });
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
