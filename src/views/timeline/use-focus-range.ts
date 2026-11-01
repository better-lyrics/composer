import type { Bounds } from "@/domain/word/bounds";
import { useProjectStore } from "@/stores/project";
import { useEffectiveFocus } from "@/views/timeline/effective-focus";
import { focusBounds } from "@/views/timeline/group-focus";
import { useMemo } from "react";

// -- Hook ---------------------------------------------------------------------

function useFocusRange(): Bounds | null {
  const focus = useEffectiveFocus();
  const begin = useProjectStore((s) => (focus ? focusBounds(s.lines, focus)?.begin : undefined));
  const end = useProjectStore((s) => (focus ? focusBounds(s.lines, focus)?.end : undefined));
  return useMemo(() => (begin === undefined || end === undefined ? null : { begin, end }), [begin, end]);
}

// -- Exports ------------------------------------------------------------------

export { useFocusRange };
