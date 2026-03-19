import type { Agent, AgentType, LyricLine, ProjectMetadata, WordTiming } from "@/stores/project";
import { splitWordsByPipe } from "@/utils/split-by-pipe";

// -- Types --------------------------------------------------------------------

interface ParseResult {
  lines: LyricLine[];
  metadata: Partial<ProjectMetadata>;
  hasTimingData: boolean;
  agents?: Agent[];
}

type LyricsFileType = "txt" | "lrc" | "srt" | "ttml" | "unknown";

// -- Helpers ------------------------------------------------------------------

function generateLineId(): string {
  return crypto.randomUUID();
}

function detectFileType(filename: string, content: string): LyricsFileType {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "txt") return "txt";
  if (ext === "lrc") return "lrc";
  if (ext === "srt") return "srt";
  if (ext === "ttml" || ext === "xml") {
    if (content.includes("<tt") || content.includes("xmlns:tt")) {
      return "ttml";
    }
  }
  // Try to detect by content
  if (content.includes("<tt") || content.includes("xmlns:tt")) return "ttml";
  if (/^\[\d{1,2}:\d{2}/.test(content)) return "lrc";
  if (/^\d+\r?\n\d{2}:\d{2}:\d{2}/.test(content)) return "srt";
  return "txt";
}

// -- Plain Text Parser --------------------------------------------------------

function parseTxt(content: string): ParseResult {
  const lines = content
    .split(/\r?\n/)
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .map((text) => {
      const displayText = text.includes("|") ? splitWordsByPipe(text).join("").trimEnd() : text;
      return {
        id: generateLineId(),
        text: displayText,
        agentId: "v1",
      };
    });

  return {
    lines,
    metadata: {},
    hasTimingData: false,
  };
}

// -- LRC Parser ---------------------------------------------------------------

function parseLrcTimestamp(timestamp: string): number {
  // Format: [mm:ss.xx] or [mm:ss:xx] or [mm:ss]
  const match = timestamp.match(/\[(\d{1,2}):(\d{2})(?:[.:](\d{2,3}))?\]/);
  if (!match) return 0;
  const minutes = Number.parseInt(match[1], 10);
  const seconds = Number.parseInt(match[2], 10);
  const ms = match[3] ? Number.parseInt(match[3].padEnd(3, "0"), 10) : 0;
  return minutes * 60 + seconds + ms / 1000;
}

function parseLrc(content: string): ParseResult {
  const metadata: Partial<ProjectMetadata> = {};
  const lines: LyricLine[] = [];

  const rawLines = content.split(/\r?\n/);

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Parse metadata tags
    const metaMatch = trimmed.match(/^\[([a-z]+):(.+)\]$/i);
    if (metaMatch) {
      const [, tag, value] = metaMatch;
      const tagLower = tag.toLowerCase();
      if (tagLower === "ti" || tagLower === "title") {
        metadata.title = value.trim();
      } else if (tagLower === "ar" || tagLower === "artist") {
        metadata.artist = value.trim();
      } else if (tagLower === "al" || tagLower === "album") {
        metadata.album = value.trim();
      }
      continue;
    }

    // Parse timed lyrics - can have multiple timestamps per line
    const timestampRegex = /\[(\d{1,2}:\d{2}(?:[.:]\d{2,3})?)\]/g;
    const timestamps: number[] = [];
    const matches = trimmed.matchAll(timestampRegex);

    for (const match of matches) {
      timestamps.push(parseLrcTimestamp(`[${match[1]}]`));
    }

    if (timestamps.length > 0) {
      const text = trimmed.replace(timestampRegex, "").trim();
      if (text) {
        // Create a line for each timestamp (some LRC files have multiple timestamps per text)
        for (const begin of timestamps) {
          lines.push({
            id: generateLineId(),
            text,
            agentId: "v1",
            begin,
          });
        }
      }
    }
  }

  // Sort by begin time and calculate end times
  lines.sort((a, b) => (a.begin ?? 0) - (b.begin ?? 0));
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].begin !== undefined) {
      lines[i].end = lines[i + 1].begin;
    }
  }

  return {
    lines,
    metadata,
    hasTimingData: lines.some((l) => l.begin !== undefined),
  };
}

