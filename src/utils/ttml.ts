import type { Agent } from "@/domain/agent/model";
import type { LinkGroup } from "@/domain/group/template";
import { effectiveBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { toComposerMeta } from "@/domain/project/metadata-ttml";
import { formatTime } from "@/utils/format-time";
import { COMPOSER_NS } from "@/utils/lyrics-parsers/composer-namespace";
import { stripSplitCharacter } from "@/utils/split-character";
import { renderTranslationContent, renderTransliterationContent } from "@/utils/ttml-alternate-content";
import { emitWordSpan, escapeXml, escapeXmlAttribute } from "@/utils/ttml-markup";

// -- Constants ----------------------------------------------------------------

const APPLE_LYRIC_NS = "http://music.apple.com/lyric-ttml-internal";

// -- Helpers ------------------------------------------------------------------

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
  const timingValue = effectiveGranularity === "word" ? "Word" : "Line";

  const parts: string[] = [];
  const keyedLines = lines
    .filter((line) => effectiveBounds(line) !== null)
    .map((line, index) => ({ line, key: `L${index + 1}` }));
  const keyById = new Map(keyedLines.map(({ line, key }) => [line.id, key]));

  const language = metadata.language?.trim();
  const langAttr = language ? ` xml:lang="${escapeXmlAttribute(language)}"` : "";

  // Apple Music lyric dialect, not strict W3C TTML1. Absolute span times and the
  // Apple timestamp shape are intentional; don't "fix" them to generic TTML.
  parts.push(
    `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" xmlns:itunes="${APPLE_LYRIC_NS}" xmlns:composer="${COMPOSER_NS}" ttp:timeBase="media"${langAttr} itunes:timing="${timingValue}" composer:timing="${timingValue}">`,
  );

  // Head section
  parts.push(`${ind(1)}<head>`);
  parts.push(`${ind(2)}<metadata>`);
  if (metadata.title) {
    parts.push(`${ind(3)}<ttm:title>${escapeXml(metadata.title)}</ttm:title>`);
  }
  for (const { key, value } of toComposerMeta(metadata)) {
    parts.push(`${ind(3)}<composer:meta key="${escapeXmlAttribute(key)}" value="${escapeXmlAttribute(value)}"/>`);
  }
  for (const agent of agents) {
    if (agent.name) {
      parts.push(`${ind(3)}<ttm:agent xml:id="${escapeXmlAttribute(agent.id)}" type="${agent.type}">`);
      parts.push(`${ind(4)}<ttm:name>${escapeXml(agent.name)}</ttm:name>`);
      parts.push(`${ind(3)}</ttm:agent>`);
    } else {
      parts.push(`${ind(3)}<ttm:agent xml:id="${escapeXmlAttribute(agent.id)}" type="${agent.type}"/>`);
    }
  }
  if (groups && groups.length > 0) {
    parts.push(`${ind(3)}<composer:groups>`);
    for (const g of groups) {
      parts.push(
        `${ind(4)}<composer:group id="${escapeXmlAttribute(g.id)}" label="${escapeXmlAttribute(g.label)}" color="${escapeXmlAttribute(g.color)}" templateVersion="${g.templateVersion}"/>`,
      );
    }
    parts.push(`${ind(3)}</composer:groups>`);
  }

  const translationLanguages = new Set<string>();
  for (const { line } of keyedLines) {
    for (const [language, track] of Object.entries(line.translations ?? {})) {
      if (track.text.trim()) {
        translationLanguages.add(language);
      }
    }
  }
  const transliterationLines = keyedLines.filter(({ line }) => line.transliteration?.text.trim());
  if (translationLanguages.size > 0 || transliterationLines.length > 0) {
    parts.push(`${ind(3)}<iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal">`);
    if (translationLanguages.size > 0) {
      parts.push(`${ind(4)}<translations>`);
      for (const language of translationLanguages) {
        parts.push(`${ind(5)}<translation xml:lang="${escapeXml(language)}" type="subtitle">`);
        for (const { line, key } of keyedLines) {
          const track = line.translations?.[language];
          if (track?.text.trim()) {
            parts.push(
              `${ind(6)}<text for="${key}">${renderTranslationContent(line, track.text, track.backgroundText)}</text>`,
            );
          }
        }
        parts.push(`${ind(5)}</translation>`);
      }
      parts.push(`${ind(4)}</translations>`);
    }
    if (transliterationLines.length > 0) {
      const byLanguage = new Map<string, typeof transliterationLines>();
      for (const item of transliterationLines) {
        const language = item.line.transliteration!.language;
        byLanguage.set(language, [...(byLanguage.get(language) ?? []), item]);
      }
      parts.push(`${ind(4)}<transliterations>`);
      for (const [language, languageLines] of byLanguage) {
        parts.push(`${ind(5)}<transliteration xml:lang="${escapeXml(language)}">`);
        for (const { line, key } of languageLines) {
          parts.push(`${ind(6)}<text for="${key}">${renderTransliterationContent(line)}</text>`);
        }
        parts.push(`${ind(5)}</transliteration>`);
      }
      parts.push(`${ind(4)}</transliterations>`);
    }
    parts.push(`${ind(3)}</iTunesMetadata>`);
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

    const agentAttr = line.agentId ? ` ttm:agent="${escapeXmlAttribute(line.agentId)}"` : "";
    const lineKey = keyById.get(line.id);
    const keyAttr = lineKey ? ` itunes:key="${lineKey}"` : "";
    const groupAttr = line.groupId
      ? ` composer:groupId="${escapeXmlAttribute(line.groupId)}" composer:instanceIdx="${line.instanceIdx ?? 0}" composer:templateLineIdx="${line.templateLineIdx ?? 0}"${line.detached ? ' composer:detached="true"' : ""}`
      : "";
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
      `${ind(3)}<p begin="${formatTime(timing.begin)}" end="${formatTime(timing.end)}"${keyAttr}${agentAttr}${groupAttr}>${content}</p>`,
    );
  }

  parts.push(`${ind(2)}</div>`);
  parts.push(`${ind(1)}</body>`);
  parts.push("</tt>");

  return parts.join(nl);
}

// -- Exports ------------------------------------------------------------------

export { generateTTML };
