import { useMemo } from "react";
import { type ExtractOptions, extractBackgroundVocals } from "insync/background-vocal-extraction";
import { lineFromFields } from "insync/line-from-fields";
import { backgroundText, lineText } from "insync/line-text";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

// -- Constants ----------------------------------------------------------------

const EXAMPLE_ROWS = ["Hold me (hold me) close (so close)", "(ooh)"];

const EXAMPLE_LINES = EXAMPLE_ROWS.map((text, index) =>
  lineFromFields({ id: `brackets-example-${index}`, text, agentId: "v1" }, DEFAULT_SPLIT_CHARACTER),
);

// -- Components ---------------------------------------------------------------

const BracketsExample: React.FC<{ options: ExtractOptions }> = ({ options }) => {
  const result = useMemo(
    () =>
      extractBackgroundVocals(EXAMPLE_LINES, options, DEFAULT_SPLIT_CHARACTER).map((line) => ({
        id: line.id,
        main: lineText(line, DEFAULT_SPLIT_CHARACTER),
        background: backgroundText(line, DEFAULT_SPLIT_CHARACTER),
      })),
    [options],
  );
  return (
    <div className="mb-0.5 py-2 rounded-lg bg-(--layer-1)">
      <p className="px-2.5 pb-1.5 text-[12.5px] font-medium leading-5 whitespace-pre text-(--label)">
        {EXAMPLE_ROWS.join("\n")}
      </p>
      <ol className="grid content-start gap-0.5 min-h-[49px] pt-1.5 px-2.5 border-t border-(--divider)">
        {result.map((line, index) => (
          <li key={line.id} className="flex items-baseline gap-2 min-h-5 whitespace-nowrap">
            <span className="w-2.5 shrink-0 font-mono text-[11px] font-medium tabular-nums text-(--muted)">
              {index + 1}
            </span>
            {line.main && <span className="text-[13px] text-composer-text">{line.main}</span>}
            {line.background && <span className="text-[12.5px] italic text-(--muted)">{line.background}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { BracketsExample };
