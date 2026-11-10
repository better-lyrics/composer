import type { Token } from "@braccato/highlight";

// -- Interfaces ---------------------------------------------------------------

interface CodeBlock {
  text: string;
  tokens: Token[];
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

// -- Exports ------------------------------------------------------------------

export { codeBlocks };
export type { CodeBlock };
