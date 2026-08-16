import type { LineTemplate } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import { applyInstanceTemplate, type InstanceApplyResult } from "@/views/timeline/apply-instance-template";

type FillFailure = "not_enough_empty_lines" | "out_of_range";

type FillResult = InstanceApplyResult<FillFailure>;

interface FillInput {
  lines: LyricLine[];
  groupId: string;
  template: LineTemplate[];
  startIndex: number;
  instanceStart: number;
}

function isEmptyFillable(line: LyricLine): boolean {
  return line.groupId === undefined && (!line.words || line.words.length === 0);
}

function fillEmptyLinesWithInstance(input: FillInput): FillResult {
  const { lines, groupId, template, startIndex, instanceStart } = input;

  if (startIndex < 0 || startIndex + template.length > lines.length) {
    return { ok: false, reason: "out_of_range" };
  }

  for (let i = 0; i < template.length; i++) {
    const target = lines[startIndex + i];
    if (!isEmptyFillable(target)) {
      return { ok: false, reason: "not_enough_empty_lines" };
    }
  }

  const { updatedLines, instanceIdx } = applyInstanceTemplate({
    lines,
    groupId,
    template,
    startIndex,
    instanceStart,
  });

  return { ok: true, updatedLines, instanceIdx };
}

export { fillEmptyLinesWithInstance, isEmptyFillable };
