// -- Types --------------------------------------------------------------------

interface ParenGroup {
  inner: string;
  start: number;
  end: number;
}

type ParenScanStatus = "balanced" | "unbalanced" | "nested";

interface ParenScan {
  status: ParenScanStatus;
  groups: ParenGroup[];
}

// -- Scanner ------------------------------------------------------------------

function scanParenGroups(text: string): ParenScan {
  const groups: ParenGroup[] = [];
  let depth = 0;
  let openIndex = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") {
      depth++;
      if (depth > 1) return { status: "nested", groups: [] };
      openIndex = i;
    } else if (ch === ")") {
      depth--;
      if (depth < 0) return { status: "unbalanced", groups: [] };
      groups.push({ inner: text.slice(openIndex + 1, i), start: openIndex, end: i });
    }
  }
  if (depth !== 0) return { status: "unbalanced", groups: [] };
  return { status: "balanced", groups };
}

// -- Exports ------------------------------------------------------------------

export { scanParenGroups };
export type { ParenGroup, ParenScan, ParenScanStatus };
