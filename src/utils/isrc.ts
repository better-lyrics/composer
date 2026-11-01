const ISRC_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;

// ISO 3901 codes are 12 alphanumeric characters. Hyphens and spaces are a
// display convention (US-RC1-24-00001), so they are stripped before matching:
// a code pasted from a label, a catalogue or the bridge is still valid.
function normalizeIsrc(value: string): string | undefined {
  const normalized = value.replace(/[\s-]/g, "").toUpperCase();
  return ISRC_PATTERN.test(normalized) ? normalized : undefined;
}

function isValidIsrc(value: string): boolean {
  return normalizeIsrc(value) !== undefined;
}

export { isValidIsrc, normalizeIsrc };
