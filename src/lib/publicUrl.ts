// Returns a stable, publicly accessible base URL for share links sent to clients.
// When running on the Lovable in-app preview (id-preview--*.lovable.app) or the
// lovableproject.com sandbox, those hosts require a Lovable login and cannot be
// opened directly by a client. Fall back to the published production domain.
const PUBLISHED_URL = "https://flowk.lovable.app";

export function getPublicAppUrl(): string {
  if (typeof window === "undefined") return PUBLISHED_URL;
  const { origin, hostname } = window.location;
  const isPreview =
    hostname.includes("id-preview--") ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "localhost" ||
    hostname === "127.0.0.1";
  return isPreview ? PUBLISHED_URL : origin;
}