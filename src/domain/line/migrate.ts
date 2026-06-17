import { reconcileLine, type LineIdentity, type LooseLine, type NestedLyricLine } from "@/domain/line/model";
import type { BackgroundVoice, Voice } from "@/domain/voice/model";
import { bgVoice, mainVoice } from "@/domain/line/voices";
import type { WordTiming } from "@/domain/word/timing";

// -- Helpers ------------------------------------------------------------------

function pickIdentity(source: Record<string, unknown>): LineIdentity {
  const identity: LineIdentity = { id: source.id as string, agentId: source.agentId as string };
  if (typeof source.groupId === "string") identity.groupId = source.groupId;
  if (typeof source.instanceIdx === "number") identity.instanceIdx = source.instanceIdx;
  if (typeof source.templateLineIdx === "number") identity.templateLineIdx = source.templateLineIdx;
  if (typeof source.detached === "boolean") identity.detached = source.detached;
  return identity;
}

function migrateFlat(source: Record<string, unknown>): NestedLyricLine {
  if (typeof source.text !== "string") throw new Error("migrateLine: flat line is missing a string `text`");
  const loose: LooseLine = {
    id: source.id as string,
    agentId: source.agentId as string,
    text: source.text,
  };
  if (typeof source.begin === "number") loose.begin = source.begin;
  if (typeof source.end === "number") loose.end = source.end;
  if (Array.isArray(source.words)) loose.words = source.words as WordTiming[];
  if (typeof source.backgroundText === "string") loose.backgroundText = source.backgroundText;
  if (Array.isArray(source.backgroundWords)) loose.backgroundWords = source.backgroundWords as WordTiming[];
  if (source.backgroundTextSource === "extraction" || source.backgroundTextSource === "manual") {
    loose.backgroundTextSource = source.backgroundTextSource;
  }
  const reconciled = reconcileLine(loose);
  const background = bgVoice(reconciled);
  const result: NestedLyricLine = { ...pickIdentity(source), main: mainVoice(reconciled) };
  if (background !== null) result.background = background;
  return result;
}

function migrateNested(source: Record<string, unknown>, main: Record<string, unknown>): NestedLyricLine {
  if (typeof main.text !== "string") throw new Error("migrateLine: nested line `main` is missing a string `text`");
  const result: NestedLyricLine = { ...pickIdentity(source), main: main as Voice };
  if (source.background !== undefined) result.background = source.background as BackgroundVoice;
  return result;
}

// -- Functions ----------------------------------------------------------------

function migrateLine(input: unknown): NestedLyricLine {
  if (typeof input !== "object" || input === null) {
    throw new Error("migrateLine: input must be a non-null object");
  }
  const source = input as Record<string, unknown>;
  if (typeof source.id !== "string") throw new Error("migrateLine: line is missing a string `id`");
  if (typeof source.agentId !== "string") throw new Error("migrateLine: line is missing a string `agentId`");
  if (typeof source.main === "object" && source.main !== null) {
    return migrateNested(source, source.main as Record<string, unknown>);
  }
  if (source.main !== undefined) throw new Error("migrateLine: nested line `main` must be an object");
  return migrateFlat(source);
}

// -- Exports ------------------------------------------------------------------

export { migrateLine };
