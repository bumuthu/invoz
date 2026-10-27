import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Logo from "@/components/Logo";

export default function AppLoading() {
  return (
    <Box
      role="status"
      aria-live="polite"
      aria-label="Loading Invoz"
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        bgcolor: "background.default",
      }}
    >
      <Stack spacing={2.5} sx={{ alignItems: "center" }}>
        <Logo height={36} />
        <CircularProgress size={28} thickness={4} aria-hidden />
      </Stack>
    </Box>
  );
}
