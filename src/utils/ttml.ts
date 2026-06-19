import type { Agent } from "@/domain/agent/model";
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { formatTime } from "@/utils/format-time";
import { stripSplitCharacter } from "@/utils/split-character";
import { bgBounds, effectiveBounds } from "@/domain/line/bounds";
import { isWordSynced } from "@/domain/line/predicates";
import { bgText, bgVoice, bgWords, lineText, mainWords } from "@/domain/line/voices";
import { isWordSynced as isWordSyncedVoice } from "@/domain/voice/predicates";

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

  const hasWordTiming = (l: LyricLine) => {
    if (isWordSynced(l)) return true;
    const bg = bgVoice(l);
    return bg !== null && isWordSyncedVoice(bg);
  };
  const effectiveGranularity = lines.some(hasWordTiming) ? "word" : "line";

  const parts: string[] = [];

  // Root element with namespaces
  parts.push(
    `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" xmlns:composer="https://composer.boidu.dev/ttml" ttp:timeBase="media" xml:lang="${escapeXml(metadata.language || "en")}" composer:timing="${effectiveGranularity === "word" ? "Word" : "Line"}">`,
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
  if (groups && groups.length > 0) {
    parts.push(`${ind(3)}<composer:groups>`);
    for (const g of groups) {
      parts.push(
        `${ind(4)}<composer:group id="${escapeXml(g.id)}" label="${escapeXml(g.label)}" color="${escapeXml(g.color)}" templateVersion="${g.templateVersion}"/>`,
      );
    }
    parts.push(`${ind(3)}</composer:groups>`);
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
    let content = "";

    const mainWordList = mainWords(line);
    if (granularity === "word" && mainWordList?.length) {
      const wordCount = mainWordList.length;
      for (let i = 0; i < wordCount; i++) {
        const word = mainWordList[i];
        const text = word.text.trimEnd();
        const needsSpace = i < wordCount - 1 && word.text.endsWith(" ");
        content += `${emitWordSpan(word, text)}${needsSpace ? " " : ""}`;
      }
    } else {
      content = escapeXml(stripSplitCharacter(lineText(line)));
    }

    const background = bgText(line);
    const bgWordList = bgWords(line);
    if (background && bgWordList?.length) {
      const bgCount = bgWordList.length;
      let bgContent = "";
      for (let i = 0; i < bgCount; i++) {
        const bgWord = bgWordList[i];
        const text = bgWord.text.trimEnd();
        const needsSpace = i < bgCount - 1 && bgWord.text.endsWith(" ");
        bgContent += `${emitWordSpan(bgWord, text)}${needsSpace ? " " : ""}`;
      }
      content += `<span ttm:role="x-bg">${bgContent}</span>`;
    } else if (background) {
      // A line-synced background carries its own window, which can differ from
      // the main line's. Fall back to the line timing only when the background
      // is genuinely untimed (no own bounds).
      const bgB = bgBounds(line) ?? timing;
      content += `<span ttm:role="x-bg"><span begin="${formatTime(bgB.begin)}" end="${formatTime(bgB.end)}">${escapeXml(background)}</span></span>`;
    }

    parts.push(
      `${ind(3)}<p begin="${formatTime(timing.begin)}" end="${formatTime(timing.end)}"${agentAttr}${groupAttr}>${content}</p>`,
    );
  }

  parts.push(`${ind(2)}</div>`);
  parts.push(`${ind(1)}</body>`);
  parts.push("</tt>");

  return parts.join(nl);
}

// -- Exports ------------------------------------------------------------------

export { generateTTML };
