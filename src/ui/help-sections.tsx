import { useSettingsStore } from "@/stores/settings";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { ShortcutSection, SHORTCUT_SECTIONS } from "@/ui/help-modal";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { ALT_KEY, MOD_KEY } from "@/utils/platform";

// -- Constants ----------------------------------------------------------------

const PROSE = "text-sm text-composer-text-secondary leading-relaxed";
const HEADING = "text-sm font-medium";

// -- Getting Started ----------------------------------------------------------

const GettingStartedSection: React.FC = () => (
  <div className="space-y-5">
    <p className={PROSE}>
      Composer is the lyrics editor for{" "}
      <a
        href="https://betterlyrics.org"
        target="_blank"
        rel="noopener noreferrer"
        className="text-composer-text underline underline-offset-2 hover:text-composer-text-bright"
      >
        Better Lyrics
      </a>
      . It guides you through four steps to create synced lyrics. Follow the tabs left-to-right for a guided experience,
      or jump straight to the Timeline for a DAW-like workflow.
      <br /> As of now, Composer is still in early access, so expect some rough edges. If you run into any issues or
      have feedback, please reach out on{" "}
      <a
        href="https://discord.gg/UsHE3d5fWF"
        target="_blank"
        rel="noopener noreferrer"
        className="text-composer-text underline underline-offset-2 hover:text-composer-text-bright"
      >
        Discord
      </a>{" "}
      or submit an issue on{" "}
      <a
        href="https://github.com/better-lyrics/composer/issues/new/choose"
        target="_blank"
        rel="noopener noreferrer"
        className="text-composer-text underline underline-offset-2 hover:text-composer-text-bright"
      >
        GitHub
      </a>
      .
    </p>

    <div className="space-y-4">
      <div>
        <h4 className={HEADING}>1. Import your audio</h4>
        <p className={PROSE}>
          Drop an audio file (MP3, WAV, M4A, OGG, FLAC) into the Import tab, or paste a YouTube URL to pull the audio
          from a video. Local files can also be dropped straight onto the Timeline. The waveform appears once the audio
          loads.
        </p>
      </div>
      <div>
        <h4 className={HEADING}>2. Add your lyrics</h4>
        <p className={PROSE}>
          Go to the Edit tab and type or paste your lyrics, one line per row. If you have a lyrics file (.lrc, .srt,
          .ttml, .txt), drop it there instead. You can also use{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.importLyrics")} /> in Timeline to import lyrics without
          leaving that view.
        </p>
      </div>
      <div>
        <h4 className={HEADING}>3. Sync the timing</h4>
        <p className={PROSE}>
          The Sync tab lets you sync words to the music using two keys: tap Space to mark gapless word boundaries, or
          hold F to capture a word's full duration. You can also tap Space while holding F to create gapless syllable
          boundaries. If you miss one, use the arrow keys to nudge the timing. For finer control, switch to Timeline and
          drag word blocks directly on the waveform.
        </p>
      </div>
      <div>
        <h4 className={HEADING}>4. Preview and export</h4>
        <p className={PROSE}>
          The Preview tab shows a live karaoke-style playback of your work. When you're happy with it, go to Export and
          download your TTML file. You can also copy the raw XML or export a project file to share with someone else.
        </p>
      </div>
    </div>

    <p className={PROSE}>
      The tabs are meant to be followed left-to-right, but you can jump between them anytime using {MOD_KEY} + 1 through
      6.
    </p>

    <div className="aspect-video w-full rounded-lg overflow-hidden border border-composer-border">
      <iframe
        src="https://www.youtube.com/embed/IEA0W4qpRIs?rel=0"
        title="Composer tutorial"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full"
      />
    </div>
  </div>
);

// -- Keyboard Shortcuts -------------------------------------------------------

const KeyboardShortcutsSection: React.FC = () => (
  <div className="grid grid-cols-2 gap-x-12 gap-y-6">
    {SHORTCUT_SECTIONS.map((section) => (
      <ShortcutSection key={section.title} {...section} />
    ))}
  </div>
);

// -- Importing Audio ----------------------------------------------------------

const ImportSection: React.FC = () => (
  <div className="space-y-5">
    <div>
      <h4 className={HEADING}>Audio files</h4>
      <p className={PROSE}>Supported formats: MP3, WAV, M4A, OGG, FLAC.</p>
      <ul className={`${PROSE} list-disc pl-4 mt-1.5 space-y-1`}>
        <li>Use the Import tab's drop zone, or drop a file directly onto the Timeline empty state.</li>
        <li>Once loaded, the waveform renders across the top of Timeline.</li>
        <li>The file name auto-fills the project title in metadata.</li>
        <li>To replace audio, just drop a new file on the Import tab.</li>
      </ul>
      <p className={`${PROSE} mt-3`}>
        For YouTube imports, audio comes from a Cobalt backend. Composer ships with a default instance that handles
        verification automatically. If it's slow or unreachable, add or pick a different one in Settings → Advanced.
        Each custom instance shows a small status icon next to its name reflecting the last attempt, with the actual
        error in the tooltip if anything went wrong.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>YouTube URLs</h4>
      <p className={PROSE}>
        Paste any YouTube link (full URL, share link, or just the video ID) into the Import tab. Composer downloads the
        audio once and keeps it in memory, so seeking and waveform rendering stay instant after that.
      </p>
      <ul className={`${PROSE} list-disc pl-4 mt-1.5 space-y-1`}>
        <li>The video title fills in as your project title.</li>
        <li>To swap videos, paste a new URL into the same input on the Import tab.</li>
        <li>If a download fails, check that the URL is right and that the video is public.</li>
        <li>
          A small number of videos won't download due to geo-restrictions or rights blocks. In that case, grab the audio
          some other way and drop the file into the Import tab.
        </li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>Lyrics files</h4>
      <p className={PROSE}>
        Supported formats: .txt (plain text), .lrc (line-level timing), .srt (subtitles), .ttml (full timing + agents).
      </p>
      <ul className={`${PROSE} list-disc pl-4 mt-1.5 space-y-1`}>
        <li>In the Edit tab, use the import button at the top.</li>
        <li>
          In Timeline, press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.importLyrics")} /> or click the
          import button in the header.
        </li>
        <li>When importing .lrc, .srt, or .ttml files, existing timing is preserved.</li>
        <li>Plain .txt files get no timing. You'll sync them manually.</li>
      </ul>
    </div>
  </div>
);

// -- Editing Lyrics -----------------------------------------------------------

const EditSection: React.FC = () => {
  const splitCharacter = useSettingsStore((s) => s.splitCharacter);

  return (
    <div className="space-y-5">
      <p className={PROSE}>
        Each row is one line of lyrics. Type normally, press Enter for a new line. To reorder lines, drag them using the
        handle on the left side.
      </p>

      <div>
        <h4 className={HEADING}>Agents (singers)</h4>
        <p className={PROSE}>
          Click a line's agent dot to assign it to a different singer. Each agent gets a unique color. Add new agents
          with the "+" button in the agent manager at the top.
        </p>
      </div>

      <div>
        <h4 className={HEADING}>Background vocals</h4>
        <p className={PROSE}>
          If a line has backing vocals, add them in the "Background" field that appears below the main text. These show
          up as a separate track in the Timeline and get the x-bg role in TTML output.
        </p>
      </div>

      <div>
        <h4 className={HEADING}>Syllable pre-splitting</h4>
        <p className={PROSE}>
          Use the <span className="font-mono text-composer-text">{splitCharacter}</span> character to mark where you
          want words split. For example, typing beau{splitCharacter}ti{splitCharacter}ful creates three separate timed
          blocks instead of one. This is useful when a word stretches across several beats. You can change this
          character in Settings.
        </p>
      </div>

      <div>
        <h4 className={HEADING}>Selecting multiple lines</h4>
        <p className={PROSE}>
          Click a line to select it. Shift + Click another line to select the whole range between them. You can also
          click and drag on the line numbers in the gutter to select a range that way. Selected lines can be deleted or
          have agents reassigned in bulk.
        </p>
      </div>

      <div>
        <h4 className={HEADING}>Editing grouped lines</h4>
        <p className={PROSE}>
          Lines that belong to a linked group show a thin colored stripe on their left edge, matching the group color.
          Hover one to see which group it belongs to and how many other instances are linked.
        </p>
        <p className={`${PROSE} mt-2`}>
          Edits you make to a grouped line's text, agent, or background vocals fan out to every other instance of the
          same template line. Word-level timings survive when the new text has the same word count: existing word slots
          keep their begin/end and just swap text. If the word count changes, sibling timings clear so you can re-sync
          them in the Sync view.
        </p>
        <p className={`${PROSE} mt-2`}>
          Adding or removing rows inside a grouped instance pops a confirmation: that one instance detaches from the
          group so the structural change can land, while every sibling instance stays linked. Decline to revert. Edits
          to non-grouped lines never prompt.
        </p>
      </div>
    </div>
  );
};

// -- Syncing ------------------------------------------------------------------

const SyncSection: React.FC = () => (
  <div className="space-y-5">
    <p className={PROSE}>
      The Sync tab shows your lyrics as a scrolling carousel. One line is active at a time, with each word waiting to be
      synced. You have two keys available, and you can use them freely in combination.
    </p>

    <div>
      <h4 className={HEADING}>Tap (Space)</h4>
      <p className={PROSE}>
        Press <InlineKeyBadge keys={getEffectiveKeysArray("sync.tap")} /> to start playback and begin syncing. As the
        music plays, tap <InlineKeyBadge keys={getEffectiveKeysArray("sync.tap")} /> on each word right when the singer
        says it. Each tap marks the word's start time, and the previous word's end time is set to the same moment,
        creating gapless transitions.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Hold (F)</h4>
      <p className={PROSE}>
        Press and hold <InlineKeyBadge keys={getEffectiveKeysArray("sync.holdSync")} /> for the duration of each word.
        The key-down marks the word's start, and key-up marks the end. This gives you explicit control over word
        duration and allows natural gaps between words. The current word highlights while you hold.
      </p>
      <p className={`${PROSE} mt-2`}>For words with natural gaps between them, just hold and release for each word:</p>
      <ul className={`${PROSE} list-disc pl-4 mt-1.5 space-y-1`}>
        <li>Hold F: "hello" starts</li>
        <li>Release F: "hello" ends</li>
        <li>(wait for gap)</li>
        <li>Hold F: "world" starts</li>
        <li>Release F: "world" ends</li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>Gapless syllables (Hold F + Tap Space)</h4>
      <p className={PROSE}>
        For syllables that flow together without pauses, tap <InlineKeyBadge keys={getEffectiveKeysArray("sync.tap")} />{" "}
        while holding <InlineKeyBadge keys={getEffectiveKeysArray("sync.holdSync")} /> to create gapless boundaries.
        Each tap ends the current syllable and immediately starts the next. Release{" "}
        <InlineKeyBadge keys={getEffectiveKeysArray("sync.holdSync")} /> to end the last one:
      </p>
      <ul className={`${PROSE} list-disc pl-4 mt-1.5 space-y-1`}>
        <li>Hold F: "beau" starts</li>
        <li>Tap Space (still holding F): "beau" ends, "ti" starts at the same moment</li>
        <li>Tap Space (still holding F): "ti" ends, "ful" starts at the same moment</li>
        <li>Release F: "ful" ends</li>
      </ul>
      <p className={`${PROSE} mt-2`}>
        You can mix all styles naturally within the same line. Use hold-release for standalone words, tap for quick
        gapless words, and hold+tap for connected syllables:
      </p>
      <ul className={`${PROSE} list-disc pl-4 mt-1.5 space-y-1`}>
        <li>Hold F, release F: "oh" gets its own timing</li>
        <li>(gap)</li>
        <li>Hold F: "beau" starts</li>
        <li>Tap Space, tap Space: gapless boundaries for "ti" and "ful"</li>
        <li>Release F: "ful" ends</li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>Made a mistake?</h4>
      <p className={PROSE}>
        Press <InlineKeyBadge keys={getEffectiveKeysArray("sync.nudgeLeft")} /> to nudge the last synced word 50ms
        earlier. <InlineKeyBadge keys={getEffectiveKeysArray("sync.nudgeRight")} /> nudges it 50ms later. You can also
        press {MOD_KEY} + Z to undo. Each hold produces two undo steps (start and end) so you can step back precisely.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Line-level vs word-level</h4>
      <p className={PROSE}>
        By default, you're syncing word by word. The granularity toggle at the top lets you switch to line-level if you
        only need rough timing.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Re-syncing a line</h4>
      <p className={PROSE}>
        If a whole line went wrong, just navigate back to it and sync again. New taps overwrite old timing.
      </p>
    </div>

    <p className={PROSE}>
      After syncing, your words have timing data. The Sync tab works at the line or word level, but for precise per-word
      timing adjustments, Timeline is where you drag, resize, and snap individual word blocks. Head there for
      fine-tuning, or go straight to Preview to see how it looks.
    </p>
  </div>
);

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
          Syllables of the same word have <strong>conjoined boundaries</strong> by default. Dragging the boundary
          between them moves both sides together, preventing gaps.
        </li>
        <li>
          Hold <strong>{ALT_KEY}</strong> while dragging to flip the mode: syllable boundaries become independent (gaps
          allowed), and separate word boundaries become conjoined.
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
          Select two or more adjacent words on the same line and press{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.mergeWords")} /> to merge them into one block.
        </li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>Right-click menus</h4>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>Right-click a word: Edit text, Split syllables, Merge (if multiple selected), Delete.</li>
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

// -- Linked Groups ------------------------------------------------------------

const GroupsSection: React.FC = () => (
  <div className="space-y-5">
    <p className={PROSE}>
      A group is a set of contiguous lines that repeat in the song (chorus, verse, bridge). Group them once and edits to
      text, splits, agents, or background vocals propagate to every instance. Each instance still owns its own absolute
      timing, so you can shift one chorus by 5 seconds without moving the others.
    </p>

    <div>
      <h4 className={HEADING}>Why bother</h4>
      <p className={PROSE}>
        If your song repeats the chorus four times, you'd otherwise edit four copies of every lyric tweak. Group them
        and a fix in one place lands in all four. Same for splitting a syllable, switching a word to background vocals,
        or reassigning an agent.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Creating a group</h4>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>Select the lines you want to group (click, then Shift-click the last line, or drag down the gutter).</li>
        <li>
          Press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.createGroup")} />, or right-click any selected
          line and pick "Group N lines".
        </li>
        <li>
          If your selection skips a line by accident, Composer fills the gap and tells you so in the toast. If a line in
          the gap already belongs to another group, it refuses and asks you to fix the selection.
        </li>
        <li>The new group gets a color from the palette and shows up as a banner above the first line.</li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>Adding more instances</h4>
      <p className={PROSE}>
        Click the banner of the instance you want to copy, then press{" "}
        <InlineKeyBadge keys={getEffectiveKeysArray("timeline.duplicateAsLinked")} /> (or right-click the banner and
        pick "Add instance at playhead"). Composer picks one of three landings, in this order:
      </p>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          <strong>Fills empty placeholder rows in place</strong> if a matching run of empty rows sits right after the
          last timed line ending at or before the playhead. Nothing shifts down, the placeholders just light up.
        </li>
        <li>
          <strong>Inserts new rows at the playhead</strong> if there's no fillable run but the playhead falls in a clean
          time gap big enough for the instance.
        </li>
        <li>
          <strong>Copies the instance to the clipboard and opens the paste-preview ghost</strong> if the playhead is
          inside a playing line, the gap is too small, or you've already passed the last lyric. Toast says where to go
          next: "No room at the playhead. {MOD_KEY} + V to paste somewhere clear." Move the cursor to a row you like and
          click to drop it.
        </li>
      </ul>
      <p className={`${PROSE} mt-2`}>
        You can also use the regular clipboard: select every word of an instance ({MOD_KEY} + C with the banner
        selected), then paste ({MOD_KEY} + V) somewhere else. Same fill/insert behavior at the destination.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>The banner</h4>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          <strong>Click anywhere on it</strong>: selects every word in the instance. Use this before arrow-key nudge,
          {MOD_KEY} + C, or any of the keyboard shortcuts below.
        </li>
        <li>
          <strong>Drag horizontally</strong>: shifts the entire instance in time. Sibling instances stay put. The lines
          move along with the banner so you can line things up by eye.
        </li>
        <li>
          <strong>Click the chevron</strong>: collapses the instance into a single strip. A faint progress bar fills the
          strip during playback so you can still tell where you are in the section.
        </li>
        <li>
          <strong>Right-click</strong>: opens the group menu (rename, recolor, add instance, shift to playhead, detach
          instance, delete group).
        </li>
        <li>
          <strong>Double-click anywhere on the header row</strong>: drops the gutter label into an inline input so you
          can rename the group. Enter saves, Escape cancels. The Rename item in the right-click menu does the same
          thing.
        </li>
        <li>
          <strong>Hover the "1 of N" badge</strong>: every sibling instance pings briefly with the group's color so you
          can spot them on the timeline. Or press{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.pingSiblings")} /> for the same effect from the
          keyboard.
        </li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>Keyboard shortcuts</h4>
      <p className={PROSE}>
        Most of these act on the instance containing your current selection. Click a banner first to "focus" an
        instance.
      </p>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.createGroup")} />: group selected lines.
        </li>
        <li>
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.duplicateAsLinked")} />: add a linked instance at the
          playhead.
        </li>
        <li>
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.toggleCollapseInstance")} /> /{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.toggleAllCollapsed")} />: collapse the current instance,
          or every instance.
        </li>
        <li>
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.jumpPrevInstance")} /> /{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.jumpNextInstance")} />: jump to the previous or next
          instance of the same group. Wraps around.
        </li>
        <li>
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.nudgeLeft")} /> /{" "}
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.nudgeRight")} />: nudge the current instance earlier or
          later by the nudge amount in Settings.
        </li>
        <li>
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.pingSiblings")} />: ping every sibling instance.
        </li>
        <li>
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.detachInstance")} />: detach the current instance from
          the group.
        </li>
        <li>
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.deleteGroup")} />: delete the current group (asks for
          confirmation first).
        </li>
        <li>
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.shiftInstanceToPlayhead")} />: shift the current
          instance so its first word lands on the playhead.
        </li>
        <li>
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.jumpToInstanceStart")} />: scroll the timeline to the
          start of the current instance without changing the selection.
        </li>
      </ul>
      <p className={`${PROSE} mt-2`}>All of these are remappable in Settings → Shortcuts.</p>
    </div>

    <div>
      <h4 className={HEADING}>Suggestions banner</h4>
      <p className={PROSE}>
        When the timeline detects two or more contiguous runs of identical lines that aren't grouped yet, a small bulb
        banner appears under the toolbar. One suggestion shows inline with a Group them button. Multiple suggestions
        collapse into a Review N button that opens a modal with each block previewed and a per-row Group / dismiss
        action, plus a Group all button.
      </p>
      <p className={`${PROSE} mt-2`}>
        Dismissals are per-project and content-based, so adding or removing unrelated lines elsewhere will not bring a
        suggestion back. Editing the actual text inside a dismissed block does, since the structure has changed.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Pasting between instances</h4>
      <p className={PROSE}>Two paste flows can land in an instance, and both behave the same way at the destination:</p>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          Copy every word of an existing instance and paste somewhere. Composer treats the clipboard as a known instance
          and links the destination automatically.
        </li>
        <li>
          Copy every word of standalone lines whose text and word splits already match an existing template. Composer
          asks "Link as another [Chorus]?". Yes links, No falls back to a regular word paste.
        </li>
      </ul>
      <p className={`${PROSE} mt-2`}>
        In both cases the destination is filled in place if there are enough empty rows starting at the cursor. If there
        aren't, Composer asks before inserting new rows, since that would shift everything below down by N. Add rows in
        the Edit view first if you want predictable layout.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>What propagates and what doesn't</h4>
      <p className={PROSE}>Linked across all instances:</p>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>Word text and line text edits.</li>
        <li>Agent assignments.</li>
        <li>Background vocal text.</li>
        <li>
          Word splits and merges. Siblings get the new word structure, and Composer keeps the timing of every word that
          didn't actually change. Only the split or merged word's slot is divided up. Sibling rhythms you carefully
          synced earlier survive.
        </li>
        <li>Moving a word between main and background tracks.</li>
      </ul>
      <p className={`${PROSE} mt-2`}>Stays local to one instance:</p>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>Absolute begin and end times for each word.</li>
        <li>Banner shifts and arrow-key nudge.</li>
        <li>Anything you do on a line that's been detached.</li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>The split-or-merge prompt</h4>
      <p className={PROSE}>
        When a split or merge on a linked line would actually shift sibling word timings (sibling rhythms differ from
        the source), Composer pops a three-button modal: <strong>Apply to all</strong> (propagate with timing
        preservation), <strong>Detach</strong> (keep the change on this line only, unlink it from the group), or{" "}
        <strong>Cancel</strong>. The modal stays out of the way when sibling rhythms already match the source, since
        propagation is a no-op for the unchanged words anyway.
      </p>
      <p className={`${PROSE} mt-2`}>
        Tick "Don't ask again" in the modal to default to your choice next time. Reset the preference from{" "}
        <strong>Settings → Confirmations</strong>.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Detaching</h4>
      <p className={PROSE}>
        Real songs aren't perfectly repetitive. The last chorus might add an extra "yeah" or land on a different agent.
        Two ways to break the link:
      </p>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          Right-click a line in the gutter and pick <strong>Detach this line</strong>. That single line stops syncing
          with siblings; everything else stays linked.
        </li>
        <li>
          Right-click the banner and pick <strong>Detach instance</strong>. The whole instance becomes plain standalone
          lines. Other instances keep their group.
        </li>
      </ul>
      <p className={`${PROSE} mt-2`}>
        Both are undoable: the toast that appears has an Undo button, or press {MOD_KEY} + Z.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Emptying an instance</h4>
      <p className={PROSE}>
        Click the banner to select every word in an instance, then press <strong>Delete</strong>. Composer clears the
        timed content and notices the instance is now empty across all its lines, so it strips the group attrs from
        those rows automatically. You're left with empty placeholders that the fill flow above can repopulate later. The
        other instances of the group are untouched.
      </p>
      <p className={`${PROSE} mt-2`}>
        Partial deletes don't trigger this: if one line of a multi-line instance still has timed words, the instance
        stays linked.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Deleting a group</h4>
      <p className={PROSE}>
        Right-click any banner and pick <strong>Delete group</strong>. A confirmation modal warns you that all instances
        will become standalone (text and timing survive, they just stop syncing). Tick "Don't ask again" to skip the
        modal next time, or restore the prompt from <strong>Settings → Confirmations</strong>.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>How groups look outside the Timeline</h4>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          <strong>Edit view</strong>: a colored divider with the group name and instance count appears before each
          instance, plus a thin closing line at the end. Each grouped line also gets a left-edge stripe in the group
          color and a hover tooltip showing the link count.
        </li>
        <li>
          <strong>Sync view</strong>: the gutter cell shows a chain icon and an instance counter so you know which
          chorus you're syncing.
        </li>
        <li>
          <strong>TTML export</strong>: groups round-trip via a custom <code>composer:groups</code> registry plus
          per-line attributes. Other TTML players ignore them; Composer reads them back exactly as saved.
        </li>
      </ul>
    </div>
  </div>
);

