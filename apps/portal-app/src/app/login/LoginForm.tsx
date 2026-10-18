"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";

export default function LoginForm({ host, email }: { host: string; email: string }) {
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
          <Stack spacing={2} component="form">
            <TextField label="Email" type="email" fullWidth defaultValue={email} />
            <TextField label="Password" type="password" fullWidth />
            <Button component={NextLink} href="/" variant="contained" size="large" sx={{ mt: 0.5 }}>
              Continue
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            Accounts are created by the organization owner.{" "}
            <Link href="/" component={NextLink} underline="hover">
              Back to the portal
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
