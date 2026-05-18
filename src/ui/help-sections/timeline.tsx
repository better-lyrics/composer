import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { HEADING, PROSE } from "@/ui/help-sections/shared";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { ALT_KEY, MOD_KEY } from "@/utils/platform";

// -- Timeline -----------------------------------------------------------------

const TimelineSection: React.FC = () => (
  <div className="space-y-5">
    <p className={PROSE}>
      The Timeline is where you do the detailed work. While the Sync tab is great for tapping out rough timing, Timeline
      gives you full control over every word. You can drag words to reposition them, resize their boundaries, split
      syllables, merge blocks, copy and paste across lines, and more. If you've used a DAW or video editor before, this
      will feel familiar.
    </p>

    <div>
      <h4 className={HEADING}>Layout</h4>
      <p className={PROSE}>
        The waveform sits at the top. Below it, each lyrics line is a horizontal track. Word blocks sit on the tracks,
        positioned by their start and end times. The playhead (vertical line) follows the audio. The gutter on the left
        shows line numbers and agent colors. Click it to assign agents.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Navigation</h4>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>Scroll horizontally to move through time. Scroll vertically to see more lines.</li>
        <li>{MOD_KEY} + scroll wheel to zoom in and out.</li>
        <li>Middle-click and drag to pan freely. Hold Shift while middle-dragging to lock panning to one axis.</li>
        <li>
          Press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.toggleFollow")} /> to toggle "follow playhead" so
          the view scrolls automatically during playback.
        </li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>Selecting words</h4>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>Click a word block to select it. {MOD_KEY} + Click to add or remove from selection.</li>
        <li>Click and drag on empty space to marquee-select multiple words.</li>
        <li>Hold Shift while dragging to add to existing selection.</li>
        <li>
          Press <strong>Escape</strong> to deselect everything.
        </li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>Editing words</h4>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>Double-click a word block to edit its text inline. Press Enter to confirm, Escape to cancel.</li>
        <li>Double-click on empty track space to create a new word at that position.</li>
        <li>
          Press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.editWord")} /> with a word selected to start
          editing.
        </li>
        <li>
          Use <InlineKeyBadge keys={getEffectiveKeysArray("timeline.setWordBegin")} /> and{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.setWordEnd")} /> to snap a word's start or end to the
          current playhead position.
        </li>
        <li>
          With one or more words selected, press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.nudgeLeft")} /> /{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.nudgeRight")} /> to nudge them as a group. Each word
          keeps its duration, and the nudge stops at the neighboring word so nothing overlaps.
        </li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>Copy, cut, paste</h4>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          {MOD_KEY} + C / X / V work as expected. When you paste, a ghost preview appears. Click to place the pasted
          words.
        </li>
        <li>{ALT_KEY} + drag selected words to duplicate them.</li>
        <li>Press Delete or Backspace to remove selected words.</li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>Boundary dragging</h4>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          Two syllables that sit flush share one boundary: drag either edge and both move together, staying flush. Once
          a gap opens between them, each edge drags on its own so you can resize a syllable without closing the gap.
        </li>
        <li>
          Hold <strong>{ALT_KEY}</strong> while dragging to flip the current mode: flush syllables open a gap, gapped
          syllables snap back together, and separate words move as one.
        </li>
        <li>You can toggle {ALT_KEY} mid-drag to switch modes on the fly.</li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>Snap (magnet)</h4>
      <p className={PROSE}>
        Drag or resize a word and its edges lock onto nearby anchors: the begin and end of any other word (main or
        background track), line edges for line-synced lines, and the playhead. A yellow halo appears on the moving block
        while snapped, and a thin dashed line marks the anchor on the timeline.
      </p>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          Press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.toggleSnap")} /> or click the magnet button in the
          toolbar to toggle snap. The setting persists across sessions.
        </li>
        <li>
          Hold <strong>{MOD_KEY}</strong> mid-drag to bypass snap. The toolbar magnet dims while bypass is active.
          Release the key and snap re-engages.
        </li>
        <li>Adjust the snap distance in Settings, under Timeline. Range is 4 to 24 pixels, default 12.</li>
        <li>
          Snap won't push a block into a neighbor. If the closest anchor would cause overlap, it falls through to the
          next-best anchor or doesn't snap at all.
        </li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>Splitting and merging</h4>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          Press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.splitSyllable")} /> with a word selected to open
          the syllable splitter. Click between letters to mark where the word should break. If the playhead is on the
          word when you confirm a single split, the timing boundary snaps to the playhead position exactly.
        </li>
        <li>
          To undo a split, right-click any syllable of the word and pick <strong>Merge syllables</strong>, or press{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.mergeSyllablesIntoWord")} />. The syllable group
          collapses back into one plain word that spans from the first syllable's start to the last syllable's end.
        </li>
        <li>
          Select two or more adjacent words on the same line and press{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.mergeWords")} /> to merge them into one block.
        </li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>Syllable timing</h4>
      <p className={PROSE}>
        Syllables of a word can be timed flush against each other or with gaps between them. Gaps are useful for
        staccato or rap delivery, and for per-character timing in Japanese, Chinese, or Korean lyrics. To close those
        gaps, right-click a syllable and pick <strong>Snap syllables flush</strong>. It pulls every syllable group on
        the line tight, so each syllable starts where the previous one ends. The item only shows up when a group has a
        gap, and there is no keyboard shortcut for it.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Right-click menus</h4>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          Right-click a word: Edit text, Split syllables, Merge words (if multiple selected). On a word that is already
          split into syllables you also get Merge syllables and Snap syllables flush. Delete is always there.
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
          <strong>Follow</strong> (<InlineKeyBadge keys={getEffectiveKeysArray("timeline.toggleFollow")} />) -
          Auto-scrolls the view to keep the playhead visible during playback.
        </li>
        <li>
          <strong>Select</strong> - Disables double-click word creation so you can click freely without accidentally
          adding words.
        </li>
        <li>
          <strong>Preview</strong> (<InlineKeyBadge keys={getEffectiveKeysArray("timeline.togglePreview")} />) - Opens a
          live lyrics preview sidebar on the right.
        </li>
        <li>
          <strong>Snap</strong> (<InlineKeyBadge keys={getEffectiveKeysArray("timeline.toggleSnap")} />) - Magnet for
          word edges and the playhead. Hold {MOD_KEY} mid-drag to bypass.
        </li>
        <li>
          <strong>Import</strong> (<InlineKeyBadge keys={getEffectiveKeysArray("timeline.importLyrics")} />) - Import
          lyrics directly into the Timeline without switching tabs.
        </li>
        <li>
          <strong>Zoom</strong> - Use the +/- buttons or {MOD_KEY} + scroll wheel to zoom in and out.
        </li>
      </ul>
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
  </div>
);

// -- Exports ------------------------------------------------------------------

export { TimelineSection };
