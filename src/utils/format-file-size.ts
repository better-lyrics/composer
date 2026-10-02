// -- Constants ----------------------------------------------------------------

const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * 1024;
const GIGABYTE = MEGABYTE * 1024;

// -- Formatting ---------------------------------------------------------------

function formatMegabytes(bytes: number): string {
  return `${(bytes / MEGABYTE).toFixed(1)} MB`;
}

function formatFileSize(bytes: number): string {
  if (bytes < KILOBYTE) return `${bytes} B`;
  const kilobytes = (bytes / KILOBYTE).toFixed(1);
  if (Number(kilobytes) < KILOBYTE) return `${kilobytes} KB`;
  const megabytes = (bytes / MEGABYTE).toFixed(1);
  return Number(megabytes) < KILOBYTE ? `${megabytes} MB` : `${(bytes / GIGABYTE).toFixed(2)} GB`;
}

function formatApproximateFileSize(bytes: number): string {
  const exact = formatFileSize(bytes);
  return Number.isFinite(bytes) && exact.endsWith(" GB") ? `${Math.round(bytes / GIGABYTE)} GB` : exact;
}

// -- Exports ------------------------------------------------------------------

export { formatFileSize, formatMegabytes, formatApproximateFileSize };