// -- Preview ------------------------------------------------------------------

const PreviewSection: React.FC = () => (
  <div className="space-y-4">
    <p className={PROSE}>
      The Preview tab shows you how your synced lyrics will look with{" "}
      <a
        href="https://betterlyrics.org"
        target="_blank"
        rel="noopener noreferrer"
        className="text-composer-text underline underline-offset-2 hover:text-composer-text-bright"
      >
        Better Lyrics
      </a>
      ' rendering engine. Words fill in progressively as they're sung, matching the timing you set.
    </p>
    <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
      <li>Agent lines are positioned based on their inferred location (left, right, center).</li>
      <li>Background vocals appear below the main line in a smaller style.</li>
      <li>
        Use this to spot timing issues. If a word highlights too early or too late, go back to Timeline and adjust.
      </li>
      <li>Playback controls (play/pause, seek) work the same as everywhere else.</li>
      <li>
        Instrumental sections appear automatically wherever there's a gap longer than 5 seconds between sung lines.
        Better Lyrics handles this at render time. You can't add them manually or preview them here, just trust that
        they'll show up in the final output.
      </li>
    </ul>
  </div>
);

// -- Exporting ----------------------------------------------------------------

const ExportSection: React.FC = () => (
  <div className="space-y-5">
    <p className={PROSE}>The Export tab shows a syntax-highlighted preview of your TTML output.</p>
    <ul className={`${PROSE} list-disc pl-4 space-y-1.5`}>
      <li>
        <strong>Download TTML</strong>: Saves the file to your computer. The filename uses your project title.
      </li>
      <li>
        <strong>Copy</strong>: Copies the minified TTML to your clipboard.
      </li>
      <li>
        <strong>Edit</strong>: Lets you manually tweak the XML before downloading. Click "Regenerate" to go back to the
        auto-generated version.
      </li>
      <li>
        <strong>Project files</strong>: Use "Export Project" to save a .json file with all your data (lyrics, timing,
        agents, metadata). Use "Import Project" to load one back. This is how you share work with collaborators or back
        things up.
      </li>
      <li>
        <strong>Clear</strong>: Wipes the current project. This is permanent, so it asks for confirmation.
      </li>
    </ul>
    <p className={PROSE}>
      The counter at the top shows how many lines have timing data. Unsynced lines are skipped in the export.
    </p>

    <div>
      <h4 className={HEADING}>Recovering a stuck or crashed session</h4>
      <p className={PROSE}>
        Composer autosaves to your browser's IndexedDB on every change. If the app errors out, the error screen has a{" "}
        <strong>Download my work</strong> button that pulls the autosave directly. If the app is frozen and won't
        respond to clicks, open{" "}
        <a
          href="/recover"
          target="_blank"
          rel="noopener noreferrer"
          className="text-composer-text underline underline-offset-2 hover:text-composer-text-bright"
        >
          /recover
        </a>{" "}
        in a new tab: it reads the same autosave and downloads it. You can also press{" "}
        <strong>{MOD_KEY} + Shift + E</strong> anywhere in the app for the same download. Drop the file back into
        Composer via <strong>Import Project</strong> to continue.
      </p>
    </div>
  </div>
);

