"use client";

import Typography from "@mui/material/Typography";
import { unstable_rethrow } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import PageSkeleton from "@/components/PageSkeleton";
import { onPortalReload } from "@/lib/portal-client";
import { usePortalPath } from "@/lib/portal-nav";

export default function PageData<T>({
  load,
  children,
}: {
  load: (search: string) => Promise<T>;
  children: (data: T) => ReactNode;
}) {
  const { search } = usePortalPath();
  const [data, setData] = useState<T | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => onPortalReload(() => setGeneration((current) => current + 1)), []);

  useEffect(() => {
    setData(null);
    setFailure(null);
  }, [load, search]);

  useEffect(() => {
    let cancelled = false;
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
  }, [load, search, generation]);

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
