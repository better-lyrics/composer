// -- Types --------------------------------------------------------------------

interface McpToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
}

// -- Schema pieces ------------------------------------------------------------

const PROJECT_ID = {
  type: "string",
  description:
    "The project to work on, from list_projects. Optional when only one project is open in Composer; required when several are.",
};

const LANGUAGE_LINES = {
  type: "array",
  minItems: 1,
  items: {
    type: "object",
    required: ["lineId", "text"],
    properties: {
      lineId: { type: "string" },
      text: { type: "string", description: "The line's main lyrics in this language. An empty string clears it." },
      backgroundText: {
        type: "string",
        description: "The line's background vocals in this language. Omit to keep what is there.",
      },
    },
  },
};

// -- Definitions --------------------------------------------------------------

const MCP_TOOL_DEFINITIONS: McpToolDefinition[] = [
  {
    name: "get_project",
    title: "Get project",
    description:
      "Summarize the open project: song details, lyric language, which translations and transliteration exist, and how many lines carry a warning in the Languages tab.",
    inputSchema: { type: "object", properties: { projectId: PROJECT_ID } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_lines",
    title: "Get lines",
    description: [
      "Read lyric lines with their timed syllables, transliteration, translations and warnings.",
      "Each syllable is one timing slot: `text` is the original lyrics in that slot, `transliteration` is the part of the reading currently mapped to it.",
      "Issue codes: transliteration-alignment-needs-review (the reading was split across syllables by estimate; check it and fix it with align_transliteration),",
      "transliteration-does-not-fit-syllables (no split could be estimated), transliteration-source-changed and translation-source-changed:<lang> (the lyrics changed after that text was written; rewrite it).",
    ].join(" "),
    inputSchema: {
      type: "object",
      properties: {
        projectId: PROJECT_ID,
        lineIds: { type: "array", items: { type: "string" }, description: "Only these lines." },
        withIssues: { type: "boolean", description: "Only lines that carry a warning." },
        offset: { type: "integer", minimum: 0, description: "Skip this many matching lines. Defaults to 0." },
        limit: { type: "integer", minimum: 1, maximum: 200, description: "At most this many lines. Defaults to 50." },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "set_transliterations",
    title: "Set transliterations",
    description: [
      "Write the romanized reading of lines, as sung. Use two spaces between words of the original lyrics and one space inside a word,",
      "for example `Mizu tamari ni  ashi o  tsukkonde`. Composer then estimates which part of the reading belongs to each timed syllable.",
      "The result lists each line's estimated split; when its alignment is needs-review or unresolved, confirm or correct it with align_transliteration.",
      "One undo step in Composer.",
    ].join(" "),
    inputSchema: {
      type: "object",
      required: ["lines"],
      properties: {
        projectId: PROJECT_ID,
        language: {
          type: "string",
          description:
            "BCP 47 tag with a script, such as ja-Latn. Defaults to the existing one, or the song language plus -Latn.",
        },
        lines: LANGUAGE_LINES,
      },
    },
  },
  {
    name: "set_translations",
    title: "Set translations",
    description: "Write a translation of lines into one language. One undo step in Composer.",
    inputSchema: {
      type: "object",
      required: ["language", "lines"],
      properties: {
        projectId: PROJECT_ID,
        language: { type: "string", description: "BCP 47 tag of the translation, such as en or pt-BR." },
        lines: LANGUAGE_LINES,
      },
    },
  },
  {
    name: "align_transliteration",
    title: "Align transliteration",
    description: [
      "Set which part of a line's transliteration is sung on each timed syllable, like the split points in Composer's Align dialog, and mark the line reviewed.",
      "Give one slice per syllable, in order. The slices must spell the transliteration in order; spaces and dashes between them are ignored.",
      "Example: syllables 水溜りに, 足を, 突っ込ん, で with reading `Mizu tamari ni  ashi o  tsukkonde` take slices",
      '["Mizu tamari ni", "ashi o", "tsukkon", "de"]. Use dryRun to preview. Lines that fail are reported and skipped; the rest are saved as one undo step.',
    ].join(" "),
    inputSchema: {
      type: "object",
      required: ["lines"],
      properties: {
        projectId: PROJECT_ID,
        dryRun: { type: "boolean", description: "Check and preview the mapping without saving it." },
        lines: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            required: ["lineId", "slices"],
            properties: {
              lineId: { type: "string" },
              part: {
                type: "string",
                enum: ["main", "background"],
                description: "Main lyrics or background vocals. Defaults to main.",
              },
              slices: { type: "array", items: { type: "string" }, minItems: 1 },
            },
          },
        },
      },
    },
  },
];

// -- Exports ------------------------------------------------------------------

export { MCP_TOOL_DEFINITIONS };
