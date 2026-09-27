import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { PROSE } from "@/ui/typography";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { TimelineExtras } from "@/ui/help-sections/timeline-extras";
import { ALT_KEY, MOD_KEY } from "@/utils/platform";
import { SettingLink } from "@/ui/setting-link";
import { HelpTopic } from "@/ui/help-topic";

// -- Timeline -----------------------------------------------------------------

const TimelineSection: React.FC = () => (
  <div className="space-y-5">
    <p className={PROSE}>
      The Timeline is where you do the detailed work. While the Sync tab is great for tapping out rough timing, Timeline
      gives you full control over every word. You can drag words to reposition them, resize their boundaries, split
      words and syllables, merge blocks, mark explicit words, copy and paste across lines, and more. If you've used a
      DAW or video editor before, this will feel familiar.
    </p>

    <HelpTopic title="Layout">
      <p className={PROSE}>
        The waveform sits at the top. Below it, each lyrics line is a horizontal track. Word blocks sit on the tracks,
        positioned by their start and end times. The playhead (vertical line) follows the audio. The gutter on the left
        shows line numbers and agent colors. Click it to assign agents.
      </p>
    </HelpTopic>

    <HelpTopic title="Navigation">
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          A plain scroll wheel scrolls vertically through the lines. To move through time, scroll horizontally with a
          trackpad gesture.
        </li>
        <li>
          Turn on <SettingLink setting="timelineHorizontalScroll" /> to swap the axes: a plain wheel then scrolls the
          timeline horizontally and Shift + wheel scrolls vertically.
        </li>
        <li>
          Scroll the wheel while the cursor is over the waveform strip to scrub the playhead through time, and the view
          follows it. This works whichever way the "Scroll wheel scrolls timeline" setting is set.
        </li>
        <li>
          {MOD_KEY} + scroll wheel to zoom in and out. Zoom anchors under the cursor. The header zoom buttons (and the
          shortcuts they expose) anchor on the playhead when it's on screen, and on the viewport center otherwise.
        </li>
        <li>Middle-click and drag to pan freely. Hold Shift while middle-dragging to lock panning to one axis.</li>
        <li>
          Drag the playhead near the left or right edge of the viewport and the view auto-scrolls in that direction, so
          you can scrub the playhead past what is currently visible.
        </li>
        <li>
          Press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.toggleFollow")} /> to toggle "follow playhead" so
          the view scrolls automatically during playback.
        </li>
      </ul>
    </HelpTopic>

    <HelpTopic title="Audio scrub preview">
      <p className={PROSE}>
        When you scrub the playhead (drag it, or scroll the wheel over the waveform), Composer plays a short bit of
        audio at the playhead position, at normal pitch. It helps you find a specific word by ear without having to
        press play. Faster scrubs play more snippets, slower scrubs play fewer. The preview matches your main volume and
        stays silent when the audio is muted. If it gets in the way, turn off{" "}
        <SettingLink setting="audioScrubPreview" />.
      </p>
      <p className={`${PROSE} mt-2`}>
        If you've separated the song into stems, scrubbing follows the stem you have selected: pick "Vocals" from the
        stem dropdown and the scrub previews vocals only, which makes it much easier to pin down a syllable boundary.
        The full track plays back as normal regardless of the stem choice.
      </p>
    </HelpTopic>

    <HelpTopic title="Selecting words">
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>Click a word block to select it. {MOD_KEY} + Click to add or remove from selection.</li>
        <li>Shift + Click a syllable to select every syllable in that word's group at once.</li>
        <li>Click and drag on empty space to marquee-select multiple words.</li>
        <li>Hold Shift while dragging to add to existing selection.</li>
        <li>
          Press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.selectWordAtPlayhead")} /> to select the word at
          the current playhead time. Press it again to cycle through any overlapping words, such as a background-track
          word or stacked instances.
        </li>
        <li>
          Press <strong>Escape</strong> to deselect everything.
        </li>
      </ul>
    </HelpTopic>

    <HelpTopic title="Editing words">
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
          current playhead position. With <strong>Rolling</strong> on, moving an edge that sits flush against its
          neighbor carries that neighbor along, so the two stay joined. Flush syllables of one word stay joined whether
          Rolling is on or off, just as they do when you drag the boundary, unless the setting below is on. The{" "}
          <strong>Set Begin</strong> and <strong>Set End</strong> buttons in the info panel do the same thing.
        </li>
        <li>
          With nothing selected and the playhead resting in the space between two words, those same two keys reach for
          the nearest word instead of doing nothing.{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.setWordBegin")} /> pulls back the word that starts after
          the playhead, and <InlineKeyBadge keys={getEffectiveKeysArray("timeline.setWordEnd")} /> pushes forward the
          word that ended before it, so two keystrokes close a gap from both sides. Neither one drags a neighbor along,
          since a word across a gap has nothing to stay joined to.
        </li>
        <li>
          With one or more words selected, press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.nudgeLeft")} /> /{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.nudgeRight")} /> to nudge them as a group. Each word
          keeps its duration, and the nudge stops at the neighboring word so nothing overlaps.
        </li>
      </ul>
    </HelpTopic>

    <HelpTopic title="Copy, cut, paste">
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          {MOD_KEY} + C / X / V work as expected. When you paste, a ghost preview appears. Click to place the pasted
          words.
        </li>
        <li>{ALT_KEY} + drag selected words to duplicate them.</li>
        <li>Press Delete or Backspace to remove selected words.</li>
      </ul>
    </HelpTopic>

    <HelpTopic title="Moving words across lines and tracks">
      <p className={PROSE}>
        Drag any word block onto another line to move it there. It can land on a different line's main track, on a
        background track, or on the background track of its own line. Multi-select moves the whole selection at once:
        each word keeps its offset from the one you grabbed, and linked syllables stay joined.
      </p>
      <ul className={`${PROSE} list-disc pl-4 mt-1.5 space-y-1`}>
        <li>Keep the word on its own line and the same drag reorders it within that row instead.</li>
        <li>
          Dropping a word onto a background track converts its role, and the destination line gets <strong>x-bg</strong>{" "}
          markup at export.
        </li>
        <li>
          Two drops are refused, each with a short toast: moving a word out of a linked group (detach the line first),
          and dropping onto a line that is still line-synced instead of split into words. A drop that would land on top
          of an existing word just stays put.
        </li>
      </ul>
    </HelpTopic>

    <HelpTopic title="Boundary dragging">
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          Two flush syllables share one boundary: drag either edge and both move, staying flush. Once a gap opens, each
          edge drags on its own. Turn on <SettingLink setting="syllablesFollowRolling" /> to join them only while
          Rolling is on.
        </li>
        <li>
          Hold <strong>{ALT_KEY}</strong> while dragging to flip the current mode: flush syllables open a gap, gapped
          syllables snap back together, and separate words move as one.
        </li>
        <li>You can toggle {ALT_KEY} mid-drag to switch modes on the fly.</li>
        <li>
          Turn on <strong>Rolling</strong> in the toolbar (or press{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.toggleRollingEdit")} />) for rolling edits. When it's
          on, dragging a flush boundary between two words moves both words together: the shared boundary shifts, the
          outer edges stay put, and the combined duration is preserved. {ALT_KEY} still inverts conjoin for that one
          drag.
        </li>
      </ul>
    </HelpTopic>

    <HelpTopic title="Snap (magnet)">
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
        <li>
          Adjust the snap distance with <SettingLink setting="timelineSnapThreshold" />. Range is 4 to 24 pixels,
          default 12.
        </li>
        <li>
          Snap won't push a block into a neighbor. If the closest anchor would cause overlap, it falls through to the
          next-best anchor or doesn't snap at all.
        </li>
      </ul>
    </HelpTopic>

    <HelpTopic title="Snap points and marker mode">
      <p className={PROSE}>
        Two kinds of snap marker can sit over the waveform. Dashed guide lines are vocal onsets, which Composer detects
        from the separated vocal stem, so they only show up once you have split out vocals and turned on "Snap to vocal
        onsets" in the stem dropdown. Solid pins are custom snap points you place yourself. Both pull word edges in the
        way the magnet does, and custom points keep snapping even when Snap and onset snapping are both off.
      </p>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          Click the pin button in the toolbar or press{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.toggleMarkerMode")} /> to enter marker mode. The
          waveform cursor turns into a pin, and a single click drops a custom point where you click.
        </li>
        <li>
          With marker mode off, a plain click on the waveform just moves the playhead. Hold {ALT_KEY} and the cursor
          turns into the same pin you get in marker mode, so you can tell a click will drop a point; click while it is
          held to place one without arming the mode.
        </li>
        <li>
          Press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.dropSnapMarkerAtPlayhead")} /> to drop a pin at
          the exact playhead position.
        </li>
        <li>
          Press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.jumpPrevSnapPoint")} /> /{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.jumpNextSnapPoint")} /> to jump the playhead to the
          previous or next snap point. These stop on your custom pins. Hold {ALT_KEY} for the finer pair{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.jumpPrevSnapPointFine")} /> /{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.jumpNextSnapPointFine")} />, which also stop on every
          detected vocal onset.
        </li>
        <li>
          Drag a pin's head to move it. With onset snapping on, releasing near a vocal onset lands the pin right on it,
          and the onset tucks behind the pin so you do not see two markers stacked.
        </li>
        <li>
          Hover a pin to see its time. The trash icon to delete it sits under the head, or press Delete (or Backspace)
          while hovering to remove it.
        </li>
        <li>
          Turn on <SettingLink setting="snapPlayheadToPoints" /> (on by default), and clicking or dragging the playhead
          snaps it to nearby custom pins and vocal onsets. Hold {MOD_KEY} to bypass it for one gesture. Scroll-wheel
          scrubbing over the waveform stays smooth and is never snapped.
        </li>
        <li>
          Snap points are saved with your project and come back when you reopen it. Undo and redo treat placing, moving,
          or deleting a point like any other edit. They stay out of the exported TTML, so they never end up in the file
          you share.
        </li>
      </ul>
    </HelpTopic>

    <TimelineExtras />
  </div>
);

// -- Exports ------------------------------------------------------------------

export { TimelineSection };
