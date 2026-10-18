"use client";

import Box from "@mui/material/Box";

export default function Initials({ name, size = 32 }: { name: string; size?: number }) {
  const letters = name
    .split(" ")
    .filter((part) => part && part !== "—")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        bgcolor: "primary.light",
        color: "primary.dark",
        display: "grid",
        placeItems: "center",
        fontSize: size < 34 ? 11 : 13,
        fontWeight: 700,
        flexShrink: 0,
        letterSpacing: "0.02em",
      }}
    >
      {letters || "•"}
    </Box>
  );
}