// -- SRT Parser ---------------------------------------------------------------

function parseSrtTimestamp(timestamp: string): number {
  // Format: HH:MM:SS,mmm or HH:MM:SS.mmm
  const match = timestamp.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
  if (!match) return 0;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const seconds = Number.parseInt(match[3], 10);
  const ms = Number.parseInt(match[4], 10);
  return hours * 3600 + minutes * 60 + seconds + ms / 1000;
}

function parseSrt(content: string): ParseResult {
  const lines: LyricLine[] = [];
  const blocks = content.split(/\r?\n\r?\n/);

  for (const block of blocks) {
    const blockLines = block.trim().split(/\r?\n/);
    if (blockLines.length < 2) continue;

    // First line is index (skip), second is timestamps
    const timestampLine = blockLines.find((l) => l.includes("-->"));
    if (!timestampLine) continue;

    const [startStr, endStr] = timestampLine.split("-->");
    const begin = parseSrtTimestamp(startStr.trim());
    const end = parseSrtTimestamp(endStr.trim());

    // Remaining lines are text (join with space, strip HTML tags)
    const textLines = blockLines.slice(blockLines.indexOf(timestampLine) + 1);
    const text = textLines
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();

    if (text) {
      lines.push({
        id: generateLineId(),
        text,
        agentId: "v1",
        begin,
        end,
      });
    }
  }

  return {
    lines,
    metadata: {},
    hasTimingData: lines.some((l) => l.begin !== undefined),
  };
}

// -- TTML Parser --------------------------------------------------------------

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
          words.push({ text, begin, end });
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

function parseTtml(content: string): ParseResult {
  const metadata: Partial<ProjectMetadata> = {};
  const lines: LyricLine[] = [];

  const parser = new DOMParser();
  // Clean escaped quotes that might come from JSON-escaped content
  const cleanedContent = content.replace(/\\"/g, '"').replace(/\\n/g, "\n");
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

  // Parse lyrics - look for <p> elements with timing
  const paragraphs = doc.getElementsByTagName("p");

  for (const p of paragraphs) {
    const begin = parseTtmlTimestamp(p.getAttribute("begin") ?? "");
    const end = parseTtmlTimestamp(p.getAttribute("end") ?? "");
    const agentId = p.getAttribute("ttm:agent")?.replace("#", "") ?? "v1";

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
      backgroundWords = extractTimedWords(bgContainer, null);
      if (backgroundWords.length > 0) {
        backgroundText = backgroundWords.map((w) => w.text).join("");
      } else {
        backgroundText = bgContainer.textContent || undefined;
      }
    }

    // Check for word-level timing (span elements NOT inside x-bg)
    const words = extractTimedWords(p, bgContainer);

    if (words.length > 0) {
      lines.push({
        id: generateLineId(),
        // Concatenate without adding spaces - trailing spaces are embedded
        text: words.map((w) => w.text).join(""),
        agentId,
        begin: words[0].begin,
        end: words[words.length - 1].end,
        words,
        backgroundText,
        backgroundWords,
      });
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
        lines.push({
          id: generateLineId(),
          text,
          agentId,
          begin: begin || undefined,
          end: end || undefined,
          backgroundText,
          backgroundWords,
        });
      }
    }
  }

  return {
    lines,
    metadata,
    hasTimingData: lines.some((l) => l.begin !== undefined || l.words?.length),
    agents: agents.length > 0 ? agents : undefined,
  };
}

// -- Main Parser --------------------------------------------------------------

function parseLyricsFile(filename: string, content: string): ParseResult {
  const fileType = detectFileType(filename, content);

  switch (fileType) {
    case "lrc":
      return parseLrc(content);
    case "srt":
      return parseSrt(content);
    case "ttml":
      return parseTtml(content);
    default:
      return parseTxt(content);
  }
}

// -- Exports ------------------------------------------------------------------

export { detectFileType, parseLyricsFile };
export type { LyricsFileType, ParseResult };
