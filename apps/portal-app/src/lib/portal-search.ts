import { AsyncLocalStorage } from "node:async_hooks";

const searchStore = new AsyncLocalStorage<string>();

export function portalSearch(): string | undefined {
  return searchStore.getStore();
}

export function withPortalSearch<T>(search: string, run: () => Promise<T>): Promise<T> {
  return searchStore.run(search, run);
}
