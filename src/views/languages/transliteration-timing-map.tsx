import { type TransliterationSlice, timedTransliterationSlice } from "@/domain/language/transliteration-format";
import type { WordTiming } from "@/domain/word/timing";
import { cn } from "@/utils/cn";
import { IconArrowRight } from "@tabler/icons-react";
import { Fragment } from "react";

// -- Interfaces ---------------------------------------------------------------

interface TransliterationTimingMapProps {
  words: WordTiming[];
  slices: TransliterationSlice[];
  trailingJoiner?: string;
}

// -- Component ----------------------------------------------------------------

const TransliterationTimingMap: React.FC<TransliterationTimingMapProps> = ({ words, slices, trailingJoiner }) => (
  <div
    role="group"
    aria-label="Timing map"
    className="flex flex-wrap items-center justify-center gap-2 text-sm select-text"
  >
    {words.map((word, index) => {
      const slice = timedTransliterationSlice({
        text: slices[index]?.text ?? "",
        joinerAfter: index < words.length - 1 ? slices[index]?.joinerAfter : trailingJoiner,
      }).text;
      return (
        <Fragment key={`${word.begin}-${word.end}-${index}`}>
          {index > 0 && <IconArrowRight aria-hidden="true" className="size-3.5 text-composer-text-faint" />}
          <span className="inline-flex h-7 items-baseline gap-1.5 rounded-lg bg-composer-button px-2.5 leading-7">
            <span className="text-composer-text-muted">{word.text.trimEnd()}</span>
            <span className={cn("font-medium", !slice && "text-composer-negative")}>{slice || "missing"}</span>
          </span>
        </Fragment>
      );
    })}
  </div>
);

// -- Exports ------------------------------------------------------------------

export { TransliterationTimingMap };
