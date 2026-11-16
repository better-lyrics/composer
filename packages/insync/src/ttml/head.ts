import type { DocPassthrough } from "../passthrough";
import { escapeXmlAttribute, escapeXmlText } from "../xml-node";
import type { Agent } from "../agent";
import { placeholderAgentName } from "../agent-placeholder-name";
import type { LinkGroup } from "../group";
import { lineTranslations, lineTransliteration } from "../language-line-languages";
import type { ProjectMetadata } from "../metadata";
import { toComposerMeta, YOUTUBE_VIDEO_ID_KEY } from "../project-metadata-ttml";
import { ITUNES_NS } from "./modelled";
import { hasAlternateText, renderTranslationContent, renderTransliterationContent } from "./alternate-content";
import type { KeyedLine } from "./line-keys";
import { keptContent } from "./markup";
import { METADATA_ANCHOR } from "./anchors";
import { keptAmongLines, keptAttributes, keptElementLines } from "./passthrough-write";

// -- Types --------------------------------------------------------------------

interface HeadSource {
  metadata: ProjectMetadata;
  agents: readonly Agent[];
  groups?: readonly LinkGroup[];
  keyedLines: readonly KeyedLine[];
  writesWords: boolean;
  youtubeVideoId?: string;
  passthrough?: DocPassthrough;
}

type Indent = (depth: number) => string;

// -- Agents -------------------------------------------------------------------

function agentLines(agent: Agent, position: number, ind: Indent): string[] {
  const open = `${ind(3)}<ttm:agent xml:id="${escapeXmlAttribute(agent.id)}" type="${agent.type}"${keptAttributes(agent.passthrough)}`;
  // The importer names an unnamed singer for display only; exporting that name would edit the lyrics.
  const named = !!agent.name && agent.name !== placeholderAgentName(position);
  const name =
    named || agent.namePassthrough
      ? [
          `${ind(4)}<ttm:name${keptAttributes(agent.namePassthrough)}>${named ? keptContent(agent.name ?? "", agent.namePassthrough?.markup) : ""}</ttm:name>`,
        ]
      : [];
  const children = [...name, ...keptElementLines(agent.passthrough, ind(4))];
  return children.length > 0 ? [`${open}>`, ...children, `${ind(3)}</ttm:agent>`] : [`${open}/>`];
}

// -- Languages ----------------------------------------------------------------

function translationLines(keyedLines: readonly KeyedLine[], ind: Indent): string[] {
  const typeByLanguage = new Map<string, string | undefined>();
  for (const { line } of keyedLines) {
    for (const [language, track] of Object.entries(lineTranslations(line) ?? {})) {
      if (hasAlternateText(track)) {
        typeByLanguage.set(language, typeByLanguage.get(language) ?? track.translationType);
      }
    }
  }
  if (typeByLanguage.size === 0) return [];
  const parts = [`${ind(4)}<translations>`];
  for (const [language, type] of typeByLanguage) {
    parts.push(
      `${ind(5)}<translation xml:lang="${escapeXmlText(language)}" type="${escapeXmlAttribute(type ?? "subtitle")}">`,
    );
    for (const { line, key } of keyedLines) {
      const track = lineTranslations(line)?.[language];
      if (track && hasAlternateText(track)) {
        parts.push(
          `${ind(6)}<text for="${key}">${renderTranslationContent(line, track.main.text, track.bg?.text)}</text>`,
        );
      }
    }
    parts.push(`${ind(5)}</translation>`);
  }
  parts.push(`${ind(4)}</translations>`);
  return parts;
}

function transliterationLines(
  keyedLines: readonly KeyedLine[],
  writesWords: boolean,
  ind: Indent,
  splitChar: string,
): string[] {
  const transliterated = keyedLines.flatMap(({ line, key }) => {
    const transliteration = lineTransliteration(line);
    return transliteration && hasAlternateText(transliteration) ? [{ line, key, transliteration }] : [];
  });
  if (transliterated.length === 0) return [];
  const byLanguage = new Map<string, typeof transliterated>();
  for (const item of transliterated) {
    const language = item.transliteration.language;
    byLanguage.set(language, [...(byLanguage.get(language) ?? []), item]);
  }
  const parts = [`${ind(4)}<transliterations>`];
  for (const [language, languageLines] of byLanguage) {
    parts.push(`${ind(5)}<transliteration xml:lang="${escapeXmlText(language)}">`);
    for (const { line, key } of languageLines) {
      parts.push(`${ind(6)}<text for="${key}">${renderTransliterationContent(line, splitChar, writesWords)}</text>`);
    }
    parts.push(`${ind(5)}</transliteration>`);
  }
  parts.push(`${ind(4)}</transliterations>`);
  return parts;
}

function iTunesMetadataLines(source: HeadSource, ind: Indent, splitChar: string): string[] {
  const kept = source.passthrough?.iTunesMetadata;
  const children = [
    ...translationLines(source.keyedLines, ind),
    ...transliterationLines(source.keyedLines, source.writesWords, ind, splitChar),
    ...keptElementLines(kept, ind(4)),
  ];
  if (children.length === 0 && !kept) return [];
  return [
    `${ind(3)}<iTunesMetadata xmlns="${ITUNES_NS}"${keptAttributes(kept)}>`,
    ...children,
    `${ind(3)}</iTunesMetadata>`,
  ];
}

// -- Head ---------------------------------------------------------------------

function headLines(source: HeadSource, ind: Indent, splitChar: string): string[] {
  const { metadata, agents, groups, youtubeVideoId, passthrough } = source;
  const parts = [`${ind(2)}<metadata${keptAttributes(passthrough?.metadata)}>`];
  if (metadata.title) {
    parts.push(`${ind(3)}<ttm:title>${escapeXmlText(metadata.title)}</ttm:title>`);
  }
  for (const { key, value } of toComposerMeta(metadata)) {
    parts.push(`${ind(3)}<composer:meta key="${escapeXmlAttribute(key)}" value="${escapeXmlAttribute(value)}"/>`);
  }
  if (youtubeVideoId) {
    parts.push(`${ind(3)}<composer:meta key="${YOUTUBE_VIDEO_ID_KEY}" value="${escapeXmlAttribute(youtubeVideoId)}"/>`);
  }
  agents.forEach((agent, position) => parts.push(...agentLines(agent, position, ind)));
  if (groups && groups.length > 0) {
    parts.push(`${ind(3)}<composer:groups>`);
    for (const g of groups) {
      const sharing = g.sharesTiming ? ` sharesTiming="true"` : "";
      const ownTiming = g.ownTimingInstances?.length ? ` ownTimingInstances="${g.ownTimingInstances.join(",")}"` : "";
      parts.push(
        `${ind(4)}<composer:group id="${escapeXmlAttribute(g.id)}" label="${escapeXmlAttribute(g.label)}" color="${escapeXmlAttribute(g.color)}" templateVersion="${g.templateVersion}"${sharing}${ownTiming}/>`,
      );
    }
    parts.push(`${ind(3)}</composer:groups>`);
  }
  parts.push(...iTunesMetadataLines(source, ind, splitChar));
  parts.push(...keptElementLines(passthrough?.metadata, ind(3)));
  parts.push(`${ind(2)}</metadata>`);
  return [
    `${ind(1)}<head${keptAttributes(passthrough?.head)}>`,
    ...keptAmongLines([{ out: parts, anchors: [METADATA_ANCHOR] }], passthrough?.head, ind(2), [METADATA_ANCHOR]),
    `${ind(1)}</head>`,
  ];
}

// -- Exports ------------------------------------------------------------------

export type { Indent };
export { headLines };
