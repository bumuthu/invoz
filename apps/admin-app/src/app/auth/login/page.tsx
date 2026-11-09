"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", px: 3, py: 6 }}>
      <Card sx={{ width: "100%", maxWidth: 420 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Logo height={36} />
          <Typography variant="h4" component="h1" sx={{ mt: 3 }}>
            Platform admin
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
            Sign in with the super admin account.
          </Typography>
          <Stack
            spacing={2}
            component="form"
            onSubmit={async (event) => {
              event.preventDefault();
              setPending(true);
              setMessage("");
              const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email, password }),
              });
              const body = (await response.json().catch(() => null)) as { error?: string } | null;
              if (!response.ok) {
                setPending(false);
                setMessage(body?.error ?? "Invalid login credentials.");
                return;
              }
              window.location.assign("/");
            }}
          >
            {message ? <Alert severity="error">{message}</Alert> : null}
            <TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" />
            <TextField label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
            <Button type="submit" variant="contained" disabled={pending}>
              {pending ? "Signing in" : "Sign in"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
