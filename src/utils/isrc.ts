const ISRC_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;

function normalizeIsrc(value: string): string | undefined {
  const normalized = value.trim().toUpperCase();
  return ISRC_PATTERN.test(normalized) ? normalized : undefined;
}

function isValidIsrc(value: string): boolean {
  return normalizeIsrc(value) !== undefined;
}

export { isValidIsrc, normalizeIsrc };
