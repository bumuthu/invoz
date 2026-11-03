"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export type PortalLocation = { pathname: string; search: string };

const listeners = new Set<(path: PortalLocation) => void>();

function readLocation(): PortalLocation {
  const search = window.location.search;
  return {
    pathname: window.location.pathname,
    search: search.startsWith("?") ? search.slice(1) : search,
  };
}

function publish(path: PortalLocation) {
  listeners.forEach((listener) => listener(path));
}

// Native history methods skip Next.js, which would otherwise request a rendered page.
function writeHistory(method: "pushState" | "replaceState", href: string) {
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin) {
    window.location.assign(url.href);
    return;
  }
  const next = url.pathname + url.search;
  if (next === window.location.pathname + window.location.search) return;
  const state = window.history.state == null ? null : { ...window.history.state };
  History.prototype[method].call(window.history, state, "", next);
  publish(readLocation());
  if (method === "pushState") window.scrollTo(0, 0);
}

export function navigate(href: string) {
  writeHistory("pushState", href);
}

export function replacePortal(href: string) {
  writeHistory("replaceState", href);
}

if (typeof window !== "undefined") {
  window.addEventListener(
    "popstate",
    (event) => {
      event.stopImmediatePropagation();
      publish(readLocation());
    },
    true,
  );
}

export function usePortalPath(): PortalLocation {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [override, setOverride] = useState<PortalLocation | null>(null);

  useEffect(() => {
    listeners.add(setOverride);
    return () => {
      listeners.delete(setOverride);
    };
  }, []);

  return override ?? { pathname, search };
}
