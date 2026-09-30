import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import type { Agent } from "@/domain/agent/model";
import type { LinkGroup } from "@/domain/group/template";
import { alignTrackToLine } from "@/domain/language/align";
import { type LyricLine, reconcileLine } from "@/domain/line/model";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { createGroup, createLine } from "@/test/factories";

// -- Types --------------------------------------------------------------------

interface EditedTtmlProject {
  name: string;
  lines: LyricLine[];
  groups: LinkGroup[];
  agents: Agent[];
  metadata: ProjectMetadata;
}

// -- Helpers ------------------------------------------------------------------

function withTransliteration(line: LyricLine, text: string): LyricLine {
  const track = {
    language: "ja-Latn",
    text,
    origin: "manual" as const,
    sourceFingerprint: `fp-${line.id}`,
    segments: [{ original: line.text, transliteration: text }],
  };
  return reconcileLine({ ...line, ...alignTrackToLine(line, track) });
}

// -- Fixtures -----------------------------------------------------------------

function chorusSong(): EditedTtmlProject {
  return {
    name: "a chorus song with groups, singers, syllables and translations",
    lines: [
      createLine({ id: "lead-blank", text: "" }),
      {
        ...createLine({ id: "intro", text: "Hel|lo there", begin: 1, end: 2.5, agentId: "v1" }),
        translations: {
          es: { language: "es", text: "Hola a todos", origin: "manual", sourceFingerprint: "fp-intro" },
          fr: { language: "fr", text: "", origin: "manual", sourceFingerprint: "fp-intro" },
        },
      },
      createLine({
        id: "verse",
        text: "Don't stop|ping",
        agentId: "v2",
        words: [
          { text: "Don't ", begin: 2.5, end: 3, explicit: true },
          { text: "stop", begin: 3, end: 3.4, syllableGroupId: "s1" },
          { text: "ping", begin: 3.4, end: 4.0004, syllableGroupId: "s1" },
        ],
        backgroundText: "yeah",
        backgroundTextSource: "manual",
        backgroundWords: [{ text: "yeah", begin: 3.2, end: 3.9 }],
      }),
      {
        ...createLine({
          id: "chorus-1",
          text: "La la|la",
          begin: 4,
          end: 5,
          groupId: "g1",
          instanceIdx: 0,
          templateLineIdx: 0,
        }),
        translations: {},
      },
      createLine({ id: "split-only", text: "|" }),
      createLine({
        id: "bridge",
        text: "Verse line",
        begin: 5,
        end: 6,
        backgroundText: "ooh",
        backgroundTextSource: "extraction",
      }),
      createLine({
        id: "chorus-2",
        text: "La la|la",
        begin: 7,
        end: 8,
        groupId: "g1",
        instanceIdx: 1,
        templateLineIdx: 0,
      }),
      createLine({ id: "spaces", text: "  " }),
      createLine({
        id: "outro",
        text: "End now",
        words: [
          { text: "End ", begin: 8, end: 8.5 },
          { text: "now", begin: 8.5, end: 9 },
        ],
      }),
    ],
    groups: [createGroup({ id: "g1", label: "Chorus", templateVersion: 2, sharesTiming: true, ownTimingInstances: [1] })],
    agents: [
      { id: "v1", type: "person", name: "Ana" },
      { id: "v2", type: "group" },
    ],
    metadata: {
      title: "Chorus song",
      artists: ["Ana", ""],
      album: "Album",
      duration: 0,
      songwriters: ["Cara"],
      language: "en",
      extra: { mood: "calm" },
    },
  };
}

function transliteratedSong(): EditedTtmlProject {
  return {
    name: "a transliterated song with repeated lines and mixed sync",
    lines: [
      {
        ...withTransliteration(createLine({ id: "greeting", text: "こんにちは", begin: 1, end: 2 }), "konnichiwa"),
        translations: {
          en: { language: "en", text: "Hello", origin: "google", sourceFingerprint: "fp-greeting", stale: true },
        },
      },
      withTransliteration(
        createLine({
          id: "farewell",
          text: "さよ|なら",
          words: [
            { text: "さよ", begin: 2, end: 2.5, syllableGroupId: "s2" },
            { text: "なら", begin: 2.5, end: 3, syllableGroupId: "s2" },
          ],
        }),
        "sayonara",
      ),
      createLine({
        id: "oh-1",
        text: "Oh oh",
        begin: 3,
        end: 4,
        backgroundText: "ah",
        groupId: "g2",
        instanceIdx: 0,
        templateLineIdx: 0,
      }),
      createLine({ id: "oh-2", text: "Oh oh", begin: 4, end: 5, groupId: "g2", instanceIdx: 1, templateLineIdx: 0 }),
      createLine({ id: "gap", text: "" }),
      createLine({ id: "last", text: "Mata ne", begin: 6, end: 7 }),
    ],
    groups: [createGroup({ id: "g2", label: "Hook", templateVersion: 1, sharesTiming: true })],
    agents: DEFAULT_AGENTS,
    metadata: { title: "Transliterated song", artists: ["Ken"], album: "", duration: 0, language: "ja" },
  };
}

const EDITED_TTML_PROJECTS: readonly (() => EditedTtmlProject)[] = [chorusSong, transliteratedSong];

// -- Exports ------------------------------------------------------------------

export { EDITED_TTML_PROJECTS };
export type { EditedTtmlProject };
