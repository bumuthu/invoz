"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { requeueDocument } from "@/lib/actions";
import type { DocumentSource } from "@/lib/types";

export default function RequeueButton({
  organizationId,
  source,
  sourceId,
}: {
  organizationId: string;
  source: DocumentSource;
  sourceId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  return (
    <>
      {message ? (
        <Alert severity={message.tone} sx={{ mt: 2 }}>
          {message.text}
        </Alert>
      ) : null}
      <Button
        variant="contained"
        disabled={pending}
        sx={{ mt: 2.5 }}
        onClick={async () => {
          setPending(true);
          const result = await requeueDocument(organizationId, source, sourceId);
          setPending(false);
          if (!result.ok) {
            setMessage({ tone: "error", text: result.error });
            return;
          }
          setMessage({ tone: "success", text: result.message });
          router.refresh();
        }}
      >
        Re-queue
      </Button>
    </>
  );
}
