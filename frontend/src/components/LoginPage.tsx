import { useState } from "react";
import { login } from "../api/api";
import {
  Box,
  Typography,
  FormControl,
  FormLabel,
  Input,
  Button,
  Alert,
  Divider,
} from "@mui/joy";
import AuthLayout from "./AuthLayout";

interface LoginPageProps {
  onLoginSuccess: (username: string, user_id: number) => void;
  onSwitchToRegister: () => void;
}

export default function LoginPage({ onLoginSuccess, onSwitchToRegister }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await login(username, password);

      if (data && data.user) {
        onLoginSuccess(username, data.user.id);
      } else {
        setError("Wrong username or password");
      }
    } catch (error) {
      console.error(error);
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    setError("");

    try {
      const data = await login("demo_account", "demo_account");

      if (data && data.user) {
        onLoginSuccess("demo_account", 1);
      } else {
        setError("Demo account login failed");
      }
    } catch (error) {
      console.error(error);
      setError("Demo account login failed. Please try again.");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <AuthLayout>
      <Box
        sx={{
          width: { xs: "100%", sm: 380 },
          maxWidth: 380,
          animation: "scaleIn 0.5s ease-out",
        }}
      >
        {/* Brand header — only visible on mobile (left panel hidden) */}
        <Box sx={{ display: { xs: "block", md: "none" }, textAlign: "center", mb: 4 }}>
          <Typography
            level="h2"
            component="h1"
            sx={{
              fontSize: "2rem",
              fontWeight: 700,
              background: "linear-gradient(135deg, #2563eb, #172554)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            MockMate
          </Typography>
          <Typography level="body-sm" sx={{ color: "neutral.500" }}>
            Your AI Interview Coach
          </Typography>
        </Box>

        {/* Desktop heading */}
        <Box sx={{ display: { xs: "none", md: "block" }, mb: 4 }}>
          <Typography level="h3" sx={{ fontWeight: 700, color: "neutral.800" }}>
            Welcome back
          </Typography>
          <Typography level="body-sm" sx={{ color: "neutral.500", mt: 0.5 }}>
            Sign in to continue your practice
          </Typography>
        </Box>

        {error && (
          <Alert color="danger" variant="soft" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <FormControl sx={{ mb: 2 }}>
            <FormLabel>Username</FormLabel>
            <Input
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              size="lg"
            />
          </FormControl>

          <FormControl sx={{ mb: 3 }}>
            <FormLabel>Password</FormLabel>
            <Input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              size="lg"
            />
          </FormControl>

          <Button type="submit" fullWidth size="lg" loading={loading} sx={{ mb: 2 }}>
            Log In
          </Button>
        </form>

        <Divider sx={{ my: 2 }}>or</Divider>

        <Button
          variant="soft"
          fullWidth
          size="lg"
          loading={demoLoading}
          onClick={handleDemoLogin}
          sx={{ mb: 2 }}
        >
          Try with Demo Account
        </Button>

        <Box sx={{ textAlign: "center" }}>
          <Typography level="body-sm" sx={{ color: "neutral.500" }}>
            Don't have an account?{" "}
            <Button
              variant="plain"
              size="sm"
              onClick={onSwitchToRegister}
              sx={{ p: 1, fontWeight: "bold" }}
            >
              Sign up here
            </Button>
          </Typography>
        </Box>
      </Box>
    </AuthLayout>
  );
}
