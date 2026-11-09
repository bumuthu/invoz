"use client";

import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import { useEffect, useRef, useState } from "react";

export default function LoadState<T>({
  loadKey,
  load,
  children,
}: {
  loadKey: string;
  load: () => Promise<T>;
  children: (data: T, reload: () => void) => React.ReactNode;
}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError("");
    loadRef
      .current()
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "The page could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [loadKey, tick]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) {
    return (
      <Stack sx={{ py: 8, alignItems: "center" }}>
        <CircularProgress size={28} />
      </Stack>
    );
  }
  return children(data, () => {
    setData(null);
    setTick((value) => value + 1);
  });
}
