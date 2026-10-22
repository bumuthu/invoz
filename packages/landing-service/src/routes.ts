import { bookDemo } from "./demo";
import type { Route } from "./types";

export const routes: Route[] = [
  {
    method: "GET",
    path: "/health",
    handle: async () => ({ status: 200, body: { ok: true } }),
  },
  {
    method: "POST",
    path: "/demo",
    handle: bookDemo,
  },
];
