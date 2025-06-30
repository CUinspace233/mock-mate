import { useState } from "react";
import { login } from "../api/api";
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
  Divider,
} from "@mui/joy";

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

  // Handle trial account login
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
              Welcome Back
            </Typography>
            <Typography level="body-sm" color="neutral">
              Please log in to your account
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
            variant="outlined"
            fullWidth
            size="lg"
            loading={demoLoading}
            onClick={handleDemoLogin}
            sx={{ mb: 2 }}
          >
            Try with Demo Account
          </Button>

          <Typography level="body-xs" color="neutral" sx={{ textAlign: "center", mb: 2 }}>
            Quick access with demo_account credentials
          </Typography>

          <Box sx={{ textAlign: "center" }}>
            <Typography level="body-sm" color="neutral">
              Don't have an account?{" "}
              <Button
                variant="plain"
                size="sm"
                onClick={onSwitchToRegister}
                sx={{ p: 0, fontWeight: "bold" }}
              >
                Sign up here
              </Button>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Sheet>
  );
}
