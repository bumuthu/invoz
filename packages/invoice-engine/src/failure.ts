export function messageOf(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") return error.message;
  return "invoice handling failed";
}

export function isTransient(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error && typeof error.name === "string" ? error.name : "";
  if (name === "PrismaClientInitializationError" || name === "PrismaClientRustPanicError") return true;
  if (name === "PrismaClientKnownRequestError") {
    const code = "code" in error ? String(error.code) : "";
    return code === "P1001" || code === "P1002" || code === "P1008" || code === "P1017" || code === "P2024";
  }
  if (name === "TimeoutError" || name === "NetworkingError" || name === "AbortError") return true;
  const status = httpStatus(error);
  if (status === 429 || (status !== undefined && status >= 500)) return true;
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) return true;
  return false;
}

export function isUniqueConflict(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code: unknown }).code === "P2002");
}

function httpStatus(error: object): number | undefined {
  if (!("$metadata" in error)) return undefined;
  const metadata = (error as { $metadata?: { httpStatusCode?: unknown } }).$metadata;
  const status = metadata?.httpStatusCode;
  return typeof status === "number" ? status : undefined;
}
