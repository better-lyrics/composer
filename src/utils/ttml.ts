import type { Agent, LyricLine, ProjectMetadata } from "@/stores/project";
import { stripSplitCharacter } from "@/utils/split-character";

// -- Helpers ------------------------------------------------------------------

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00.000";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

function getLineTiming(line: LyricLine): { begin: number; end: number } | null {
  if (line.words?.length) {
    const firstWord = line.words[0];
    const lastWord = line.words[line.words.length - 1];
    return { begin: firstWord.begin, end: lastWord.end };
  }
  if (line.begin !== undefined && line.end !== undefined) {
    return { begin: line.begin, end: line.end };
  }
  return null;
}

// -- Generator ----------------------------------------------------------------

interface TTMLOptions {
  metadata: ProjectMetadata;
  agents: Agent[];
  lines: LyricLine[];
  granularity: "line" | "word";
  minify?: boolean;
  duration?: number;
}

function generateTTML({ metadata, agents, lines, granularity, minify = false, duration }: TTMLOptions): string {
  const nl = minify ? "" : "\n";
  const ind = (n: number) => (minify ? "" : "  ".repeat(n));

  const parts: string[] = [];

  // Root element with namespaces
  parts.push(
    `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" xmlns:composer="https://composer.boidu.dev/ttml" ttp:timeBase="media" xml:lang="${escapeXml(metadata.language || "en")}" composer:timing="${granularity === "word" ? "Word" : "Line"}">`,
  );

  // Head section
  parts.push(`${ind(1)}<head>`);
  parts.push(`${ind(2)}<metadata>`);
  if (metadata.title) {
    parts.push(`${ind(3)}<ttm:title>${escapeXml(metadata.title)}</ttm:title>`);
  }
  for (const agent of agents) {
    if (agent.name) {
      parts.push(`${ind(3)}<ttm:agent xml:id="${escapeXml(agent.id)}" type="${agent.type}">`);
      parts.push(`${ind(4)}<ttm:name>${escapeXml(agent.name)}</ttm:name>`);
      parts.push(`${ind(3)}</ttm:agent>`);
    } else {
      parts.push(`${ind(3)}<ttm:agent xml:id="${escapeXml(agent.id)}" type="${agent.type}"/>`);
    }
  }
  parts.push(`${ind(2)}</metadata>`);
  parts.push(`${ind(1)}</head>`);

  // Body section
  const durAttr = duration ? ` dur="${formatTime(duration)}"` : "";
  parts.push(`${ind(1)}<body${durAttr}>`);
  parts.push(`${ind(2)}<div>`);

  for (const line of lines) {
    const timing = getLineTiming(line);
    if (!timing) continue;

    const agentAttr = line.agentId ? ` ttm:agent="${escapeXml(line.agentId)}"` : "";
    let content = "";

    if (granularity === "word" && line.words?.length) {
      // Word-level timing - build spans inline
      for (let i = 0; i < line.words.length; i++) {
        const word = line.words[i];
        const text = word.text.trimEnd();
        const needsSpace = i < line.words.length - 1 && word.text.endsWith(" ");
        content += `<span begin="${formatTime(word.begin)}" end="${formatTime(word.end)}">${escapeXml(text)}</span>${needsSpace ? " " : ""}`;
      }
    } else {
      content = escapeXml(stripSplitCharacter(line.text));
    }

    // Background vocals
    if (line.backgroundText && line.backgroundWords?.length) {
      let bgContent = "";
      for (let i = 0; i < line.backgroundWords.length; i++) {
        const bgWord = line.backgroundWords[i];
        const text = bgWord.text.trimEnd();
        const needsSpace = i < line.backgroundWords.length - 1 && bgWord.text.endsWith(" ");
        bgContent += `<span begin="${formatTime(bgWord.begin)}" end="${formatTime(bgWord.end)}">${escapeXml(text)}</span>${needsSpace ? " " : ""}`;
      }
      content += `<span ttm:role="x-bg">${bgContent}</span>`;
    } else if (line.backgroundText) {
      content += `<span ttm:role="x-bg"><span begin="${formatTime(timing.begin)}" end="${formatTime(timing.end)}">${escapeXml(line.backgroundText)}</span></span>`;
    }

    parts.push(
      `${ind(3)}<p begin="${formatTime(timing.begin)}" end="${formatTime(timing.end)}"${agentAttr}>${content}</p>`,
    );
  }

  parts.push(`${ind(2)}</div>`);
  parts.push(`${ind(1)}</body>`);
  parts.push("</tt>");

  return parts.join(nl);
}

// -- Exports ------------------------------------------------------------------

export { generateTTML, formatTime };