const TtmlStandardsSection: React.FC = () => (
  <div className="space-y-5">
    <h4 className={HEADING}>What Composer outputs</h4>
    <p className={PROSE}>
      Composer emits{" "}
      <a
        href="https://www.w3.org/TR/2018/REC-ttml1-20181108/"
        target="_blank"
        rel="noreferrer"
        className="text-composer-accent-text hover:text-composer-accent underline-offset-2 hover:underline"
      >
        TTML 1
      </a>{" "}
      (W3C Recommendation, November 2018). The output is well-formed XML that any TTML 1 conformant parser can read,
      including the standard structure: <code>&lt;tt&gt;</code> root with the TTML namespace, <code>&lt;head&gt;</code>{" "}
      with <code>&lt;ttm:title&gt;</code> and <code>&lt;ttm:agent&gt;</code> declarations, and{" "}
      <code>&lt;body&gt;&lt;div&gt;&lt;p&gt;</code> for lines with <code>&lt;span&gt;</code> per word for word-level
      timing.
    </p>
    <p className={PROSE}>
      Background vocals use <code>ttm:role="x-bg"</code>, which is the spec-sanctioned <code>x-</code> extension prefix
      for custom roles. Singer assignments go through the standard <code>ttm:agent</code> reference.
    </p>

    <h4 className={HEADING}>Foreign-namespace extensions</h4>
    <p className={PROSE}>
      For features that don't have a place in the core TTML 1 vocabulary, like linked groups and per-instance metadata,
      Composer uses the foreign-namespace extension mechanism in{" "}
      <a
        href="https://www.w3.org/TR/2018/REC-ttml1-20181108/#extension-vocabulary-overview"
        target="_blank"
        rel="noreferrer"
        className="text-composer-accent-text hover:text-composer-accent underline-offset-2 hover:underline"
      >
        §5.3.2 Extension Catalog
      </a>{" "}
      of the spec. The spec explicitly permits "arbitrary namespace qualified elements that reside in any namespace
      other than those namespaces defined for use with this specification" and the same for attributes on TTML-defined
      vocabulary. That's the W3C-sanctioned way to add application-specific data while keeping the document conformant.
    </p>
    <p className={PROSE}>
      Composer's namespace URI is <code>https://composer.boidu.dev/ttml</code>. Custom attributes show up as{" "}
      <code>composer:groupId</code>, <code>composer:instanceIdx</code>, and so on, on the root <code>&lt;tt&gt;</code>{" "}
      element and on <code>&lt;p&gt;</code> elements that belong to a linked group. A{" "}
      <code>&lt;composer:groups&gt;</code> block lives inside <code>&lt;metadata&gt;</code> to declare the group
      registry (id, label, color).
    </p>

    <h4 className={HEADING}>Why this matters</h4>
    <p className={PROSE}>
      You can hand a Composer file to any TTML 1 parser and it will work. Tools that don't recognize the{" "}
      <code>composer:</code> namespace can safely skip the extensions: foreign attributes get pruned during validation
      (per{" "}
      <a
        href="https://www.w3.org/TR/2018/REC-ttml1-20181108/#document-types"
        target="_blank"
        rel="noreferrer"
        className="text-composer-accent-text hover:text-composer-accent underline-offset-2 hover:underline"
      >
        §4 Document Types
      </a>
      ) so the document stays valid, and the rest of the file renders normally. The extensions are additive and scoped
      to a clearly identified namespace, so there's no chance of attribute collision with other tools that extend TTML
      for their own purposes.
    </p>

    <h4 className={HEADING}>References</h4>
    <ul className={`${PROSE} list-disc pl-4 space-y-1.5`}>
      <li>
        <a
          href="https://www.w3.org/TR/2018/REC-ttml1-20181108/"
          target="_blank"
          rel="noreferrer"
          className="text-composer-accent-text hover:text-composer-accent underline-offset-2 hover:underline"
        >
          TTML 1 W3C Recommendation
        </a>{" "}
        (the spec)
      </li>
      <li>
        <a
          href="https://github.com/w3c/ttml1"
          target="_blank"
          rel="noreferrer"
          className="text-composer-accent-text hover:text-composer-accent underline-offset-2 hover:underline"
        >
          W3C TTML 1 repository
        </a>{" "}
        (issues, errata, source)
      </li>
      <li>
        <a
          href="https://www.w3.org/TR/2018/REC-ttml1-20181108/#extension-vocabulary-overview"
          target="_blank"
          rel="noreferrer"
          className="text-composer-accent-text hover:text-composer-accent underline-offset-2 hover:underline"
        >
          §5.3.2 Extension Catalog
        </a>{" "}
        (the section that permits foreign-namespace extensions)
      </li>
      <li>
        <a
          href="https://github.com/w3c/ttml1/issues/251"
          target="_blank"
          rel="noreferrer"
          className="text-composer-accent-text hover:text-composer-accent underline-offset-2 hover:underline"
        >
          w3c/ttml1#251
        </a>{" "}
        (Working Group discussion clarifying that vocabulary the spec doesn't define gets pruned before validation, so
        documents stay valid)
      </li>
    </ul>
  </div>
);

