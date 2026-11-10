import { getEffectiveKeysArray, useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { type Habit, HabitTable, PresetIntro } from "@/ui/help-sections/habit-table";
import { AmllFiles, AmllKeys, AmllWorkModel, LIST } from "@/ui/help-sections/moving-over-amll";
import { HelpTopic } from "@/ui/help-topic";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { PROSE } from "@/ui/typography";
import { UndoKeys } from "@/ui/undo-hint";
import { cn } from "@/utils/cn";

// -- Constants -----------------------------------------------------------------

const OSU_HABITS: readonly Habit[] = [
  { action: "Tap", shortcutIds: ["sync.tap"] },
  { action: "Hold", shortcutIds: ["sync.holdSync"] },
];

// -- Components ----------------------------------------------------------------

const Keys: React.FC<{ id: string }> = ({ id }) => <InlineKeyBadge keys={getEffectiveKeysArray(id)} />;

const OsuTopic: React.FC = () => (
  <HelpTopic title="osu!">
    <PresetIntro preset="osu">
      In osu! the notes are already on the map and you hit them. In Sync, your taps decide where each word starts.
    </PresetIntro>
    <HabitTable preset="osu" habits={OSU_HABITS} />
    <ul className={cn(LIST, "mt-3")}>
      <li>A tap starts the next word and ends the one before at the same moment, so tapped words touch.</li>
      <li>
        To leave a gap after a word, hold <Keys id="sync.holdSync" /> while it's sung and let go when it ends.
      </li>
      <li>
        Taps aren't judged. Each one sets the time you pressed, early or late. To fix the last word, use{" "}
        <Keys id="sync.nudgeLeft" /> <Keys id="sync.nudgeRight" /> or <UndoKeys />.
      </li>
      <li>From the top of the song, Sync counts you in.</li>
      <li>
        <Keys id="global.seekBackwardFine" /> <Keys id="global.seekForwardFine" /> seek in small steps.{" "}
        <Keys id="global.seekBackward" /> <Keys id="global.seekForward" /> jump further.
      </li>
      <li>Words you missed are easy to fix on the Timeline, where you can drag each one.</li>
    </ul>
  </HelpTopic>
);

const MovingOverSection: React.FC = () => {
  useShortcutBindingsStore((state) => state.preset);
  useShortcutBindingsStore((state) => state.overrides);

  return (
    <div className="space-y-[22px] max-w-[68ch]">
      <p className={PROSE}>
        Coming from another tool? Your keys carry over with a preset. The way the work is split up changes more, so read
        that first.
      </p>
      <AmllWorkModel />
      <AmllKeys />
      <AmllFiles />
      <OsuTopic />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { MovingOverSection };
