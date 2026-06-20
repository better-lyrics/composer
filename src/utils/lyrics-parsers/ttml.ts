import type { Agent, AgentType } from "@/domain/agent/model";
import { applyBackground, setBackground } from "@/domain/line/background";
import type { LinkGroup } from "@/domain/group/template";
import { reconcileLine, type LyricLine } from "@/domain/line/model";
import { isLineSynced, isWordSynced } from "@/domain/line/predicates";
import { reconstructLineText } from "@/domain/line/reconstruct-text";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { inferSyllableGroupIds } from "@/domain/word/syllable-groups";
import { getSplitCharacter } from "@/utils/split-character";
import { declareMissingNamespaces, extractTimedWords, parseTtmlTimestamp } from "@/utils/lyrics-parsers/ttml-helpers";
import { generateLineId, type ParseResult } from "@/utils/lyrics-parsers/shared";

// -- Constants ----------------------------------------------------------------

const COMPOSER_NS = "https://composer.boidu.dev/ttml";
const TTM_METADATA_NS = "http://www.w3.org/ns/ttml#metadata";

// -- Background -----------------------------------------------------------------

function roleOf(el: Element): string | null {
  return el.getAttribute("ttm:role") || el.getAttributeNS(TTM_METADATA_NS, "role");
}

function findBackgroundContainer(p: Element): Element | null {
  for (const span of p.getElementsByTagName("span")) {
    if (roleOf(span) === "x-bg") return span;
  }
  return null;
}

function extractMainText(p: Element): string {
  let text = "";
  for (const node of p.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? "";
    } else if (node.nodeType === Node.ELEMENT_NODE && roleOf(node as Element) !== "x-bg") {
      text += (node as Element).textContent ?? "";
    }
  }
  return text.trim();
}

// Imported x-bg is authored content, so the granularity it was authored at is
// preserved verbatim rather than "corrected" against the main voice:
//   2+ timed spans -> word-synced (applyBackground returns words verbatim)
//   1 timed span   -> line-synced, carrying that span's begin/end and text
//                     directly (setBackground bypasses the resolver, which
//                     would wrongly distribute it over a word-synced main)
//   no timed spans -> untimed raw text, resolved against the main voice
// Source is stamped "manual" so a later re-paste of parenthesised lyrics does
// not double it and the provenance stays coherent.
function attachBackground(line: LyricLine, bgContainer: Element): LyricLine {
  const bgWords = inferSyllableGroupIds(extractTimedWords(bgContainer, null));

  if (bgWords.length >= 2) {
    return applyBackground(line, {
      words: bgWords,
      text: reconstructLineText(bgWords, getSplitCharacter()),
      source: "manual",
    });
  }

  if (bgWords.length === 1) {
    const span = bgWords[0];
    return setBackground(line, { text: span.text, begin: span.begin, end: span.end, source: "manual" });
  }

  const rawText = bgContainer.textContent?.trim();
  if (!rawText) return line;
  return applyBackground(line, { text: rawText, source: "manual" });
}

// -- TTML Parser --------------------------------------------------------------

