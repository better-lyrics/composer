// -- Functions -----------------------------------------------------------------

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function ensureHttpScheme(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function parseHttpUrl(value: string): URL | null {
  if (!URL.canParse(value)) return null;
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  return parsed.hostname.length > 0 ? parsed : null;
}

function isValidHttpUrl(value: string): boolean {
  return parseHttpUrl(ensureHttpScheme(value)) !== null;
}

function displayHostFromUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

// -- Exports -------------------------------------------------------------------

export { stripTrailingSlashes, ensureHttpScheme, isValidHttpUrl, parseHttpUrl, displayHostFromUrl };
