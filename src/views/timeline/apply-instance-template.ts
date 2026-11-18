import {
  type LineTemplate,
  offsetTemplateWords,
  templateBackgroundFields,
  templateLanguages,
} from "insync/group-template";
import { nextInstanceIdx } from "insync/instance-enumerate";
import { lineFromFields } from "insync/line-from-fields";
import type { LyricLine } from "insync/line";
import { withLinePassthrough } from "insync/line-passthrough";
import { getSplitCharacter } from "@/utils/split-character";

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
    const words = tplLine.words && offsetTemplateWords(tplLine.words, instanceStart);
    const backgroundWords = tplLine.backgroundWords && offsetTemplateWords(tplLine.backgroundWords, instanceStart);
    const instanceLine = lineFromFields(
      {
        id: line.id,
        text: tplLine.text,
        agentId: tplLine.agentId,
        groupId,
        instanceIdx,
        templateLineIdx: tplLine.slot ?? idx - startIndex,
        ...(tplLine.relativeBegin !== undefined && { begin: tplLine.relativeBegin + instanceStart }),
        ...(tplLine.relativeEnd !== undefined && { end: tplLine.relativeEnd + instanceStart }),
        ...(words && { words }),
        ...templateBackgroundFields(tplLine, backgroundWords),
        languages: templateLanguages(tplLine, words, backgroundWords),
      },
      getSplitCharacter(),
    );
    return withLinePassthrough(instanceLine, tplLine.passthrough);
  });

  return { updatedLines, instanceIdx };
}

// -- Exports -------------------------------------------------------------------

export { applyInstanceTemplate };
export type { InstanceApplyResult };
