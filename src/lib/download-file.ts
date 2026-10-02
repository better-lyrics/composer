const RESERVED_OR_CONTROL = /[<>:"/\\|?*\p{Cc}]/gu;
const EDGE_DOTS_AND_SPACES = /^[.\s]+|[.\s]+$/g;
const MAX_FILE_NAME_LENGTH = 120;

function sanitizeFileName(name: string, fallback: string): string {
  const cleaned = name.replace(RESERVED_OR_CONTROL, "").replace(/\s+/g, " ").replace(EDGE_DOTS_AND_SPACES, "");
  const capped = Array.from(cleaned).slice(0, MAX_FILE_NAME_LENGTH).join("").replace(EDGE_DOTS_AND_SPACES, "");
  return capped || fallback;
}

function localDateStamp(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function downloadText(text: string, fileName: string, type: string): void {
  downloadBlob(new Blob([text], { type }), fileName);
}

function downloadJson(value: unknown, fileName: string): void {
  downloadText(JSON.stringify(value, null, 2), fileName, "application/json");
}

export { sanitizeFileName, localDateStamp, downloadBlob, downloadText, downloadJson };
