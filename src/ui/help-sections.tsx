import { ShortcutSection, SHORTCUT_SECTIONS } from "@/ui/help-modal";

// -- Constants ----------------------------------------------------------------

const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
const MOD_KEY = isMac ? "Cmd" : "Ctrl";

const PROSE = "text-sm text-composer-text-secondary leading-relaxed";
const HEADING = "text-sm font-medium";

// -- Getting Started ----------------------------------------------------------

const GettingStartedSection: React.FC = () => (
  <div className="space-y-5">
    <p className={PROSE}>
      Composer is the lyrics editor for{" "}
      <a
        href="https://better-lyrics.boidu.dev"
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
          Drop an audio file (MP3, WAV, M4A, OGG, FLAC) into the Import tab. You can also drop it directly onto
          Timeline. The waveform appears once the file loads.
        </p>
      </div>
      <div>
        <h4 className={HEADING}>2. Add your lyrics</h4>
        <p className={PROSE}>
          Go to the Edit tab and type or paste your lyrics, one line per row. If you have a lyrics file (.lrc, .srt,
          .ttml, .txt), drop it there instead. You can also use {MOD_KEY} + Shift + V in Timeline to import lyrics
          without leaving that view.
        </p>
      </div>
      <div>
        <h4 className={HEADING}>3. Sync the timing</h4>
        <p className={PROSE}>
          The Sync tab lets you tap or hold along with the music to stamp each word. In Tap mode, press Space on every
          word as it's sung. In Hold mode, hold F for the duration of each word to capture both start and end times. If
          you miss one, use the arrow keys to nudge the timing. For finer control, switch to Timeline and drag word
          blocks directly on the waveform.
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
    </div>

    <div>
      <h4 className={HEADING}>Lyrics files</h4>
      <p className={PROSE}>
        Supported formats: .txt (plain text), .lrc (line-level timing), .srt (subtitles), .ttml (full timing + agents).
      </p>
      <ul className={`${PROSE} list-disc pl-4 mt-1.5 space-y-1`}>
        <li>In the Edit tab, use the import button at the top.</li>
        <li>In Timeline, press {MOD_KEY} + Shift + V or click the import button in the header.</li>
        <li>When importing .lrc, .srt, or .ttml files, existing timing is preserved.</li>
        <li>Plain .txt files get no timing. You'll sync them manually.</li>
      </ul>
    </div>
  </div>
);

// -- Editing Lyrics -----------------------------------------------------------

const EditSection: React.FC = () => (
  <div className="space-y-5">
    <p className={PROSE}>
      Each row is one line of lyrics. Type normally, press Enter for a new line. To reorder lines, drag them using the
      handle on the left side.
    </p>

    <div>
      <h4 className={HEADING}>Agents (singers)</h4>
      <p className={PROSE}>
        Click a line's agent dot to assign it to a different singer. Each agent gets a unique color. Add new agents with
        the "+" button in the agent manager at the top.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Background vocals</h4>
      <p className={PROSE}>
        If a line has backing vocals, add them in the "Background" field that appears below the main text. These show up
        as a separate track in the Timeline and get the x-bg role in TTML output.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Syllable pre-splitting</h4>
      <p className={PROSE}>
        Use the pipe character | to mark where you want words split. For example, typing beau|ti|ful creates three
        separate timed blocks instead of one. This is useful when a word stretches across several beats.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Selecting multiple lines</h4>
      <p className={PROSE}>
        Click a line to select it. Alt + Click to select a range. Selected lines can be deleted or have agents
        reassigned in bulk.
      </p>
    </div>
  </div>
);

// -- Syncing ------------------------------------------------------------------

const SyncSection: React.FC = () => (
  <div className="space-y-5">
    <p className={PROSE}>
      The Sync tab shows your lyrics as a scrolling carousel. One line is active at a time, with each word waiting to be
      synced. There are two sync methods you can switch between using the toggle in the header.
    </p>

    <div>
      <h4 className={HEADING}>Tap mode</h4>
      <p className={PROSE}>
        Press <strong>Space</strong> to start playback and begin syncing. As the music plays, tap <strong>Space</strong>{" "}
        on each word right when the singer says it. Each tap marks the word's start time, and the previous word's end
        time is inferred from the next tap.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Hold mode</h4>
      <p className={PROSE}>
        Press and hold <strong>F</strong> for the duration of each word. The key-down marks the word's start, and key-up
        marks the end. This gives you explicit control over word duration and allows natural gaps between words. The
        current word highlights while you hold.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Made a mistake?</h4>
      <p className={PROSE}>
        Press the left arrow key to nudge the last synced word 50ms earlier. Right arrow nudges it 50ms later. You can
        also press {MOD_KEY} + Z to undo. In hold mode, each hold produces two undo steps (start and end) so you can
        step back precisely.
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
          Press <strong>F</strong> to toggle "follow playhead" so the view scrolls automatically during playback.
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
          Press <strong>E</strong> or <strong>F2</strong> with a word selected to start editing.
        </li>
        <li>
          Use <strong>[</strong> and <strong>]</strong> to snap a word's start or end to the current playhead position.
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
        <li>Alt + drag selected words to duplicate them.</li>
        <li>Press Delete or Backspace to remove selected words.</li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>Splitting and merging</h4>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          Press <strong>S</strong> with a word selected to open the syllable splitter. Click between letters to mark
          where the word should break. If the playhead is on the word when you confirm a single split, the timing
          boundary snaps to the playhead position exactly.
        </li>
        <li>
          Select two or more adjacent words on the same line and press <strong>M</strong> to merge them into one block.
        </li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>Right-click menus</h4>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>Right-click a word: Edit text, Split syllables, Merge (if multiple selected), Delete.</li>
        <li>Right-click empty track space: Add word here.</li>
        <li>Right-click the gutter: Add line above/below, Assign agent, Delete line.</li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>Header toolbar</h4>
      <ul className={`${PROSE} list-disc pl-4 space-y-1`}>
        <li>
          <strong>Follow</strong> (<strong>F</strong>) - Auto-scrolls the view to keep the playhead visible during
          playback.
        </li>
        <li>
          <strong>Select</strong> - Disables double-click word creation so you can click freely without accidentally
          adding words.
        </li>
        <li>
          <strong>Preview</strong> (<strong>P</strong>) - Opens a live lyrics preview sidebar on the right.
        </li>
        <li>
          <strong>Import</strong> ({MOD_KEY} + Shift + V) - Import lyrics directly into the Timeline without switching
          tabs.
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
          Press <strong>N</strong> with a word selected to insert a new empty line below it.
        </li>
        <li>The info panel at the bottom shows details for the selected word, including background text editing.</li>
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
        href="https://better-lyrics.boidu.dev"
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
  </div>
);

// -- Section Router -----------------------------------------------------------

const HelpSectionContent: React.FC<{ section: string }> = ({ section }) => {
  switch (section) {
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
    case "preview":
      return <PreviewSection />;
    case "exporting":
      return <ExportSection />;
    default:
      return <GettingStartedSection />;
  }
};

// -- Exports ------------------------------------------------------------------

export { HelpSectionContent };
