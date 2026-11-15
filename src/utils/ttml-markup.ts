import { escapeXmlText } from "insync/xml-node";
import { formatTime } from "@/utils/format-time";

function emitWordSpan(word: { begin: number; end: number; explicit?: true }, text: string): string {
  const explicitAttr = word.explicit ? ' composer:explicit="true"' : "";
  return `<span begin="${formatTime(word.begin)}" end="${formatTime(word.end)}"${explicitAttr}>${escapeXmlText(text)}</span>`;
}

export { emitWordSpan };
