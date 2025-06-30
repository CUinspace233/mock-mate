import { useState, useEffect } from "react";
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";
import SuccessPage from "./SuccessPage";

type AuthMode = "login" | "register";

export default function AuthWrapper() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("login");

  useEffect(() => {
    const savedUsername = localStorage.getItem("username");
    if (savedUsername) {
      setIsLoggedIn(true);
      setUsername(savedUsername);
    }
  }, []);

  const handleLoginSuccess = (username: string, user_id: number) => {
    setIsLoggedIn(true);
    setUsername(username);
    localStorage.setItem("username", username);
    localStorage.setItem("user_id", user_id.toString());
  };

  const handleRegisterSuccess = (username: string) => {
    setIsLoggedIn(true);
    setUsername(username);
    localStorage.setItem("username", username);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername("");
    setAuthMode("login");
    localStorage.removeItem("username");
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
    <LoginPage
      onLoginSuccess={(username: string, user_id: number) => handleLoginSuccess(username, user_id)}
      onSwitchToRegister={switchToRegister}
    />
  ) : (
    <RegisterPage onRegisterSuccess={handleRegisterSuccess} onSwitchToLogin={switchToLogin} />
  );
}
