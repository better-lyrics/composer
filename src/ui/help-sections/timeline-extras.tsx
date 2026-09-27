import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { INLINE_CODE, PROSE } from "@/ui/typography";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { MOD_KEY } from "@/utils/platform";
import { SettingLink } from "@/ui/setting-link";
import { HelpTopic } from "@/ui/help-topic";

// -- Timeline extras ----------------------------------------------------------

const TimelineExtras: React.FC = () => (
  <>
    <HelpTopic title="Splitting and merging">
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          Press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.splitSyllable")} /> with a word selected to open
          the splitter in syllable mode. Click between letters to mark where the word should break. The result is a
          linked syllable group: the pieces stay tied together as one word. If the playhead is on the word when you
          confirm a single split, the timing boundary snaps to the playhead position exactly.
        </li>
        <li>
          Press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.splitWord")} /> (or right-click and pick{" "}
          <strong>Split word</strong>) to open the splitter in word mode. This breaks one word into separate independent
          words, joined by a space, rather than a linked syllable group.
        </li>
        <li>
          To undo a syllable split, right-click any syllable of the word and pick <strong>Merge syllables</strong>, or
          press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.mergeSyllablesIntoWord")} />. The syllable group
          collapses back into one plain word that spans from the first syllable's start to the last syllable's end.
        </li>
        <li>
          Select two or more adjacent words on the same line and press{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.mergeWords")} /> to merge them into one block. This
          works even when the selected words have a space between them; the joining space is dropped.
        </li>
      </ul>
    </HelpTopic>

    <HelpTopic title="Syllable timing">
      <p className={PROSE}>
        Syllables of a word can be timed flush against each other or with gaps between them. Gaps are useful for
        staccato or rap delivery, and for per-character timing in Japanese, Chinese, or Korean lyrics. To close those
        gaps, right-click a syllable and pick <strong>Snap syllables flush</strong>. It pulls every syllable group on
        the line tight, so each syllable starts where the previous one ends. The item only shows up when a group has a
        gap, and there is no keyboard shortcut for it.
      </p>
    </HelpTopic>

    <HelpTopic title="Explicit words">
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
    </HelpTopic>

    <HelpTopic title="Right-click menus">
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
    </HelpTopic>

    <HelpTopic title="Linked groups">
      <p className={PROSE}>
        Mark repeating sections (chorus, verse, bridge) as a group so structural edits fan out to every instance. See
        the <strong>Linked groups</strong> section in this help modal for the full walkthrough.
      </p>
    </HelpTopic>

    <HelpTopic title="Header toolbar">
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
          <strong>Marker</strong> (<InlineKeyBadge keys={getEffectiveKeysArray("timeline.toggleMarkerMode")} />
          ): arms the waveform so a click drops a custom snap point. See <strong>Snap points and marker mode</strong> in
          the Timeline section for the full rundown.
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
        Follow, Rolling, Preview, and Snap remember their state across reloads. Override the per-session default in{" "}
        <SettingLink section="timeline" />.
      </p>
    </HelpTopic>

    <HelpTopic title="Other features">
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          Press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.insertLineBelow")} /> with a word selected to
          insert a new empty line below it.
        </li>
        <li>The info panel at the bottom shows details for the selected word, including background text editing.</li>
      </ul>
    </HelpTopic>
  </>
);

// -- Exports ------------------------------------------------------------------

export { TimelineExtras };