function parseTtml(content: string, _fallbackDuration?: number): ParseResult {
  const metadata: Partial<ProjectMetadata> = {};
  const lines: LyricLine[] = [];

  const parser = new DOMParser();
  const unescapedContent = content.replace(/\\"/g, '"').replace(/\\n/g, "\n");
  const cleanedContent = declareMissingNamespaces(unescapedContent);
  const doc = parser.parseFromString(cleanedContent, "text/xml");

  // Check for parse errors
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    return { lines: [], metadata: {}, hasTimingData: false };
  }

  // Extract metadata (use getElementsByTagName for namespace compatibility)
  const titleEl = doc.getElementsByTagName("title")[0];
  if (titleEl?.textContent) metadata.title = titleEl.textContent;

  // Also check ttm:title for Apple Music format
  const ttmTitleEl = doc.getElementsByTagName("ttm:title")[0];
  if (ttmTitleEl?.textContent && !metadata.title) metadata.title = ttmTitleEl.textContent;

  const artistEl = doc.querySelector('[type="artist"]');
  if (artistEl?.textContent) metadata.artist = artistEl.textContent;

  const albumEl = doc.querySelector('[type="album"]');
  if (albumEl?.textContent) metadata.album = albumEl.textContent;

  // Extract agents from metadata
  const agents: Agent[] = [];
  const agentEls = doc.getElementsByTagName("ttm:agent");
  for (const el of agentEls) {
    const id = el.getAttribute("xml:id");
    const type = (el.getAttribute("type") as AgentType) || "person";
    const nameEl = el.getElementsByTagName("ttm:name")[0];
    const name = nameEl?.textContent || `Voice ${agents.length + 1}`;
    if (id) {
      agents.push({ id, type, name });
    }
  }

  // Parse composer:groups registry
  const groups: LinkGroup[] = [];
  const groupEls = Array.from(doc.getElementsByTagName("composer:group")).concat(
    Array.from(doc.getElementsByTagNameNS(COMPOSER_NS, "group")),
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
    groups.push({ id, label, color, templateVersion });
  }

  // Parse lyrics - look for <p> elements with timing
  const paragraphs = doc.getElementsByTagName("p");

  for (const p of paragraphs) {
    const begin = parseTtmlTimestamp(p.getAttribute("begin") ?? "");
    const end = parseTtmlTimestamp(p.getAttribute("end") ?? "");
    const agentId = p.getAttribute("ttm:agent")?.replace("#", "") ?? "v1";

    // Extract composer: group attrs (try plain attribute first, then namespaced lookup)
    const rawGroupId = p.getAttribute("composer:groupId") ?? p.getAttributeNS(COMPOSER_NS, "groupId") ?? null;
    const knownGroupId = rawGroupId && seenGroupIds.has(rawGroupId) ? rawGroupId : null;
    if (rawGroupId && !knownGroupId) {
      console.warn(`[Composer] TTML <p> references unknown groupId="${rawGroupId}"; treating line as standalone.`);
    }
    const instanceIdxStr =
      p.getAttribute("composer:instanceIdx") ?? p.getAttributeNS(COMPOSER_NS, "instanceIdx") ?? null;
    const templateLineIdxStr =
      p.getAttribute("composer:templateLineIdx") ?? p.getAttributeNS(COMPOSER_NS, "templateLineIdx") ?? null;
    const detachedStr = p.getAttribute("composer:detached") ?? p.getAttributeNS(COMPOSER_NS, "detached") ?? null;

    const groupFields = knownGroupId
      ? {
          groupId: knownGroupId,
          instanceIdx: instanceIdxStr ? Number.parseInt(instanceIdxStr, 10) || 0 : 0,
          templateLineIdx: templateLineIdxStr ? Number.parseInt(templateLineIdxStr, 10) || 0 : 0,
          ...(detachedStr === "true" ? { detached: true } : {}),
        }
      : {};

    const bgContainer = findBackgroundContainer(p);

    // Check for word-level timing (span elements NOT inside x-bg)
    const words = inferSyllableGroupIds(extractTimedWords(p, bgContainer));

    let baseLine: LyricLine | null = null;
    if (words.length > 0) {
      baseLine = reconcileLine({
        id: generateLineId(),
        text: reconstructLineText(words, getSplitCharacter()),
        agentId,
        words,
        ...groupFields,
      });
    } else {
      const text = extractMainText(p);
      if (text) {
        baseLine = reconcileLine({
          id: generateLineId(),
          text,
          agentId,
          begin: begin || undefined,
          end: end || undefined,
          ...groupFields,
        });
      }
    }

    if (baseLine) {
      lines.push(bgContainer ? attachBackground(baseLine, bgContainer) : baseLine);
    }
  }

  return {
    lines,
    metadata,
    hasTimingData: lines.some((l) => isLineSynced(l) || isWordSynced(l)),
    agents: agents.length > 0 ? agents : undefined,
    groups: groups.length > 0 ? groups : undefined,
  };
}

// -- Exports ------------------------------------------------------------------

export { parseTtml };
