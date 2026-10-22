"use client";

import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import ContactDetails from "@/components/ContactDetails";

type DemoContextValue = {
  openDemo: () => void;
};

const DemoContext = createContext<DemoContextValue | null>(null);

export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) {
    throw new Error("Book a demo is outside DemoProvider");
  }
  return value;
}

export default function DemoProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <DemoContext.Provider value={{ openDemo: () => setOpen(true) }}>
      {children}
      {open ? <DemoDrawer onClose={() => setOpen(false)} /> : null}
    </DemoContext.Provider>
  );
}

function DemoDrawer({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>('input[name="name"]')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>("input, textarea, button")].filter(
        (item) => !item.hasAttribute("disabled") && item.tabIndex !== -1,
      );
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div className="demo-root">
      <button type="button" className="demo-backdrop" aria-label="Close demo form" onClick={onClose} />
      <section
        className="demo-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
      >
        <div className="demo-head">
          <div>
            <p className="section-label">Demo</p>
            <h2 id={titleId}>Book a demo</h2>
          </div>
          <button type="button" className="demo-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="demo-body">
        {done ? (
          <p className="demo-success">Request received. The Invoz desk has it and will reply by email.</p>
        ) : (
          <form
            className="demo-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = Object.fromEntries(new FormData(form));
              const endpoint = process.env.NEXT_PUBLIC_LANDING_API_URL?.replace(/\/$/, "");
              setPending(true);
              setError("");
              if (!endpoint) {
                setPending(false);
                setError("The demo service is not configured.");
                return;
              }
              let response: Response;
              try {
                response = await fetch(`${endpoint}/demo`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(data),
                });
              } catch {
                setPending(false);
                setError("The request could not be sent.");
                return;
              }
              setPending(false);
              if (!response.ok) {
                const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                setError(payload?.error || "The request could not be sent.");
                return;
              }
              setDone(true);
              form.reset();
            }}
          >
            <label className="demo-honey">
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
            <label>
              Name
              <input name="name" autoComplete="name" required maxLength={120} />
            </label>
            <label>
              Work email
              <input name="email" type="email" autoComplete="email" required maxLength={200} />
            </label>
            <label>
              Phone
              <input name="phone" type="tel" autoComplete="tel" required minLength={7} maxLength={40} />
            </label>
            <label>
              Company
              <input name="company" autoComplete="organization" required maxLength={160} />
            </label>
            <label className="demo-wide">
              ERPs
              <input name="erp" required maxLength={160} placeholder="SAP, Odoo, IFS" />
            </label>
            <label className="demo-wide">
              Other notes
              <textarea name="note" rows={4} maxLength={2000} placeholder="Any other details." />
            </label>
            {error ? <p className="demo-error">{error}</p> : null}
            <button className="btn btn-accent" type="submit" disabled={pending}>
              {pending ? "Sending…" : "Send"}
            </button>
          </form>
        )}
        </div>
        <ContactDetails className="demo-contact" />
      </section>
    </div>
  );
}
