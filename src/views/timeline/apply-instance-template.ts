import { nextInstanceIdx } from "@/domain/instance/enumerate";
import type { LineTemplate, WordTemplate } from "@/domain/group/template";
import { reconcileLine, type LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";

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

function offsetWords(words: WordTemplate[], instanceStart: number): WordTiming[] {
  return words.map((word) => ({
    text: word.text,
    begin: word.relativeBegin + instanceStart,
    end: word.relativeEnd + instanceStart,
  }));
}

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
      ...(tplLine.words ? { words: offsetWords(tplLine.words, instanceStart) } : { words: undefined }),
      ...(tplLine.backgroundText !== undefined
        ? { backgroundText: tplLine.backgroundText }
        : { backgroundText: undefined }),
      ...(tplLine.backgroundWords
        ? { backgroundWords: offsetWords(tplLine.backgroundWords, instanceStart) }
        : { backgroundWords: undefined }),
      backgroundTextSource: tplLine.backgroundTextSource,
    });
  });

  return { updatedLines, instanceIdx };
}

// -- Exports -------------------------------------------------------------------

export { applyInstanceTemplate };
export type { InstanceApplyResult };