// -- About --------------------------------------------------------------------

const AboutSection: React.FC = () => (
  <div className="space-y-5">
    <div className="relative -mx-6 -mt-6">
      <div className="absolute inset-0 bg-gradient-to-b from-composer-accent/20 to-transparent pointer-events-none" />
      <div className="relative px-6 pt-7 pb-8 flex items-center gap-5">
        <img src="/logo.svg" alt="Composer" className="size-14 shrink-0" />
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold leading-tight tracking-tight">Composer</h2>
          <p className="text-sm text-composer-text-secondary">The lyrics editor for Better Lyrics.</p>
          <p className="text-xs text-composer-text-muted font-mono mt-2">v{__APP_VERSION__}</p>
        </div>
      </div>
    </div>

    <div>
      <h4 className={HEADING}>What it is</h4>
      <p className={PROSE}>
        Free and open-source, runs entirely in your browser. No accounts, nothing leaves your machine. Bring your audio
        and lyrics, sync them up, export TTML.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Open source</h4>
      <p className={PROSE}>
        AGPL v3. Source on{" "}
        <a
          href="https://github.com/better-lyrics/composer"
          target="_blank"
          rel="noopener noreferrer"
          className="text-composer-text underline underline-offset-2 hover:text-composer-text-bright"
        >
          GitHub
        </a>
        . PRs welcome if you spot something to fix.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Community</h4>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          <a
            href="https://discord.gg/UsHE3d5fWF"
            target="_blank"
            rel="noopener noreferrer"
            className="text-composer-text underline underline-offset-2 hover:text-composer-text-bright"
          >
            Discord
          </a>{" "}
          for questions and chat.
        </li>
        <li>
          <a
            href="https://github.com/better-lyrics/composer/issues/new/choose"
            target="_blank"
            rel="noopener noreferrer"
            className="text-composer-text underline underline-offset-2 hover:text-composer-text-bright"
          >
            File an issue
          </a>{" "}
          if something's broken.
        </li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>Made by</h4>
      <p className={PROSE}>
        <a
          href="https://boidu.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-composer-text underline underline-offset-2 hover:text-composer-text-bright"
        >
          Boidu
        </a>
        , with thanks to everyone in the{" "}
        <a
          href="https://betterlyrics.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-composer-text underline underline-offset-2 hover:text-composer-text-bright"
        >
          Better Lyrics
        </a>{" "}
        community who's tested it, reported bugs, and put up with the rough edges.
      </p>
    </div>
  </div>
);

// -- Section Router -----------------------------------------------------------

const HelpSectionContent: React.FC<{ section: string }> = ({ section }) => {
  switch (section) {
    case "about":
      return <AboutSection />;
    case "getting-started":
      return <GettingStartedSection />;
    case "keyboard-shortcuts":
      return <KeyboardShortcutsSection />;
    case "importing":
      return <ImportSection />;
    case "editing":
      return <EditSection />;
    case "syncing":
      return <SyncSection />;
    case "timeline":
      return <TimelineSection />;
    case "groups":
      return <GroupsSection />;
    case "preview":
      return <PreviewSection />;
    case "exporting":
      return <ExportSection />;
    case "ttml-standards":
      return <TtmlStandardsSection />;
    default:
      return <GettingStartedSection />;
  }
};

// -- Exports ------------------------------------------------------------------

export { HelpSectionContent };
