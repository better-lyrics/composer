import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { HEADING, INLINE_CODE, PROSE } from "@/ui/help-sections/shared";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { MOD_KEY } from "@/utils/platform";

// -- Timeline extras ----------------------------------------------------------

const TimelineExtras: React.FC = () => (
  <>
    <div>
      <h4 className={HEADING}>Explicit words</h4>
      <p className={PROSE}>
        Mark a word as explicit so it carries the right flag through to export. Select one or more words and press{" "}
        <InlineKeyBadge keys={getEffectiveKeysArray("timeline.toggleExplicit")} />, or right-click and pick{" "}
        <strong>Mark as explicit</strong> (the same item reads <strong>Unmark explicit</strong> when the words are
        already flagged).
      </p>
      <p className={`${PROSE} mt-2`}>
        Composer also scans your lyrics for likely explicit words and shows a suggestions banner above the timeline.
        From there you can mark a suggested word, mark them all, or dismiss ones that are false positives. Explicit
        words export as the <span className={INLINE_CODE}>composer:explicit="true"</span> attribute on the word's TTML
        span.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Right-click menus</h4>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          Right-click a word: Edit text, Split syllables, Split word. Merge words appears when multiple words are
          selected. On a word already split into syllables you also get Merge syllables and Snap syllables flush. Mark
          as explicit (or Unmark explicit) toggles the explicit flag. Group this line and Split into words show up when
          they apply, and Delete word is always there.
        </li>
        <li>Right-click empty track space: Add word here.</li>
        <li>Right-click the gutter: Add line above/below, Assign agent, Delete line.</li>
        <li>
          Right-click a group banner: Add instance, Shift to playhead, Rename, Recolor, Detach instance, Delete group.
        </li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>Linked groups</h4>
      <p className={PROSE}>
        Mark repeating sections (chorus, verse, bridge) as a group so structural edits fan out to every instance. See
        the <strong>Linked groups</strong> section in this help modal for the full walkthrough.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Header toolbar</h4>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          <strong>Follow</strong> (<InlineKeyBadge keys={getEffectiveKeysArray("timeline.toggleFollow")} />
          ): auto-scrolls the view to keep the playhead visible during playback.
        </li>
        <li>
          <strong>Rolling</strong> (<InlineKeyBadge keys={getEffectiveKeysArray("timeline.toggleRollingEdit")} />
          ): the rolling edit tool. When on, dragging a flush boundary moves both adjacent words together while keeping
          their combined duration.
        </li>
        <li>
          <strong>Preview</strong> (<InlineKeyBadge keys={getEffectiveKeysArray("timeline.togglePreview")} />
          ): opens a live lyrics preview sidebar on the right.
        </li>
        <li>
          <strong>Snap</strong> (<InlineKeyBadge keys={getEffectiveKeysArray("timeline.toggleSnap")} />
          ): a magnet for word edges and the playhead. Hold {MOD_KEY} mid-drag to bypass.
        </li>
        <li>
          <strong>Import</strong> (<InlineKeyBadge keys={getEffectiveKeysArray("timeline.importLyrics")} />
          ): imports lyrics directly into the Timeline without switching tabs.
        </li>
        <li>
          <strong>Zoom</strong>: use the +/- buttons or {MOD_KEY} + scroll wheel to zoom in and out. The header buttons
          keep the playhead pinned in place; scroll-wheel zoom pivots under the cursor.
        </li>
      </ul>
      <p className={`${PROSE} mt-3`}>
        Follow, Rolling, Preview, and Snap remember their state across reloads. Override the per-session default in
        Settings, under Timeline.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Other features</h4>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          Press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.insertLineBelow")} /> with a word selected to
          insert a new empty line below it.
        </li>
        <li>The info panel at the bottom shows details for the selected word, including background text editing.</li>
      </ul>
    </div>
  </>
);

// -- Exports ------------------------------------------------------------------

export { TimelineExtras };
