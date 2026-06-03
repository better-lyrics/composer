import type { LyricLine, RomanizationData } from "@/domain/line/model";
import { romanizeLines, type RomanizeLine, type RomanizeResult, TurnstileError } from "@/lib/romanization-api";
import { useProjectStore } from "@/stores/project";
import { getRomanizationTurnstileSiteKey } from "@/stores/settings";
import { runTurnstile } from "@/utils/turnstile";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Composer:romanization]";

// -- Types --------------------------------------------------------------------

interface BulkResult {
  successCount: number;
  failureCount: number;
}

// -- Helpers ------------------------------------------------------------------

function lineToPayload(line: LyricLine): RomanizeLine {
  const payload: RomanizeLine = { id: line.id, text: line.text };
  if (line.words?.length) payload.words = line.words.map((word) => word.text);
  return payload;
}

async function acquireToken(): Promise<string> {
  const sitekey = getRomanizationTurnstileSiteKey();
  if (!sitekey) throw new TurnstileError();
  return runTurnstile(sitekey);
}

function applyResult(result: RomanizeResult): void {
  const line = useProjectStore.getState().lines.find((candidate) => candidate.id === result.id);
  if (!line) return;
  const data: RomanizationData = {
    text: result.text,
    source: "generated",
    ...(result.wordTexts ? { wordTexts: result.wordTexts } : {}),
    ...(result.engine ? { engine: result.engine } : {}),
  };
  useProjectStore.getState().setLineRomanizationWithHistory(result.id, data);
  console.info(LOG_PREFIX, `applied result for ${result.id}: engine=${result.engine} tier=${result.tier}`);
}

function resolveWordTexts(line: LyricLine, generated: string, wordIndex: number): string[] {
  const wordCount = line.words?.length ?? 0;
  const existing = line.romanization?.wordTexts;
  const base = existing?.length === wordCount ? [...existing] : new Array<string>(wordCount).fill("");
  base[wordIndex] = generated;
  return base;
}

// -- Public API ---------------------------------------------------------------

async function generateForLines(
  scheme: string,
  lines: readonly LyricLine[],
  signal?: AbortSignal,
): Promise<BulkResult> {
  const token = await acquireToken();
  const response = await romanizeLines({
    scheme,
    lines: lines.map(lineToPayload),
    turnstileToken: token,
    signal,
  });
  for (const result of response.results) applyResult(result);
  return { successCount: response.results.length, failureCount: response.errors.length };
}

async function generateForLine(scheme: string, line: LyricLine, signal?: AbortSignal): Promise<BulkResult> {
  return generateForLines(scheme, [line], signal);
}

async function generateForWord(
  scheme: string,
  line: LyricLine,
  wordIndex: number,
  signal?: AbortSignal,
): Promise<BulkResult> {
  const word = line.words?.[wordIndex];
  if (!word) return { successCount: 0, failureCount: 1 };
  const token = await acquireToken();
  const response = await romanizeLines({
    scheme,
    lines: [{ id: line.id, text: word.text }],
    turnstileToken: token,
    signal,
  });
  if (response.results.length === 0) return { successCount: 0, failureCount: 1 };
  const result = response.results[0];
  const wordTexts = resolveWordTexts(line, result.text, wordIndex);
  const data: RomanizationData = {
    text: wordTexts.join(" "),
    wordTexts,
    source: "generated",
    ...(result.engine ? { engine: result.engine } : {}),
  };
  useProjectStore.getState().setLineRomanizationWithHistory(line.id, data);
  console.info(LOG_PREFIX, `applied result for ${line.id}: engine=${result.engine} tier=${result.tier}`);
  return { successCount: 1, failureCount: 0 };
}

// -- Exports ------------------------------------------------------------------

export { generateForLine, generateForLines, generateForWord };
export type { BulkResult };
