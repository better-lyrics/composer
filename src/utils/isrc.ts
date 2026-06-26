const ISRC_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;

function isValidIsrc(value: string): boolean {
  return ISRC_PATTERN.test(value.toUpperCase()) && value === value.trim();
}

function normalizeIsrc(value: string): string | undefined {
  const normalized = value.trim().toUpperCase();
  return ISRC_PATTERN.test(normalized) ? normalized : undefined;
}

export { isValidIsrc, normalizeIsrc };
