import { type LineTemplate, offsetTemplateWords } from "@/domain/group/template";
import { nextInstanceIdx } from "@/domain/instance/enumerate";
import { type LyricLine, reconcileLine } from "@/domain/line/model";

// -- Interfaces ----------------------------------------------------------------

interface ApplyInstanceTemplateInput {
  lines: LyricLine[];
  groupId: string;
  template: LineTemplate[];
  startIndex: number;
  instanceStart: number;
}

interface AppliedInstance {
  updatedLines: LyricLine[];
  instanceIdx: number;
}

interface InstanceApplyResult<Reason extends string> {
  ok: boolean;
  reason?: Reason;
  updatedLines?: LyricLine[];
  instanceIdx?: number;
}

// -- Functions -----------------------------------------------------------------

// Stamps a group template onto the `template.length` rows starting at
// `startIndex` as a fresh instance. Callers own eligibility: this overwrites
// whatever text and timing those rows already hold.
function applyInstanceTemplate({
  lines,
  groupId,
  template,
  startIndex,
  instanceStart,
}: ApplyInstanceTemplateInput): AppliedInstance {
  const instanceIdx = nextInstanceIdx(lines, groupId);
  const endIndex = startIndex + template.length;

  const updatedLines = lines.map((line, idx) => {
    if (idx < startIndex || idx >= endIndex) return line;
    const tplLine = template[idx - startIndex];
    return reconcileLine({
      ...line,
      text: tplLine.text,
      agentId: tplLine.agentId,
      groupId,
      instanceIdx,
      templateLineIdx: idx - startIndex,
      detached: undefined,
      ...(tplLine.relativeBegin !== undefined
        ? { begin: tplLine.relativeBegin + instanceStart }
        : { begin: undefined }),
      ...(tplLine.relativeEnd !== undefined ? { end: tplLine.relativeEnd + instanceStart } : { end: undefined }),
      ...(tplLine.words ? { words: offsetTemplateWords(tplLine.words, instanceStart) } : { words: undefined }),
      ...(tplLine.backgroundText !== undefined
        ? { backgroundText: tplLine.backgroundText }
        : { backgroundText: undefined }),
      ...(tplLine.backgroundWords
        ? { backgroundWords: offsetTemplateWords(tplLine.backgroundWords, instanceStart) }
        : { backgroundWords: undefined }),
      backgroundTextSource: tplLine.backgroundTextSource,
      translations: tplLine.translations && structuredClone(tplLine.translations),
      transliteration: tplLine.transliteration && structuredClone(tplLine.transliteration),
    });
  });

  return { updatedLines, instanceIdx };
}

// -- Exports -------------------------------------------------------------------

export { applyInstanceTemplate };
export type { InstanceApplyResult };
