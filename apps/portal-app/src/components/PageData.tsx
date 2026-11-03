"use client";

import Typography from "@mui/material/Typography";
import { unstable_rethrow, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import PageSkeleton from "@/components/PageSkeleton";

export default function PageData<T>({
  load,
  children,
}: {
  load: (search: string) => Promise<T>;
  children: (data: T) => ReactNode;
}) {
  const search = useSearchParams().toString();
  const [data, setData] = useState<T | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setFailure(null);
    (async () => {
      try {
        const value = await load(search);
        if (!cancelled) setData(value);
      } catch (error) {
        unstable_rethrow(error);
        if (!cancelled) {
          setFailure(error instanceof Error ? error.message : "This page could not be loaded.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, search]);

  if (failure) {
    return (
      <Typography color="text.secondary" role="alert">
        {failure}
      </Typography>
    );
  }
  if (!data) return <PageSkeleton />;
  return children(data);
}
