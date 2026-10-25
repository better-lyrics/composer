import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { HelpTopic } from "@/ui/help-topic";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { SettingLink } from "@/ui/setting-link";
import { INLINE_CODE, PROSE } from "@/ui/typography";
import { MOD_KEY } from "@/utils/platform";

// -- Timeline extras ----------------------------------------------------------

const TimelineExtras: React.FC = () => (
  <>
    <HelpTopic title="Splitting and merging">
      <ul className={`${PROSE} list-disc pl-[18px] marker:text-(--muted) space-y-1`}>
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
      <ul className={`${PROSE} list-disc pl-[18px] marker:text-(--muted) space-y-1`}>
        <li>
          Right-click a word: Edit text, Split syllables, Split word. Merge words appears when multiple words are
          selected. On a word already split into syllables you also get Merge syllables and Snap syllables flush. Mark
          as explicit (or Unmark explicit) toggles the explicit flag. Group this line and Split into words show up when
          they apply, and Delete word is always there. Right-click inside a selection of several words and it deletes
          them all.
        </li>
        <li>
          Right-click empty track space: Add word here, plus Place line here or Place at playhead when they apply.
        </li>
        <li>
          Right-click the gutter: Add line above/below, Assign agent, Delete line. Place at playhead and Detach this
          line appear on grouped lines when they apply.
        </li>
        <li>
          Right-click a group banner: Open group, Collapse or Expand instance, Jump to start, Ping siblings, Add
          instance at playhead, Shift instance to playhead, Jump to previous or next instance, Use own timing or Share
          timing, Rename, Recolor, Detach instance, Delete group.
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
      <ul className={`${PROSE} list-disc pl-[18px] marker:text-(--muted) space-y-1`}>
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
          ): a magnet for word edges and the playhead. The arrow beside it picks what snaps. Hold {MOD_KEY} mid-drag to
          bypass.
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
        Snap remembers its state across reloads. Follow, Rolling and Preview start each session from their defaults in{" "}
        <SettingLink section="timeline" />.
      </p>
    </HelpTopic>

    <HelpTopic title="Beat grid">
      <p className={PROSE}>
        The beat grid reads the song's tempo in BPM and draws its bars and beats behind the waveform, so words can snap
        to the beat. Open it from the wave icon at the left of the waveform.
      </p>
      <ul className={`${PROSE} list-disc pl-[18px] marker:text-(--muted) space-y-1`}>
        <li>
          <strong>Detect beats</strong> runs on your device. The first run downloads a 9 MB model. After that it takes a
          few seconds and works offline.
        </li>
        <li>
          <strong>Set by hand</strong> to type a tempo, or press{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("global.playPause")} /> to play and tap along with{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("sync.tap")} />. Bars start on your first tap, or at the playhead
          if you typed the tempo.
        </li>
        <li>
          <strong>Lines</strong> sets the finest lines: bars, beats, or halves, thirds or quarters of a beat. Finer
          lines show up as you zoom in, and only lines you can see are snap targets.
        </li>
        <li>
          Grid a little early or late? Nudge it with <strong>Offset</strong>. Bars starting on the wrong beat? Put the
          playhead on the first beat of a bar and choose <strong>Set at playhead</strong> next to Downbeat.{" "}
          <strong>Half</strong> and <strong>Double</strong> fix a tempo read at twice or half the speed.
        </li>
        <li>
          Press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.jumpPrevBar")} /> or{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.jumpNextBar")} /> to jump the playhead to the bar before
          or after it. <InlineKeyBadge keys={getEffectiveKeysArray("timeline.jumpPrevGridLine")} /> and{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.jumpNextGridLine")} /> step through the lines you can
          see instead, so zoom in to move by beats or parts of a beat.
        </li>
        <li>Every change can be undone, and the grid saves with the project.</li>
        <li>
          Press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.toggleBeatGrid")} /> to show or hide the grid. The
          arrow next to the magnet picks what snaps: words and lines, markers, vocal onsets and beats.
        </li>
      </ul>
    </HelpTopic>

    <HelpTopic title="Spectrum and pitch line">
      <p className={PROSE}>
        Press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.toggleSpectrum")} /> to swap the waveform for a
        spectrum. Time runs left to right, pitch runs up, and brighter is louder. A sung vowel shows as a stack of
        bright bands and a consonant as a short burst of noise, which makes it easy to see where a word starts and ends.
      </p>
      <ul className={`${PROSE} list-disc pl-[18px] marker:text-(--muted) space-y-1`}>
        <li>Drag the bottom edge of the spectrum to make it taller. Double-click the edge to shrink it back.</li>
        <li>
          The arrow next to the Spectrum button holds its settings: the separated vocals or the full mix, the colours,
          and contrast, which hides background noise or brings out quiet detail.
        </li>
        <li>
          While the spectrum shows, dragging a word edge, nudging it or pressing{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.setWordBegin")} /> or{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.setWordEnd")} /> opens a small magnifier with the
          spectrum around that edge. Line the edge up with the sound.
        </li>
        <li>
          Once vocals are separated, a pitch line runs along the bottom of each word and follows the melody. Amber means
          the singing carries on past the word's edge, which usually means the edge ends too early.
        </li>
        <li>
          <SettingLink setting="pitchLine" /> shows the line on every row, only on the row you point at, select or hear,
          or not at all. Press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.togglePitchLine")} /> to turn it
          off and on.
        </li>
      </ul>
      <p className={`${PROSE} mt-3`}>
        Analysis runs on your device and is saved with the separated vocals, so it opens straight away next time.
      </p>
    </HelpTopic>

    <HelpTopic title="Other features">
      <ul className={`${PROSE} list-disc pl-[18px] marker:text-(--muted) space-y-1`}>
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
