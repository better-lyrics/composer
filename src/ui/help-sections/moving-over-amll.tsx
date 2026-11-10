import { LYRICS_FORMATS_PROSE } from "@/domain/lyrics-file/supported-formats";
import { useSettingsStore } from "@/stores/settings";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { type Habit, HabitTable, PresetIntro, PresetKey } from "@/ui/help-sections/habit-table";
import { HelpTable } from "@/ui/help-table";
import { HelpTopic } from "@/ui/help-topic";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { INLINE_CODE, PROSE } from "@/ui/typography";

// -- Constants -----------------------------------------------------------------

const LIST = `${PROSE} list-disc pl-[18px] marker:text-(--muted) mt-1.5 space-y-1`;

const AMLL_HABITS: readonly Habit[] = [
  { action: "Start a word", shortcutIds: ["timeline.setWordBegin"] },
  { action: "End a word", shortcutIds: ["timeline.setWordEnd"] },
  { action: "End a word and start the next", shortcutIds: ["timeline.stepWord"] },
  { action: "Play or pause", shortcutIds: ["global.playPause"] },
  { action: "Seek back or forward", shortcutIds: ["global.seekBackward", "global.seekForward"] },
];

// -- Components ----------------------------------------------------------------

const AmllTimingKeys: React.FC = () => (
  <>
    <PresetKey preset="amll" shortcutId="timeline.setWordBegin" />,{" "}
    <PresetKey preset="amll" shortcutId="timeline.stepWord" /> and{" "}
    <PresetKey preset="amll" shortcutId="timeline.setWordEnd" />
  </>
);

const AmllWorkModel: React.FC = () => {
  const splitCharacter = useSettingsStore((state) => state.splitCharacter);
  const rows = [
    {
      key: "work",
      cells: [
        "What you're working on",
        "A TTML file you open and save.",
        "A project that saves as you go. You export TTML at the end.",
      ],
    },
    {
      key: "moving",
      cells: [
        "Getting around",
        "Edit, Sync and Preview modes.",
        "Tabs, Import through Export. Go to any tab at any time.",
      ],
    },
    {
      key: "words",
      cells: [
        "Words",
        "Fields you fill in one by one.",
        <>
          Plain text you type in Edit. A space starts a word, <span className={INLINE_CODE}>{splitCharacter}</span>{" "}
          splits a syllable. Edit the text later and untouched words keep their timing.
        </>,
      ],
    },
    {
      key: "timing",
      cells: [
        "Timing",
        "One pass: the cursor walks the words and you stamp each one.",
        "Usually two. Tap through the song in Sync, then fix words on the Timeline, where each word is a block on the waveform.",
      ],
    },
    {
      key: "voices",
      cells: [
        "Voices",
        "Flags on a line for background and duet.",
        "Named singers. You give each line to a singer, and background vocals get their own lane under the line.",
      ],
    },
    { key: "translations", cells: ["Translations", "Fields on each line.", "The Languages tab."] },
    { key: "song", cells: ["The song", "Loaded again each session.", "Kept in the project."] },
  ];

  return (
    <HelpTopic title="AMLL Tool: how the work changes">
      <p className={PROSE}>
        AMLL Tool keeps everything in one place. Composer breaks the work into steps, one tab each, so you deal with one
        job at a time.
      </p>
      <HelpTable head={["", "AMLL Tool", "Composer"]} rows={rows} />
      <p className={`${PROSE} mt-3`}>
        <AmllTimingKeys /> belong on the Timeline. Turn on Step timing there and they move through the words like your
        cursor did. Sync is for the first pass, where you tap one key live as the song plays.
      </p>
      <p className={`${PROSE} mt-2`}>
        If a chorus comes back, group its lines and time it once. The other copies get the same timing.
      </p>
      <p className={`${PROSE} mt-2`}>
        To try it, import a <span className={INLINE_CODE}>.ttml</span> you've already made, open the Timeline, turn on
        Step timing and fix a few words. On your next new song, do the first pass in Sync.
      </p>
    </HelpTopic>
  );
};

const AmllKeys: React.FC = () => (
  <HelpTopic title="AMLL Tool keys">
    <PresetIntro preset="amll">
      The AMLL Tool keys put <AmllTimingKeys /> back where your hands expect them.
    </PresetIntro>
    <HabitTable preset="amll" habits={AMLL_HABITS} />
    <p className={`${PROSE} mt-3`}>
      <InlineKeyBadge keys={getEffectiveKeysArray("timeline.stepWord")} className="ml-0" /> only steps while Step timing
      is on, and <InlineKeyBadge keys={getEffectiveKeysArray("timeline.stepTimingOff")} /> turns it on and off. Each key
      writes the playhead's time, so you can also pause, click the waveform where a word starts, and press the key.
    </p>
  </HelpTopic>
);

const AmllFiles: React.FC = () => (
  <HelpTopic title="AMLL Tool files">
    <ul className={LIST}>
      <li>
        Drop your <span className={INLINE_CODE}>.ttml</span> on the Import tab. Lyrics, timing, singers and background
        vocals come with it, and so do the title, artists and album.
      </li>
      <li>
        Composer opens {LYRICS_FORMATS_PROSE}. For a <span className={INLINE_CODE}>.lys</span>,{" "}
        <span className={INLINE_CODE}>.yrc</span> or <span className={INLINE_CODE}>.eslrc</span>, open it in AMLL Tool
        and save it as TTML first.
      </li>
      <li>When you're done, export TTML from the Export tab.</li>
    </ul>
  </HelpTopic>
);

// -- Exports -------------------------------------------------------------------

export { AmllFiles, AmllKeys, AmllWorkModel, LIST };
