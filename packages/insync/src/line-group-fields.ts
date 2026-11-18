import type { LyricLine } from "./line";

// -- Types --------------------------------------------------------------------

type LineGroupFields = Pick<LyricLine, "groupId" | "instanceIdx" | "templateLineIdx" | "detached">;

// -- Functions ----------------------------------------------------------------

// The fields that place a line in a link group, copied only where they are set.
function groupFieldsOf(source: LineGroupFields): LineGroupFields {
  return {
    ...(source.groupId !== undefined && { groupId: source.groupId }),
    ...(source.instanceIdx !== undefined && { instanceIdx: source.instanceIdx }),
    ...(source.templateLineIdx !== undefined && { templateLineIdx: source.templateLineIdx }),
    ...(source.detached !== undefined && { detached: source.detached }),
  };
}

// -- Exports ------------------------------------------------------------------

export { groupFieldsOf };
