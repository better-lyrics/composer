import { formatTime } from "@/utils/format-time";

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

function escapeXmlAttribute(str: string): string {
  return escapeXml(str).replace(/"/g, "&quot;");
}

function emitWordSpan(word: { begin: number; end: number; explicit?: true }, text: string): string {
  const explicitAttr = word.explicit ? ' composer:explicit="true"' : "";
  return `<span begin="${formatTime(word.begin)}" end="${formatTime(word.end)}"${explicitAttr}>${escapeXml(text)}</span>`;
}

export { emitWordSpan, escapeXml, escapeXmlAttribute };
