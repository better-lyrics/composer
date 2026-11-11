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
  isLast: boolean;
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
// Each block is its own block box, so a highlight swap re-lays out that block instead of the whole document.
// The last one stays inline: WebKit copies an extra line break after a final block box.
const CodeBlockSpan = memo<CodeBlockSpanProps>(({ block, index, isLast, highlighted, observeBlock }) => (
  <span ref={observeBlock} data-code-block={index} className={isLast ? "inline" : "block"}>
    {highlighted ? (
      // One wrapper is built off the page and inserted once, instead of one insertion per token.
      <span>
        <Tokens tokens={block.tokens} />
      </span>
    ) : (
      block.text
    )}
  </span>
));

const WindowedCode: React.FC<WindowedCodeProps> = ({ blocks, className }) => {
  const { highlighted, observeBlock } = useBlocksNearView();
  const highlightedSet = useMemo(() => new Set(highlighted), [highlighted]);
  return (
    <pre className={cn("bh lyrics-code-surface", className)}>
      {blocks.map((block, index) => (
        <CodeBlockSpan
          // react-doctor-disable-next-line react-doctor/no-array-index-as-key -- a block is its position plus its text: a moved or edited block must remount so its observed index and scrollbar mutation skip stay right
          key={`${index}:${block.text}`}
          block={block}
          index={index}
          isLast={index === blocks.length - 1}
          highlighted={highlightedSet.has(index)}
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
