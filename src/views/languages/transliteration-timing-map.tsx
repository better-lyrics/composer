import { type TransliterationSlice, timedTransliterationSlice } from "@/domain/language/transliteration-format";
import type { WordTiming } from "@/domain/word/timing";
import { IconArrowRight } from "@tabler/icons-react";

function TransliterationTimingMap({
  words,
  slices,
  trailingJoiner,
}: {
  words: WordTiming[];
  slices: TransliterationSlice[];
  trailingJoiner?: string;
}) {
  return (
    <div className="rounded-xl border border-composer-border bg-composer-bg-elevated p-4">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-composer-text-muted">Timing map</p>
      <div role="group" aria-label="Timing map" className="flex flex-wrap items-center gap-2">
        {words.map((word, index) => (
          <div key={`${word.begin}-${word.end}-${word.text}`} className="flex items-center gap-2">
            {index > 0 && <IconArrowRight className="size-3.5 text-composer-text-muted" />}
            <span className="rounded-md bg-composer-button px-2.5 py-1.5 text-sm">
              <span className="mr-1.5 text-composer-text-muted">{word.text.trimEnd()}</span>
              <span className="font-medium">
                {timedTransliterationSlice({
                  text: slices[index]?.text ?? "",
                  joinerAfter: index < words.length - 1 ? slices[index]?.joinerAfter : trailingJoiner,
                }).text || "—"}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export { TransliterationTimingMap };
