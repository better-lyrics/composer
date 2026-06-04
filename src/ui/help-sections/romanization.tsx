import { HEADING, INLINE_CODE, PROSE } from "@/ui/help-sections/shared";
import { ALT_KEY } from "@/utils/platform";

// -- Data ---------------------------------------------------------------------

interface CoverageRow {
  label: string;
  schemes: string[];
}

const COVERAGE: CoverageRow[] = [
  { label: "Japanese", schemes: ["ja-Latn-hepburn", "ja-Latn-kunrei"] },
  { label: "Chinese", schemes: ["zh-Latn-pinyin"] },
  { label: "Korean", schemes: ["ko-Latn-rr", "ko-Latn-mr"] },
  { label: "Thai", schemes: ["th-Latn-rtgs"] },
  { label: "Russian", schemes: ["ru-Latn-iso9", "ru-Latn-bgn"] },
  { label: "Greek", schemes: ["el-Latn-iso843"] },
  { label: "Arabic", schemes: ["ar-Latn-iso233"] },
  { label: "Hebrew", schemes: ["he-Latn"] },
  { label: "Hindi", schemes: ["hi-Latn-iast"] },
  { label: "Bengali", schemes: ["bn-Latn-iast"] },
  { label: "Other non-Latin scripts", schemes: ["und-Latn"] },
];

// -- Romanization Section -----------------------------------------------------

const RomanizationSection: React.FC = () => (
  <div className="space-y-5">
    <p className={PROSE}>
      Composer turns non-Latin lyrics into a phonetic Latin reading using a self-hosted backend. The server runs a chain
      of specialist libraries per language so Japanese gets Hepburn-aware morphology, Chinese gets polyphone-correct
      Pinyin, Korean gets liaison rules, and so on. The client just sends the source lines and renders the response.
    </p>

    <div>
      <h4 className={HEADING}>What gets romanized</h4>
      <p className={PROSE}>
        Composer detects which lines have non-Latin script (Hiragana, Han, Hangul, Thai, Cyrillic, Greek, Arabic,
        Hebrew, Devanagari, Bengali). Lines that are already in Latin script are skipped.
      </p>
      <ul className={`${PROSE} list-disc pl-4 mt-1.5 space-y-1`}>
        {COVERAGE.map((row) => (
          <li key={row.label}>
            <span>{row.label}: </span>
            {row.schemes.map((scheme, idx) => (
              <span key={scheme}>
                <code className={INLINE_CODE}>{scheme}</code>
                {idx < row.schemes.length - 1 ? ", " : null}
              </span>
            ))}
          </li>
        ))}
      </ul>
      <p className={`${PROSE} mt-2`}>
        Background vocals are not romanized in this version. Only the main line text is processed.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Generating</h4>
      <p className={PROSE}>
        Open the Edit tab. When eligible lines are present, a banner appears with a scheme dropdown and a Generate
        button. Pick the romanization style (e.g. Hepburn for Japanese) and press Generate. The banner re-arms when new
        eligible lines are added or edited, so you can regenerate at any time.
      </p>
      <p className={`${PROSE} mt-2`}>
        Each line shows a small Refresh icon on its romaji subrow that re-runs just that line. Use it to fix one line
        after editing its source text.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Editing manually</h4>
      <p className={PROSE}>
        Click the romaji subrow under any line to edit the line-level text manually. Save commits a manual edit that
        the server will not overwrite on the next bulk generate.
      </p>
      <p className={`${PROSE} mt-2`}>
        When a line is fully word-synced, you can press {ALT_KEY}+click on a single word (in the Edit subrow or on a
        Timeline word block) to open a per-syllable editor. The editor lets you type a manual reading or press
        Regenerate to ask the server for that one syllable again.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Timeline display</h4>
      <p className={PROSE}>
        Once a line has per-word romaji, each word block in the Timeline shows the source word on top and the romaji
        underneath. The Timeline header has a toggle that swaps which one is primary, in case you want to read romaji
        first and reference the source below. The toggle only appears when at least one line carries per-word romaji.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>TTML export</h4>
      <p className={PROSE}>
        Romanization round-trips through TTML. On export, each line with timing gets a sequential <code className={INLINE_CODE}>itunes:key</code>{" "}
        (L1, L2, ...) and a single <code className={INLINE_CODE}>{`<transliteration>`}</code> block under{" "}
        <code className={INLINE_CODE}>{`<head>`}</code>. Per-syllable readings carry source word timing, not independent
        timing. Re-importing a Composer-emitted TTML restores text, per-word readings, and the project scheme.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Self-hosting the backend</h4>
      <p className={PROSE}>
        By default, requests go to the Composer-hosted backend. Self-hosters can point Composer at their own deploy
        from Settings, under the Romanization section. Fields are an API base URL (e.g. your domain serving the
        backend) and an optional Turnstile site key if your deploy enforces it.
      </p>
    </div>
  </div>
);

// -- Exports ------------------------------------------------------------------

export { RomanizationSection };
