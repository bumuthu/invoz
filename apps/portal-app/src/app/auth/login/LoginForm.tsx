"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase-browser";

export default function LoginForm({ host, error }: { host: string; error?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        px: 3,
        py: 6,
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 420 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4.5 } }}>
          <Typography
            sx={{
              color: "primary.main",
              fontWeight: 700,
              fontSize: 22,
              letterSpacing: "-0.05em",
            }}
          >
            Portal
          </Typography>
          <Typography variant="h4" component="h1" sx={{ mt: 4 }}>
            Sign in
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1, mb: 3.5 }}>
            {host}
          </Typography>
          <Stack
            spacing={2}
            component="form"
            onSubmit={async (event) => {
              event.preventDefault();
              setPending(true);
              setMessage("");
              const result = await browserSupabase().auth.signInWithPassword({ email, password });
              setPending(false);
              if (result.error) {
                setMessage(result.error.message);
                return;
              }
              router.push("/");
              router.refresh();
            }}
          >
            {error === "membership" ? (
              <Typography color="error" variant="body2">
                This account is not a member of the organization for this address.
              </Typography>
            ) : null}
            {message ? (
              <Typography color="error" variant="body2">
                {message}
              </Typography>
            ) : null}
            <TextField
              label="Email"
              type="email"
              fullWidth
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
            <Button type="submit" variant="contained" size="large" disabled={pending} sx={{ mt: 0.5 }}>
              {pending ? "Signing in" : "Continue"}
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            Accounts are created by the organization owner.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
