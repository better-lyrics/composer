import type { XmlReadElement } from "./xml-read-tree";
import { isEmptyDocPassthrough } from "../passthrough";
import type { Agent, AgentType } from "../agent";
import { placeholderAgentName } from "../agent-placeholder-name";
import type { LinkGroup } from "../group";
import { lineFromFields } from "../line-from-fields";
import type { LyricLine } from "../line";
import { isLineSynced, isWordSynced } from "../line-predicates";
import { mainTrack } from "../line-track";
import { normalizeLanguageTag } from "../project-language";
import type { ProjectMetadata } from "../metadata";
import { fromComposerMeta } from "../project-metadata-ttml";
import type { WordTiming } from "../word-timing";
import { COMPOSER_NAMESPACES } from "./composer-namespace";
import { type ParseResult, generateLineId } from "../parse-result";
import { parseTtmlAlternates, withInlineAlternates } from "./alternates-read";
import { extractTimedWords, parseTtmlDocument } from "./read-helpers";
import { MAIN_BEGIN_ATTRIBUTE, MAIN_END_ATTRIBUTE } from "./main-span";
import { parseTtmlTimestamp } from "./timestamp";
import { partsFromDivs } from "./parts-read";
import { docPassthrough, withAgentCapture, withParagraphCapture } from "./passthrough-read";
import {
  type UntimedLyric,
  timedTrackText,
  untimedAnchors,
  untimedBackgroundSpan,
  untimedLyric,
  withUntimedSpans,
} from "./untimed-read";

// -- Helpers ------------------------------------------------------------------

function getComposerAttribute(el: XmlReadElement, name: string): string | null {
  const prefixed = el.getAttribute(`composer:${name}`);
  if (prefixed !== null) return prefixed;
  for (const ns of COMPOSER_NAMESPACES) {
    const value = el.getAttributeNS(ns, name);
    if (value !== null) return value;
  }
  return null;
}

// The span of a main track read as text: the one Composer wrote apart, else the `<p>` times.
function untimedMainSpan(p: XmlReadElement, begin: number, end: number): { begin?: number; end?: number } {
  const mainBegin = getComposerAttribute(p, MAIN_BEGIN_ATTRIBUTE);
  const mainEnd = getComposerAttribute(p, MAIN_END_ATTRIBUTE);
  if (mainBegin !== null && mainEnd !== null) {
    const ownBegin = parseTtmlTimestamp(mainBegin);
    const ownEnd = parseTtmlTimestamp(mainEnd);
    if (Number.isFinite(ownBegin) && Number.isFinite(ownEnd) && ownBegin <= ownEnd) {
      return { begin: ownBegin, end: ownEnd };
    }
  }
  return {
    begin: p.hasAttribute("begin") && Number.isFinite(begin) ? begin : undefined,
    end: p.hasAttribute("end") && Number.isFinite(end) ? end : undefined,
  };
}

const ITUNES_NS = "http://music.apple.com/lyric-ttml-internal";

// -- TTML Parser --------------------------------------------------------------

