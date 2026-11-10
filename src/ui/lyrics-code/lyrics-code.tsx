import { type CodeBlock, codeBlocks } from "@/ui/lyrics-code/code-blocks";
import { useBlocksNearView } from "@/ui/lyrics-code/use-blocks-near-view";
import { cn } from "@/utils/cn";
import { type LyricFormat, type Token, tokenize } from "@braccato/highlight";
import { memo, useMemo } from "react";

// -- Interfaces ---------------------------------------------------------------

interface LyricsCodeProps {
  code: string;
  format?: LyricFormat;
  className?: string;
}

interface WindowedCodeProps {
  blocks: CodeBlock[];
  className?: string;
}

interface CodeBlockSpanProps {
  block: CodeBlock;
  index: number;
  highlighted: boolean;
  observeBlock: (element: HTMLElement) => () => void;
}

// -- Constants ----------------------------------------------------------------

const LINES_PER_BLOCK = 20;
// Up to this many blocks the whole document is highlighted at once.
const MAX_FULLY_HIGHLIGHTED_BLOCKS = 4;

// -- Components ---------------------------------------------------------------

const Tokens: React.FC<{ tokens: readonly Token[] }> = ({ tokens }) =>
  tokens.map((token, index) =>
    token.type === "text" ? (
      token.text
    ) : (
      <span key={`${index}-${token.type}`} className={`bh-${token.type}`}>
        {token.text}
      </span>
    ),
  );

// Blocks away from the view hold their text unstyled, so copy and find still see every line.
const CodeBlockSpan = memo<CodeBlockSpanProps>(({ block, index, highlighted, observeBlock }) => (
  <span ref={observeBlock} data-code-block={index}>
    {highlighted ? <Tokens tokens={block.tokens} /> : block.text}
  </span>
));

const WindowedCode: React.FC<WindowedCodeProps> = ({ blocks, className }) => {
  const { nearBlocks, observeBlock } = useBlocksNearView();
  return (
    <pre className={cn("bh lyrics-code-surface", className)}>
      {blocks.map((block, index) => (
        <CodeBlockSpan
          key={index}
          block={block}
          index={index}
          highlighted={nearBlocks.has(index)}
          observeBlock={observeBlock}
        />
      ))}
    </pre>
  );
};

const LyricsCode: React.FC<LyricsCodeProps> = ({ code, format, className }) => {
  const tokens = useMemo(() => tokenize(code, format), [code, format]);
  const blocks = useMemo(() => codeBlocks(tokens, LINES_PER_BLOCK), [tokens]);

  if (blocks.length > MAX_FULLY_HIGHLIGHTED_BLOCKS) return <WindowedCode blocks={blocks} className={className} />;
  return (
    <pre className={cn("bh lyrics-code-surface", className)}>
      <Tokens tokens={tokens} />
    </pre>
  );
};

// -- Exports ------------------------------------------------------------------

export { LyricsCode };
