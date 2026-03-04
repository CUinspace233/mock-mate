import { useState } from "react";
import { register } from "../api/api";
import {
  Box,
  Typography,
  FormControl,
  FormLabel,
  Input,
  Button,
  Alert,
} from "@mui/joy";
import AuthLayout from "./AuthLayout";

interface RegisterPageProps {
  onRegisterSuccess: (username: string) => void;
  onSwitchToLogin: () => void;
}

export default function RegisterPage({ onRegisterSuccess, onSwitchToLogin }: RegisterPageProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!email) {
      setError("Email is required");
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      setLoading(false);
      return;
    }

    try {
      const data = await register(username, email, password);

      if (data && data.username) {
        setSuccess("Account created successfully! You can now log in.");
        setTimeout(() => {
          onRegisterSuccess(username);
        }, 1500);
      } else {
        setError(data?.detail || "Registration failed");
      }
    } catch (error: unknown) {
      console.error(error);
      setError("Registration failed. Please try again.");
    } finally {
      setLoading(false);
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
        {/* Brand header — only visible on mobile */}
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
            Create your account
          </Typography>
          <Typography level="body-sm" sx={{ color: "neutral.500", mt: 0.5 }}>
            Start practicing for your next interview
          </Typography>
        </Box>

        {error && (
          <Alert color="danger" variant="soft" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert color="success" variant="soft" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <FormControl sx={{ mb: 2 }}>
            <FormLabel>Username</FormLabel>
            <Input
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              size="lg"
            />
          </FormControl>

          <FormControl sx={{ mb: 2 }}>
            <FormLabel>Email</FormLabel>
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              size="lg"
            />
          </FormControl>

          <FormControl sx={{ mb: 2 }}>
            <FormLabel>Password</FormLabel>
            <Input
              type="password"
              placeholder="Create a password (min. 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              size="lg"
            />
          </FormControl>

          <FormControl sx={{ mb: 3 }}>
            <FormLabel>Confirm Password</FormLabel>
            <Input
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              size="lg"
            />
          </FormControl>

          <Button type="submit" fullWidth size="lg" loading={loading} sx={{ mb: 2 }}>
            Create Account
          </Button>
        </form>

        <Box sx={{ textAlign: "center" }}>
          <Typography level="body-sm" sx={{ color: "neutral.500" }}>
            Already have an account?{" "}
            <Button
              variant="plain"
              size="sm"
              onClick={onSwitchToLogin}
              sx={{ p: 1, fontWeight: "bold" }}
            >
              Log in here
            </Button>
          </Typography>
        </Box>
      </Box>
    </AuthLayout>
  );
}
