import type { Agent } from "@/domain/agent/model";
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { formatTime } from "@/utils/format-time";
import { stripSplitCharacter } from "@/utils/split-character";
import { effectiveBounds } from "@/domain/line/bounds";

// -- Helpers ------------------------------------------------------------------

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

function emitWordSpan(word: { text: string; begin: number; end: number; explicit?: true }, text: string): string {
  const explicitAttr = word.explicit ? ' composer:explicit="true"' : "";
  return `<span begin="${formatTime(word.begin)}" end="${formatTime(word.end)}"${explicitAttr}>${escapeXml(text)}</span>`;
}

// -- Generator ----------------------------------------------------------------

interface TTMLOptions {
  metadata: ProjectMetadata;
  agents: Agent[];
  lines: LyricLine[];
  groups?: LinkGroup[];
  granularity: "line" | "word";
  minify?: boolean;
  duration?: number;
}

function generateTTML({ metadata, agents, lines, groups, granularity, minify = false, duration }: TTMLOptions): string {
  const nl = minify ? "" : "\n";
  const ind = (n: number) => (minify ? "" : "  ".repeat(n));

  const effectiveGranularity = lines.some((l) => l.words?.length) ? "word" : "line";

  const parts: string[] = [];

  // Root element with namespaces
  parts.push(
    `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" xmlns:composer="https://composer.boidu.dev/ttml" ttp:timeBase="media" xml:lang="${escapeXml(metadata.language || "en")}" composer:timing="${effectiveGranularity === "word" ? "Word" : "Line"}">`,
  );

  const displayKeyByLineId = new Map<string, string>();
  const transliterationRecords: { line: LyricLine; key: string }[] = [];
  let timedOrdinal = 0;
  for (const line of lines) {
    if (!effectiveBounds(line)) continue;
    timedOrdinal += 1;
    const key = `L${timedOrdinal}`;
    displayKeyByLineId.set(line.id, key);
    if (line.romanization?.text) {
      transliterationRecords.push({ line, key });
    }
  }

  const scheme = metadata.romanizationScheme ?? "";
  if (transliterationRecords.length > 0 && !scheme) {
    console.warn(
      "[Composer] Romanization present but metadata.romanizationScheme is empty; skipping transliteration blocks.",
    );
  }
  const emitTransliterations = transliterationRecords.length > 0 && Boolean(scheme);

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
  if (groups && groups.length > 0) {
    parts.push(`${ind(3)}<composer:groups>`);
    for (const g of groups) {
      parts.push(
        `${ind(4)}<composer:group id="${escapeXml(g.id)}" label="${escapeXml(g.label)}" color="${escapeXml(g.color)}" templateVersion="${g.templateVersion}"/>`,
      );
    }
    parts.push(`${ind(3)}</composer:groups>`);
  }
  if (emitTransliterations) {
    for (const { line, key } of transliterationRecords) {
      const r = line.romanization!;
      parts.push(`${ind(3)}<transliteration for="${escapeXml(key)}" xml:lang="${escapeXml(scheme)}">`);
      if (r.wordTexts && line.words && r.wordTexts.length === line.words.length) {
        parts.push(`${ind(4)}<text for="${escapeXml(key)}">`);
        for (let i = 0; i < r.wordTexts.length; i++) {
          const w = line.words[i];
          parts.push(
            `${ind(5)}<span begin="${formatTime(w.begin)}" end="${formatTime(w.end)}">${escapeXml(r.wordTexts[i])}</span>`,
          );
        }
        parts.push(`${ind(4)}</text>`);
      } else {
        parts.push(`${ind(4)}<text for="${escapeXml(key)}">${escapeXml(r.text)}</text>`);
      }
      parts.push(`${ind(3)}</transliteration>`);
    }
  }
  parts.push(`${ind(2)}</metadata>`);
  parts.push(`${ind(1)}</head>`);

  // Body section
  const durAttr = duration ? ` dur="${formatTime(duration)}"` : "";
  parts.push(`${ind(1)}<body${durAttr}>`);
  parts.push(`${ind(2)}<div>`);

  for (const line of lines) {
    const timing = effectiveBounds(line);
    if (!timing) continue;

    const agentAttr = line.agentId ? ` ttm:agent="${escapeXml(line.agentId)}"` : "";
    const groupAttr = line.groupId
      ? ` composer:groupId="${escapeXml(line.groupId)}" composer:instanceIdx="${line.instanceIdx ?? 0}" composer:templateLineIdx="${line.templateLineIdx ?? 0}"${line.detached ? ' composer:detached="true"' : ""}`
      : "";
    const displayKey = displayKeyByLineId.get(line.id);
    const itunesKeyAttr = displayKey ? ` itunes:key="${displayKey}"` : "";
    let content = "";

    if (granularity === "word" && line.words?.length) {
      const words = line.words;
      const wordCount = words.length;
      for (let i = 0; i < wordCount; i++) {
        const word = words[i];
        const text = word.text.trimEnd();
        const needsSpace = i < wordCount - 1 && word.text.endsWith(" ");
        content += `${emitWordSpan(word, text)}${needsSpace ? " " : ""}`;
      }
    } else {
      content = escapeXml(stripSplitCharacter(line.text));
    }

    if (line.backgroundText && line.backgroundWords?.length) {
      const bgWords = line.backgroundWords;
      const bgCount = bgWords.length;
      let bgContent = "";
      for (let i = 0; i < bgCount; i++) {
        const bgWord = bgWords[i];
        const text = bgWord.text.trimEnd();
        const needsSpace = i < bgCount - 1 && bgWord.text.endsWith(" ");
        bgContent += `${emitWordSpan(bgWord, text)}${needsSpace ? " " : ""}`;
      }
      content += `<span ttm:role="x-bg">${bgContent}</span>`;
    } else if (line.backgroundText) {
      content += `<span ttm:role="x-bg"><span begin="${formatTime(timing.begin)}" end="${formatTime(timing.end)}">${escapeXml(line.backgroundText)}</span></span>`;
    }

    parts.push(
      `${ind(3)}<p begin="${formatTime(timing.begin)}" end="${formatTime(timing.end)}"${agentAttr}${groupAttr}${itunesKeyAttr}>${content}</p>`,
    );
  }

  parts.push(`${ind(2)}</div>`);
  parts.push(`${ind(1)}</body>`);
  parts.push("</tt>");

  return parts.join(nl);
}

// -- Exports ------------------------------------------------------------------

export { generateTTML };
