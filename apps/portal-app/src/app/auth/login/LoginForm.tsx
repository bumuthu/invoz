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
import { isOrganizationSlug } from "@invoz/common";
import Logo from "@/components/Logo";
import { clearOrganization, openOrganization } from "@/lib/portal-entry";
import { browserSupabase } from "@/lib/supabase-browser";

export default function LoginForm({
  hostLabel,
  organizationSlug,
  lockOrganization,
  signedInEmail,
  error,
}: {
  hostLabel: string;
  organizationSlug: string;
  lockOrganization: boolean;
  signedInEmail: string;
  error?: string;
}) {
  const router = useRouter();
  const [organization, setOrganization] = useState(organizationSlug);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [useAnotherAccount, setUseAnotherAccount] = useState(false);
  const alreadySignedIn = Boolean(signedInEmail) && !useAnotherAccount;

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
          <Logo height={40} />
          <Typography variant="h4" component="h1" sx={{ mt: 4 }}>
            Sign in
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1, mb: 3.5 }}>
            {lockOrganization ? hostLabel : "Start with your organization slug."}
          </Typography>
          <Stack
            spacing={2}
            component="form"
            onSubmit={async (event) => {
              event.preventDefault();
              setPending(true);
              setMessage("");
              const slug = (lockOrganization ? organizationSlug : organization).trim().toLowerCase();
              if (!isOrganizationSlug(slug)) {
                setPending(false);
                setMessage("Enter the organization slug, such as acme.");
                return;
              }
              if (!alreadySignedIn) {
                const result = await browserSupabase().auth.signInWithPassword({ email, password });
                if (result.error) {
                  setPending(false);
                  setMessage(result.error.message);
                  return;
                }
              }
              const opened = await openOrganization(slug);
              if (!opened.ok) {
                setPending(false);
                setMessage(opened.error);
                return;
              }
              if (opened.href.startsWith("http")) {
                window.location.assign(opened.href);
                return;
              }
              router.push(opened.href);
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
            {lockOrganization ? null : (
              <TextField
                label="Organization"
                fullWidth
                required
                autoFocus
                value={organization}
                onChange={(event) => setOrganization(event.target.value)}
                autoComplete="organization"
                helperText="The slug in your organization address."
              />
            )}
            {alreadySignedIn ? (
              <Typography variant="body2">Signed in as {signedInEmail}</Typography>
            ) : (
              <>
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
              </>
            )}
            <Button type="submit" variant="contained" size="large" disabled={pending} sx={{ mt: 0.5 }}>
              {pending ? "Signing in" : "Continue"}
            </Button>
          </Stack>
          {alreadySignedIn ? (
            <Button
              variant="text"
              sx={{ mt: 2, px: 0 }}
              onClick={async () => {
                await clearOrganization();
                await browserSupabase().auth.signOut();
                setUseAnotherAccount(true);
                router.refresh();
              }}
            >
              Use a different account
            </Button>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
              Accounts are created by the organization owner.
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