function parseTtml(content: string, splitChar: string, _fallbackDuration?: number): ParseResult {
  const metadata: Partial<ProjectMetadata> = {};
  const lines: LyricLine[] = [];
  const lineIndexByKey = new Map<string, number>();
  const lineKeys: (string | undefined)[] = [];
  const lineByParagraph = new Map<XmlReadElement, LyricLine>();

  const parsed = parseTtmlDocument(content);
  if (!parsed.ok) {
    return { lines: [], metadata: {}, hasTimingData: false, issues: [{ line: 1, text: "", reason: "empty-document" }] };
  }
  const doc = parsed.doc;

  // Extract metadata (use getElementsByTagName for namespace compatibility)
  const titleEl = doc.getElementsByTagName("title")[0];
  if (titleEl?.textContent) metadata.title = titleEl.textContent;

  // Also check ttm:title for Apple Music format
  const ttmTitleEl = doc.getElementsByTagName("ttm:title")[0];
  if (ttmTitleEl?.textContent && !metadata.title) metadata.title = ttmTitleEl.textContent;

  const documentLanguage = normalizeLanguageTag(doc.documentElement.getAttribute("xml:lang") ?? "");
  if (documentLanguage) metadata.language = documentLanguage;

  const amllMetaEls = Array.from(doc.getElementsByTagName("amll:meta"));
  const metaEls = Array.from(
    new Set(
      Array.from(doc.getElementsByTagName("composer:meta")).concat(
        COMPOSER_NAMESPACES.flatMap((ns) => Array.from(doc.getElementsByTagNameNS(ns, "meta"))),
        amllMetaEls,
      ),
    ),
  );
  Object.assign(
    metadata,
    fromComposerMeta(
      metaEls.map((el) => ({ key: el.getAttribute("key") ?? "", value: el.getAttribute("value") ?? "" })),
    ),
  );

  const artistEl = doc.firstWithAttribute("type", "artist");
  if (!metadata.artists && artistEl?.textContent) metadata.artists = [artistEl.textContent];

  const albumEl = doc.firstWithAttribute("type", "album");
  if (!metadata.album && albumEl?.textContent) metadata.album = albumEl.textContent;

  // Extract agents from metadata
  const agents: Agent[] = [];
  const agentEls = doc.getElementsByTagName("ttm:agent");
  for (const el of agentEls) {
    const id = el.getAttribute("xml:id");
    const type = (el.getAttribute("type") as AgentType) || "person";
    const nameEl = Array.from(el.children).find((child) => child.tagName === "ttm:name");
    const name = nameEl?.textContent || placeholderAgentName(agents.length);
    if (id) {
      agents.push(withAgentCapture({ id, type, name }, el, nameEl));
    }
  }

  // Parse composer:groups registry
  const groups: LinkGroup[] = [];
  const groupEls = Array.from(doc.getElementsByTagName("composer:group")).concat(
    COMPOSER_NAMESPACES.flatMap((ns) => Array.from(doc.getElementsByTagNameNS(ns, "group"))),
  );
  const seenGroupIds = new Set<string>();
  for (const el of groupEls) {
    const id = el.getAttribute("id");
    if (!id || seenGroupIds.has(id)) continue;
    seenGroupIds.add(id);
    const label = el.getAttribute("label") ?? "Group";
    const color = el.getAttribute("color") ?? "#9ca3af";
    const versionStr = el.getAttribute("templateVersion");
    const templateVersion = versionStr ? Number.parseInt(versionStr, 10) || 1 : 1;
    const ownTimingInstances = (el.getAttribute("ownTimingInstances") ?? "")
      .split(",")
      .filter((part) => part.trim() !== "")
      .map(Number)
      .filter((instanceIdx) => Number.isInteger(instanceIdx) && instanceIdx >= 0);
    groups.push({
      id,
      label,
      color,
      templateVersion,
      ...(el.getAttribute("sharesTiming") === "true" ? { sharesTiming: true as const } : {}),
      ...(ownTimingInstances.length ? { ownTimingInstances } : {}),
    });
  }

  // Parse lyrics - look for <p> elements with timing
  const paragraphs = doc.getElementsByTagName("p");

  for (const p of paragraphs) {
    const lineCountBefore = lines.length;
    const begin = parseTtmlTimestamp(p.getAttribute("begin") ?? "");
    const end = parseTtmlTimestamp(p.getAttribute("end") ?? "");
    const agentId = p.getAttribute("ttm:agent")?.replace("#", "") ?? "v1";
    const lineKey = p.getAttribute("itunes:key") ?? p.getAttributeNS(ITUNES_NS, "key");

    const rawGroupId = getComposerAttribute(p, "groupId");
    const knownGroupId = rawGroupId && seenGroupIds.has(rawGroupId) ? rawGroupId : null;
    if (rawGroupId && !knownGroupId) {
      console.warn(`[Composer] TTML <p> references unknown groupId="${rawGroupId}"; treating line as standalone.`);
    }
    const instanceIdxStr = getComposerAttribute(p, "instanceIdx");
    const templateLineIdxStr = getComposerAttribute(p, "templateLineIdx");
    const detachedStr = getComposerAttribute(p, "detached");

    const groupFields = knownGroupId
      ? {
          groupId: knownGroupId,
          instanceIdx: instanceIdxStr ? Number.parseInt(instanceIdxStr, 10) || 0 : 0,
          templateLineIdx: templateLineIdxStr ? Number.parseInt(templateLineIdxStr, 10) || 0 : 0,
          ...(detachedStr === "true" ? { detached: true } : {}),
        }
      : {};

    // Find background vocal container (x-bg role)
    // Note: use getElementsByTagName for namespace compatibility
    const allSpansInP = p.getElementsByTagName("span");
    let bgContainer: XmlReadElement | null = null;
    for (const span of allSpansInP) {
      const role = span.getAttribute("ttm:role") || span.getAttributeNS("http://www.w3.org/ns/ttml#metadata", "role");
      if (role === "x-bg") {
        bgContainer = span;
        break;
      }
    }

    let backgroundText: string | undefined;
    let backgroundWords: WordTiming[] | undefined;
    let untimedBackground: UntimedLyric | undefined;
    let backgroundSpan: { backgroundBegin?: number; backgroundEnd?: number } = {};
    let untimedMain: UntimedLyric | undefined;
    const {
      words,
      text: timedText,
      lyric: timedMain,
    } = timedTrackText(extractTimedWords(p, bgContainer), p, splitChar);

    if (bgContainer) {
      const timedBackground = timedTrackText(extractTimedWords(bgContainer, null), bgContainer, splitChar);
      backgroundWords = timedBackground.words;
      if (backgroundWords.length > 0) {
        backgroundText = timedBackground.text;
        untimedBackground = timedBackground.lyric;
      } else {
        untimedBackground = untimedLyric(bgContainer);
        backgroundText = untimedBackground.text || undefined;
        backgroundSpan = untimedBackgroundSpan(bgContainer, begin, end, words.length === 0);
      }
    }

    // Imported background is authored content (not auto-extracted by this app);
    // stamp it manual so a later re-paste of parenthesised lyrics does not
    // double it, and so the provenance triple stays coherent.
    const backgroundTextSource: "manual" | undefined =
      backgroundText || (backgroundWords && backgroundWords.length > 0) ? "manual" : undefined;

    if (words.length > 0) {
      untimedMain = timedMain;
      lines.push(
        lineFromFields(
          {
            id: generateLineId(),
            text: timedText,
            agentId,
            words,
            backgroundText,
            backgroundWords,
            backgroundTextSource,
            ...backgroundSpan,
            ...groupFields,
          },
          splitChar,
        ),
      );
    } else {
      untimedMain = untimedLyric(p);
      const { text } = untimedMain;

      if (text) {
        lines.push(
          lineFromFields(
            {
              id: generateLineId(),
              text,
              agentId,
              ...untimedMainSpan(p, begin, end),
              backgroundText,
              backgroundWords,
              backgroundTextSource,
              ...backgroundSpan,
              ...groupFields,
            },
            splitChar,
          ),
        );
      }
    }
    if (lines.length > lineCountBefore) {
      const captured = withUntimedSpans(lines[lines.length - 1], untimedMain, untimedBackground, splitChar);
      lines[lines.length - 1] = withInlineAlternates(
        withParagraphCapture(captured, p, bgContainer, untimedAnchors(untimedMain, mainTrack(captured), splitChar)),
        p,
        bgContainer,
        splitChar,
      );
      lineByParagraph.set(p, lines[lines.length - 1]);
      lineKeys.push(lineKey ?? undefined);
    }
    if (lineKey && lines.length > lineCountBefore && !lineIndexByKey.has(lineKey)) {
      lineIndexByKey.set(lineKey, lines.length - 1);
    }
  }

  parseTtmlAlternates(doc, lines, lineIndexByKey, splitChar);
  const parts = partsFromDivs(doc, lineByParagraph, splitChar);
  const passthrough = docPassthrough(doc, lineByParagraph);

  return {
    lines,
    metadata,
    hasTimingData: lines.some((line) => isLineSynced(line) || isWordSynced(line)),
    agents: agents.length > 0 ? agents : undefined,
    groups: groups.length > 0 ? groups : undefined,
    lineKeys,
    madeInAmllTool: amllMetaEls.length > 0,
    issues: [],
    ...(parts.length > 0 && { parts }),
    ...(!isEmptyDocPassthrough(passthrough) && { passthrough }),
  };
}

// -- Exports ------------------------------------------------------------------

export { parseTtml };
