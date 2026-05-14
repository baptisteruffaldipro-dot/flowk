export async function getFunctionErrorMessage(error: unknown, data: unknown, fallback: string) {
  const dataError = typeof data === "object" && data && "error" in data ? String((data as { error?: unknown }).error ?? "") : "";
  if (dataError) return dataError;

  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    const body = await context.clone().json().catch(() => null);
    const bodyError = typeof body === "object" && body && "error" in body ? String((body as { error?: unknown }).error ?? "") : "";
    if (bodyError) return bodyError;
  }

  const message = error instanceof Error ? error.message : "";
  return message && !message.includes("non-2xx") ? message : fallback;
}