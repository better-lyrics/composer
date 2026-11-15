import { withAlignedWords } from "./language-align";
import { regroupedLanguages } from "./language-pieces";
import { withManualBackgroundWords } from "./line-background";
import { explicitFieldWords } from "./line-drawn-track";
import type { LyricLine } from "./line";
import { fieldRole, fieldWords, type TrackField } from "./line-track";
import { withRoleWords } from "./line-track-writes";
import { mergedWord } from "./word-merge-run";
import { computeSyllableGroups, expandSelectionToGroupmates } from "./word-syllable-groups";
import type { WordTiming } from "./word-timing";

// -- Types --------------------------------------------------------------------

type ExplicitTarget = { lineId: string; field: TrackField; wordIndex: number };

// -- Helpers ------------------------------------------------------------------

// A field-targeted word write that keeps background provenance coherent: writing
// the backgroundWords track is a user edit, so it routes through the funnel and
// stamps source "manual". A main-words write carries no provenance.
function withFieldWords(line: LyricLine, field: TrackField, words: WordTiming[], splitChar: string): LyricLine {
  if (field === "backgroundWords") return withManualBackgroundWords(line, words, splitChar);
  return withRoleWords(line, "main", words);
}

function expandTargetsToSyllableGroups(
  targets: ExplicitTarget[],
  linesById: Map<string, LyricLine>,
  splitChar: string,
): ExplicitTarget[] {
  const byLineField = new Map<string, { lineId: string; field: TrackField; indices: number[] }>();
  for (const t of targets) {
    const key = `${t.lineId}:${t.field}`;
    const existing = byLineField.get(key);
    if (existing) existing.indices.push(t.wordIndex);
    else byLineField.set(key, { lineId: t.lineId, field: t.field, indices: [t.wordIndex] });
  }
  const out: ExplicitTarget[] = [];
  for (const group of byLineField.values()) {
    const line = linesById.get(group.lineId);
    const currentWords = line && explicitFieldWords(line, group.field, splitChar);
    const expanded = currentWords ? expandSelectionToGroupmates(currentWords, group.indices) : group.indices;
    for (const idx of expanded) out.push({ lineId: group.lineId, field: group.field, wordIndex: idx });
  }
  return out;
}

function applyExplicitTargetToLines(
  lines: LyricLine[],
  lineId: string,
  field: TrackField,
  newWords: WordTiming[],
  splitChar: string,
): LyricLine[] {
  const target = lines.find((l) => l.id === lineId);
  if (!target) return lines;
  return lines.map((line) => (line.id === lineId ? withFieldWords(line, field, newWords, splitChar) : line));
}

function applyMergeSyllableGroup(
  lines: LyricLine[],
  lineId: string,
  field: TrackField,
  wordIndices: number[],
  splitChar: string,
): LyricLine[] | null {
  const target = lines.find((l) => l.id === lineId);
  if (!target) return null;
  const sourceWords = fieldWords(target, field);
  if (!sourceWords || sourceWords.length === 0) return null;
  const sourceCount = sourceWords.length;
  const selected = new Set(wordIndices.filter((i) => i >= 0 && i < sourceCount));
  if (selected.size === 0) return null;

  let mutated = false;
  const newLines = lines.map((line) => {
    if (line.id !== lineId) return line;
    const aligned = withAlignedWords(line, splitChar);
    const lineWords = fieldWords(aligned, field);
    if (!lineWords) return line;

    const runs = computeSyllableGroups(lineWords);
    const collapsed: WordTiming[] = [];
    let changed = false;
    let runIdx = 0;
    let i = 0;
    while (i < lineWords.length) {
      const run = runs[runIdx];
      if (!run || run.startIndex !== i) {
        collapsed.push(lineWords[i]);
        i++;
        continue;
      }
      runIdx++;
      let touched = false;
      for (let k = run.startIndex; k <= run.endIndex; k++) if (selected.has(k)) touched = true;
      if (touched) {
        collapsed.push(mergedWord(lineWords.slice(run.startIndex, run.endIndex + 1)));
        changed = true;
      } else {
        for (let k = run.startIndex; k <= run.endIndex; k++) collapsed.push(lineWords[k]);
      }
      i = run.endIndex + 1;
    }
    if (!changed) return line;
    mutated = true;
    const languages = regroupedLanguages(line, aligned, fieldRole(field), lineWords, collapsed);
    return withFieldWords({ ...line, languages }, field, collapsed, splitChar);
  });
  if (!mutated) return null;
  return newLines;
}

function applyMarkWordsExplicit(
  lines: LyricLine[],
  targets: ExplicitTarget[],
  value: boolean,
  splitChar: string,
): LyricLine[] | null {
  if (targets.length === 0) return null;
  let current = lines;
  let changed = false;
  const linesById = new Map<string, LyricLine>();
  for (const l of current) linesById.set(l.id, l);

  const expandedTargets = expandTargetsToSyllableGroups(targets, linesById, splitChar);

  for (const target of expandedTargets) {
    const line = linesById.get(target.lineId);
    if (!line) continue;
    const currentWords = explicitFieldWords(line, target.field, splitChar);
    if (!currentWords || target.wordIndex < 0 || target.wordIndex >= currentWords.length) continue;
    if ((currentWords[target.wordIndex].explicit === true) === value) continue;

    const newWords: WordTiming[] = currentWords.map((word, i) => {
      if (i !== target.wordIndex) return word;
      if (value) return { ...word, explicit: true as const };
      const { explicit: _explicit, ...rest } = word;
      return rest;
    });

    const before = current;
    current = applyExplicitTargetToLines(current, target.lineId, target.field, newWords, splitChar);
    for (let i = 0; i < current.length; i++) {
      if (current[i] !== before[i]) linesById.set(current[i].id, current[i]);
    }
    changed = true;
  }
  if (!changed) return null;
  return current;
}

// -- Exports ------------------------------------------------------------------

export type { ExplicitTarget };
export { applyMarkWordsExplicit, applyMergeSyllableGroup, withFieldWords };
