import { useState } from "react";
import { register } from "../api/api";
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  FormLabel,
  Input,
  Button,
  Alert,
  Sheet,
} from "@mui/joy";

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
    <Sheet
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 2,
      }}
    >
      <Card
        variant="outlined"
        sx={{
          width: 400,
          boxShadow: "lg",
          borderRadius: "lg",
        }}
      >
        <CardContent sx={{ gap: 2 }}>
          <Box sx={{ textAlign: "center", mb: 3 }}>
            <Typography level="h2" component="h1">
              Create Account
            </Typography>
            <Typography level="body-sm" color="neutral">
              Join us today! Create your new account
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
            <Typography level="body-sm" color="neutral">
              Already have an account?{" "}
              <Button
                variant="plain"
                size="sm"
                onClick={onSwitchToLogin}
                sx={{ p: 0, fontWeight: "bold", textDecoration: "underline" }}
              >
                Sign in here
              </Button>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Sheet>
  );
}
