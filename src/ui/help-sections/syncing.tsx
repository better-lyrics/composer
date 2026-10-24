import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { HelpTopic } from "@/ui/help-topic";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { SettingLink } from "@/ui/setting-link";
import { PROSE } from "@/ui/typography";

// -- Syncing ------------------------------------------------------------------

const SyncSection: React.FC = () => (
  <div className="space-y-[22px] max-w-[68ch]">
    <p className={PROSE}>
      The Sync tab shows your lyrics as a scrolling carousel. One line is active at a time, with each word waiting to be
      synced. You sync with two keys, and you can combine them freely.
    </p>

    <HelpTopic title="Tap (Space)">
      <p className={PROSE}>
        Press <InlineKeyBadge keys={getEffectiveKeysArray("sync.tap")} /> to start playback and begin syncing. As the
        music plays, tap <InlineKeyBadge keys={getEffectiveKeysArray("sync.tap")} /> on each word right when the singer
        says it. Each tap marks the word's start and ends the previous word at the same moment, so there is no gap
        between them.
      </p>
    </HelpTopic>

    <HelpTopic title="Counting in">
      <p className={PROSE}>
        When you start syncing from the very beginning of the song, Sync counts down before playback starts so you are
        ready for the first word. Taps wait until the count ends. Change the length in{" "}
        <SettingLink setting="syncCountIn" />. Set it to 0 to turn it off. Press Escape to skip the count and play at
        once.
      </p>
    </HelpTopic>

    <HelpTopic title="Hold (F)">
      <p className={PROSE}>
        Press and hold <InlineKeyBadge keys={getEffectiveKeysArray("sync.holdSync")} /> for the duration of each word.
        The key-down marks the word's start, and key-up marks the end. That way you decide how long each word lasts, and
        you can leave gaps between words. The current word highlights while you hold.
      </p>
      <p className={`${PROSE} mt-2`}>For words with gaps between them, hold and release once per word:</p>
      <ul className={`${PROSE} list-disc pl-[18px] marker:text-(--muted) mt-1.5 space-y-1`}>
        <li>Hold F: "hello" starts</li>
        <li>Release F: "hello" ends</li>
        <li>(wait for gap)</li>
        <li>Hold F: "world" starts</li>
        <li>Release F: "world" ends</li>
      </ul>
    </HelpTopic>

    <HelpTopic title="Gapless syllables (Hold F + Tap Space)">
      <p className={PROSE}>
        For syllables that flow together without pauses, tap <InlineKeyBadge keys={getEffectiveKeysArray("sync.tap")} />{" "}
        while holding <InlineKeyBadge keys={getEffectiveKeysArray("sync.holdSync")} /> to create gapless boundaries.
        Each tap ends the current syllable and immediately starts the next. Release{" "}
        <InlineKeyBadge keys={getEffectiveKeysArray("sync.holdSync")} /> to end the last one:
      </p>
      <ul className={`${PROSE} list-disc pl-[18px] marker:text-(--muted) mt-1.5 space-y-1`}>
        <li>Hold F: "beau" starts</li>
        <li>Tap Space (still holding F): "beau" ends, "ti" starts at the same moment</li>
        <li>Tap Space (still holding F): "ti" ends, "ful" starts at the same moment</li>
        <li>Release F: "ful" ends</li>
      </ul>
      <p className={`${PROSE} mt-2`}>
        You can mix all three in the same line. Use hold-release for standalone words, tap for quick gapless words, and
        hold+tap for connected syllables:
      </p>
      <ul className={`${PROSE} list-disc pl-[18px] marker:text-(--muted) mt-1.5 space-y-1`}>
        <li>Hold F, release F: "oh" gets its own timing</li>
        <li>(gap)</li>
        <li>Hold F: "beau" starts</li>
        <li>Tap Space, tap Space: gapless boundaries for "ti" and "ful"</li>
        <li>Release F: "ful" ends</li>
      </ul>
    </HelpTopic>

    <HelpTopic title="Made a mistake?">
      <p className={PROSE}>
        Press <InlineKeyBadge keys={getEffectiveKeysArray("sync.nudgeLeft")} /> or{" "}
        <InlineKeyBadge keys={getEffectiveKeysArray("sync.nudgeRight")} /> to move the last synced word earlier or later
        by the <SettingLink setting="nudgeAmount" />. You can also press{" "}
        <InlineKeyBadge keys={getEffectiveKeysArray("global.undo")} /> to undo. Each hold makes two undo steps (start
        and end), so you can step back one edge at a time.
      </p>
    </HelpTopic>

    <HelpTopic title="Line-level vs word-level">
      <p className={PROSE}>
        By default, you're syncing word by word. The granularity toggle at the top lets you switch to line-level if you
        only need rough timing.
      </p>
    </HelpTopic>

    <HelpTopic title="Re-syncing a line">
      <p className={PROSE}>If a whole line went wrong, go back to it and sync again. New taps overwrite old timing.</p>
    </HelpTopic>

    <HelpTopic title="Splitting syllables">
      <p className={PROSE}>
        Each word on the active line has a small scissors button. Click it to split that word into syllables right here,
        without switching to the Timeline. A popover opens where you click between letters to mark the split points,
        then confirm. The Timeline splitter offers the same syllable split plus a word-mode split.
      </p>
    </HelpTopic>

    <p className={PROSE}>
      After syncing, your words have timing data. Sync works line by line or word by word. For precise changes to single
      words, use the Timeline, where you drag, resize and snap each word block. Head there for fine-tuning, or go
      straight to Preview to see how it looks.
    </p>
  </div>
);

// -- Exports ------------------------------------------------------------------

export { SyncSection };
