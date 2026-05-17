import type { Agent, AgentType } from "@/domain/agent/model";
import type { LinkGroup } from "@/domain/group/template";
import { reconcileLine, type LyricLine } from "@/domain/line/model";
import { reconstructLineText } from "@/domain/line/reconstruct-text";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { inferSyllableGroupIds } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";
import { getSplitCharacter } from "@/utils/split-character";
import { generateLineId, type ParseResult } from "@/utils/lyrics-parsers/shared";

// -- Constants ----------------------------------------------------------------

const COMPOSER_NS = "https://composer.boidu.dev/ttml";

const ELEMENT_PREFIX_REGEX = /<\/?([A-Za-z][\w.-]*):/g;
const ATTRIBUTE_PREFIX_REGEX = /\s([A-Za-z][\w.-]*):[\w.-]+\s*=/g;
const DECLARED_PREFIX_REGEX = /xmlns:([A-Za-z][\w.-]*)\s*=/g;
const ROOT_TT_TAG_REGEX = /<tt\b[^>]*>/;

// -- Helpers ------------------------------------------------------------------

function declareMissingNamespaces(content: string): string {
  const rootMatch = content.match(ROOT_TT_TAG_REGEX);
  if (!rootMatch) return content;

  const rootTag = rootMatch[0];
  const declared = new Set<string>(["xml", "xmlns"]);
  for (const match of rootTag.matchAll(DECLARED_PREFIX_REGEX)) {
    declared.add(match[1]);
  }

  const used = new Set<string>();
  for (const match of content.matchAll(ELEMENT_PREFIX_REGEX)) {
    used.add(match[1]);
  }
  for (const match of content.matchAll(ATTRIBUTE_PREFIX_REGEX)) {
    used.add(match[1]);
  }

  const missing: string[] = [];
  for (const prefix of used) {
    if (!declared.has(prefix)) missing.push(prefix);
  }
  if (missing.length === 0) return content;

  const additions = missing.map((prefix) => ` xmlns:${prefix}="urn:composer:unbound:${prefix}"`).join("");
  const patchedRootTag = rootTag.replace(/>$/, `${additions}>`);
  return content.replace(rootTag, patchedRootTag);
}

function parseTtmlTimestamp(timestamp: string): number {
  // Format: HH:MM:SS.mmm or MM:SS.mmm or SS.mmm
  if (!timestamp) return 0;

  const parts = timestamp.split(":");
  if (parts.length === 3) {
    // HH:MM:SS.mmm
    const hours = Number.parseInt(parts[0], 10);
    const minutes = Number.parseInt(parts[1], 10);
    const [secs, ms] = parts[2].split(".");
    const seconds = Number.parseInt(secs, 10);
    const millis = ms ? Number.parseInt(ms.padEnd(3, "0"), 10) : 0;
    return hours * 3600 + minutes * 60 + seconds + millis / 1000;
  }
  if (parts.length === 2) {
    // MM:SS.mmm
    const minutes = Number.parseInt(parts[0], 10);
    const [secs, ms] = parts[1].split(".");
    const seconds = Number.parseInt(secs, 10);
    const millis = ms ? Number.parseInt(ms.padEnd(3, "0"), 10) : 0;
    return minutes * 60 + seconds + millis / 1000;
  }
  // SS.mmm
  const [secs, ms] = timestamp.split(".");
  const seconds = Number.parseInt(secs, 10);
  const millis = ms ? Number.parseInt(ms.padEnd(3, "0"), 10) : 0;
  return seconds + millis / 1000;
}

function readExplicitFlag(el: Element): boolean {
  for (const attr of el.attributes) {
    const local = (attr.localName ?? attr.name).toLowerCase();
    if (local === "explicit" || local === "obscene") {
      const raw = (attr.value ?? "").trim().toLowerCase();
      if (raw === "" || raw === "true" || raw === "1" || raw === "yes") return true;
      return false;
    }
  }
  return false;
}

function extractTimedWords(parent: Element, excludeContainer?: Element | null): WordTiming[] {
  const words: WordTiming[] = [];

  for (const node of parent.childNodes) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const role = el.getAttribute("ttm:role") || el.getAttributeNS("http://www.w3.org/ns/ttml#metadata", "role");

      // Skip x-bg containers (handled separately)
      if (role === "x-bg" || excludeContainer?.contains(el)) continue;

      // Handle span with timing
      if (el.tagName.toLowerCase() === "span" && el.hasAttribute("begin")) {
        const begin = parseTtmlTimestamp(el.getAttribute("begin") ?? "");
        const end = parseTtmlTimestamp(el.getAttribute("end") ?? "");
        const text = el.textContent ?? "";
        if (text.trim()) {
          const word: WordTiming = { text, begin, end };
          if (readExplicitFlag(el)) word.explicit = true;
          words.push(word);
        }
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      // Whitespace between spans - append to preceding word
      const content = node.textContent ?? "";
      if (/\s/.test(content) && words.length > 0) {
        const lastWord = words[words.length - 1];
        if (!lastWord.text.endsWith(" ")) {
          lastWord.text += " ";
        }
      }
    }
  }

  return words;
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

    // Find background vocal container (x-bg role)
    // Note: use getElementsByTagName for namespace compatibility
    const allSpansInP = p.getElementsByTagName("span");
    let bgContainer: Element | null = null;
    for (const span of allSpansInP) {
      const role = span.getAttribute("ttm:role") || span.getAttributeNS("http://www.w3.org/ns/ttml#metadata", "role");
      if (role === "x-bg") {
        bgContainer = span;
        break;
      }
    }

    let backgroundText: string | undefined;
    let backgroundWords: WordTiming[] | undefined;

    if (bgContainer) {
      backgroundWords = inferSyllableGroupIds(extractTimedWords(bgContainer, null));
      if (backgroundWords.length > 0) {
        backgroundText = reconstructLineText(backgroundWords, getSplitCharacter());
      } else {
        backgroundText = bgContainer.textContent || undefined;
      }
    }

    // Check for word-level timing (span elements NOT inside x-bg)
    const words = inferSyllableGroupIds(extractTimedWords(p, bgContainer));

    if (words.length > 0) {
      lines.push(
        reconcileLine({
          id: generateLineId(),
          text: reconstructLineText(words, getSplitCharacter()),
          agentId,
          words,
          backgroundText,
          backgroundWords,
          ...groupFields,
        }),
      );
    } else {
      // Line-level timing only - extract text without bg content
      let text = "";
      for (const node of p.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent ?? "";
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          const role = el.getAttribute("ttm:role") || el.getAttributeNS("http://www.w3.org/ns/ttml#metadata", "role");
          if (role !== "x-bg") {
            text += el.textContent ?? "";
          }
        }
      }
      text = text.trim();

      if (text) {
        lines.push(
          reconcileLine({
            id: generateLineId(),
            text,
            agentId,
            begin: begin || undefined,
            end: end || undefined,
            backgroundText,
            backgroundWords,
            ...groupFields,
          }),
        );
      }
    }
  }

  return {
    lines,
    metadata,
    hasTimingData: lines.some((l) => l.begin !== undefined || l.words?.length),
    agents: agents.length > 0 ? agents : undefined,
    groups: groups.length > 0 ? groups : undefined,
  };
}

// -- Exports ------------------------------------------------------------------

export { parseTtml };
