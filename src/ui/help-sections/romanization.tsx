import { HEADING, PROSE } from "@/ui/help-sections/shared";
import { ALT_KEY } from "@/utils/platform";

// -- Romanization -------------------------------------------------------------

const RomanizationSection: React.FC = () => (
  <div className="space-y-4">
    <p className={PROSE}>
      Romanization shows a Latin-script reading under the source lyrics. Useful for non-Latin scripts your listeners
      can't read: Japanese, Chinese, and so on.
    </p>

    <div>
      <h4 className={HEADING}>Supported schemes</h4>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>Japanese: Hepburn (default), Kunrei, Nihon-shiki. Uses kuroshiro locally; Kunrei-shiki maps to nippon.</li>
        <li>
          Chinese: Pinyin. Wade-Giles is supported as a best-effort fallback. Uses pinyin-pro locally and renders
          Wade-Giles as tone-mark-free pinyin.
        </li>
        <li>Korean, Russian, Greek, Thai, Arabic, Hindi, Bengali: auto-romanized via Google translate.</li>
        <li>Hebrew: auto-romanized via Google translate. Quality is limited on text without vowel marks (niqqud).</li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>Turning it on</h4>
      <p className={PROSE}>
        When Composer spots non-Latin script on any line, a banner appears in Edit asking which scheme to use. Pick one
        and generate. The banner won't come back unless you switch projects.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Generated vs. manual</h4>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>Generated: Composer produced the romaji. Hover a line and click the regenerate icon to redo it.</li>
        <li>Manual: you typed it yourself. Composer won't overwrite manual romaji.</li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>Timeline editing</h4>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          {ALT_KEY} + click a word in the Timeline to open the per-word romanization popover and edit one syllable.
        </li>
        <li>
          The Timeline header has a toggle that swaps the primary word text between source and romaji, so you can sync
          against whichever reading is easier to follow.
        </li>
        <li>Regenerating a single word uses only that word as input, not the whole line.</li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>TTML round-trip</h4>
      <p className={PROSE}>
        Romanization lives inside the project. It exports with the TTML as <code>{"<transliterations>"}</code> in the
        head metadata, and re-imports back into the same shape. Renderers that read transliterations will display it
        under each line.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Where it shows</h4>
      <p className={PROSE}>
        In Sync, the romaji sits under each line with the active line emphasized. In Timeline, it sits inside each word
        block; it hides automatically when a block gets too narrow.
      </p>
    </div>
  </div>
);

// -- Exports ------------------------------------------------------------------

export { RomanizationSection };
