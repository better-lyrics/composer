import type { Token } from "@braccato/highlight";

// -- Interfaces ---------------------------------------------------------------

interface CodeBlock {
  text: string;
  tokens: Token[];
}

interface HighlightWindow {
  previous: readonly number[];
  near: ReadonlySet<number>;
  kept: ReadonlySet<number>;
  cap: number;
  holdsSelection: (index: number) => boolean;
}

// -- Functions ----------------------------------------------------------------

function codeBlocks(tokens: readonly Token[], linesPerBlock: number): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  let current: CodeBlock = { text: "", tokens: [] };
  let linesInBlock = 0;
  const append = (type: Token["type"], text: string) => {
    if (!text) return;
    current.tokens.push({ type, text });
    current.text += text;
  };

  for (const { type, text } of tokens) {
    let start = 0;
    for (let newline = text.indexOf("\n"); newline >= 0; newline = text.indexOf("\n", newline + 1)) {
      linesInBlock++;
      if (linesInBlock < linesPerBlock) continue;
      append(type, text.slice(start, newline + 1));
      blocks.push(current);
      current = { text: "", tokens: [] };
      linesInBlock = 0;
      start = newline + 1;
    }
    append(type, start === 0 ? text : text.slice(start));
  }
  if (current.text) blocks.push(current);
  return blocks;
}

// Oldest first: survivors keep their order and newly near blocks join at the end.
function highlightedBlocks({ previous, near, kept, cap, holdsSelection }: HighlightWindow): number[] {
  const next = previous.filter((index) => near.has(index) || kept.has(index) || holdsSelection(index));
  const survivors = new Set(next);
  for (const index of near) if (!survivors.has(index)) next.push(index);
  let excess = next.length - cap;
  return excess <= 0
    ? next
    : next.filter((index) => {
        if (excess <= 0 || near.has(index) || holdsSelection(index)) return true;
        excess--;
        return false;
      });
}

// -- Exports ------------------------------------------------------------------

export { codeBlocks, highlightedBlocks };
export type { CodeBlock };
