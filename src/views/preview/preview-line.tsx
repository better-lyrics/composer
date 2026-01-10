import { getAgentColor } from "@/stores/project";
import type { LyricLine } from "@/stores/project";
import { getLineTiming } from "@/views/timeline/utils";
import { memo } from "react";

// -- Types --------------------------------------------------------------------

interface PreviewLineProps {
  line: LyricLine;
  lineIndex: number;
  granularity: "line" | "word";
}

// -- Helpers ------------------------------------------------------------------

function getAgentAlignment(agentId: string): "left" | "center" | "right" {
  const match = agentId.match(/^v(\d+)$/);
  if (!match) return "center";
  const num = Number.parseInt(match[1], 10);
  if (num >= 1000) return "center";
  return num % 2 === 1 ? "left" : "right";
}

// -- Component ----------------------------------------------------------------

const PreviewLine: React.FC<PreviewLineProps> = ({ line, lineIndex, granularity }) => {
  const timing = getLineTiming(line);
  const alignment = getAgentAlignment(line.agentId);
  const alignmentClass =
    alignment === "left" ? "justify-start" : alignment === "right" ? "justify-end" : "justify-center";
  const agentColor = getAgentColor(line.agentId);
  const textAlignClass = alignment === "left" ? "text-left" : alignment === "right" ? "text-right" : "text-center";
  const bgMarginClass = alignment === "left" ? "ml-5" : alignment === "right" ? "mr-5" : "";

  const AgentDot = <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: agentColor }} />;

  // Word for progress overlay - outputs data attributes for DOM animation
  const WordWithProgress: React.FC<{
    text: string;
    begin: number;
    end: number;
  }> = ({ text, begin, end }) => (
    <span className="relative inline-block whitespace-pre">
      <span className="text-composer-text-muted">{text}</span>
      <span
        className="absolute inset-0 text-composer-accent-text"
        data-word-begin={begin}
        data-word-end={end}
        data-line-idx={lineIndex}
        style={{ clipPath: "inset(0 100% 0 0)" }}
      >
        {text}
      </span>
    </span>
  );

  const renderBgWords = () => {
    if (!line.backgroundWords?.length) return null;
    return (
      <div
        className={`flex flex-wrap items-center gap-y-1 text-base font-medium mt-1 ${alignmentClass} ${bgMarginClass}`}
      >
        {line.backgroundWords.map((bgWord, bgIdx) => (
          <WordWithProgress
            // biome-ignore lint/suspicious/noArrayIndexKey: stable position
            key={`bg-${bgIdx}`}
            text={bgWord.text}
            begin={bgWord.begin}
            end={bgWord.end}
          />
        ))}
      </div>
    );
  };

  if (granularity === "line") {
    return (
      <div
        className={`py-3 px-6 ${textAlignClass}`}
        style={{ opacity: 0.3 }}
        data-line-begin={timing?.begin ?? 0}
        data-line-end={timing?.end ?? 0}
        data-line-idx={lineIndex}
      >
        <div className="inline-flex items-center gap-3 text-2xl font-medium">
          {alignment === "left" && AgentDot}
          <span className="relative inline-block">
            <span className="text-composer-text-muted">{line.text}</span>
            <span
              className="absolute inset-0 text-composer-accent-text"
              data-word-begin={timing?.begin ?? 0}
              data-word-end={timing?.end ?? 0}
              data-line-idx={lineIndex}
              style={{ clipPath: "inset(0 100% 0 0)" }}
            >
              {line.text}
            </span>
          </span>
          {alignment === "right" && AgentDot}
        </div>
        {renderBgWords()}
      </div>
    );
  }

  const words = line.words ?? [];

  return (
    <div
      className={`py-3 px-6 ${textAlignClass}`}
      style={{ opacity: 0.3 }}
      data-line-begin={timing?.begin ?? 0}
      data-line-end={timing?.end ?? 0}
      data-line-idx={lineIndex}
    >
      <div className={`inline items-center text-2xl font-medium ${alignmentClass}`}>
        {alignment === "left" && AgentDot}
        {words.length > 0
          ? words.map((word) => (
              <WordWithProgress key={`${word.begin}-${word.text}`} text={word.text} begin={word.begin} end={word.end} />
            ))
          : line.text.split(/\s+/).map((word, idx) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static text
              <span key={idx} className="text-composer-text-muted">
                {word}{" "}
              </span>
            ))}
        {alignment === "right" && AgentDot}
      </div>
      {renderBgWords()}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

const MemoizedPreviewLine = memo(PreviewLine);

export { MemoizedPreviewLine as PreviewLine };
