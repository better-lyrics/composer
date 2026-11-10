import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { HelpTopic } from "@/ui/help-topic";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { PROSE } from "@/ui/typography";
import { MOD_KEY } from "@/utils/platform";

// -- Components ----------------------------------------------------------------

const StepTimingHelp: React.FC = () => (
  <HelpTopic title="Step timing">
    <p className={PROSE}>
      Step timing fixes words one at a time against the waveform or the spectrum. Press{" "}
      <InlineKeyBadge keys={getEffectiveKeysArray("timeline.stepWord")} /> to turn it on. The other words lose their
      colour, and the timing keys follow the selected word instead of the playhead.
    </p>
    <ul className={`${PROSE} mt-2 list-disc pl-[18px] marker:text-(--muted) space-y-1`}>
      <li>
        <InlineKeyBadge keys={getEffectiveKeysArray("timeline.setWordBegin")} /> sets the start of the selected word.
      </li>
      <li>
        <InlineKeyBadge keys={getEffectiveKeysArray("timeline.stepWord")} /> ends the selected word, starts the next
        word at the same time and selects the next word.
      </li>
      <li>
        <InlineKeyBadge keys={getEffectiveKeysArray("timeline.setWordEnd")} /> ends the selected word and selects the
        next word.
      </li>
      <li>
        On the last word of a line, <InlineKeyBadge keys={getEffectiveKeysArray("timeline.stepWord")} /> also starts the
        first word of the next line. To leave a gap before the next line, press{" "}
        <InlineKeyBadge keys={getEffectiveKeysArray("timeline.setWordEnd")} /> instead.
      </li>
      <li>
        The keys skip background words. To time them, or any other set of words, select them first: click an empty part
        of a lane to select the whole lane (click again to clear it), or drag a box around words, or {MOD_KEY}-click
        them. The keys then run through only those words, and stop after the last one.
      </li>
      <li>
        The keys write the playhead's time. Click the ruler or the waveform, or drag the playhead, to put it where a
        word starts or ends. This works while you drag too. Drawing a loop on the waveform keeps your selected word, so
        you can loop a hard part while you time it.
      </li>
      <li>
        Later words that are in the way move later, only as far as they must. Earlier words never move. If the time is
        before the previous word ends, nothing changes and a message names that word.
      </li>
      <li>
        With no word selected, <InlineKeyBadge keys={getEffectiveKeysArray("timeline.setWordBegin")} /> picks the word
        under the time or the next one to start, and{" "}
        <InlineKeyBadge keys={getEffectiveKeysArray("timeline.stepWord")} /> or{" "}
        <InlineKeyBadge keys={getEffectiveKeysArray("timeline.setWordEnd")} /> pick the word under the time or the last
        one to end.
      </li>
    </ul>
    <p className={`${PROSE} mt-3`}>
      Press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.stepTimingOff")} /> to turn it off. Escape first
      clears the selection, then turns it off. Each key press is one undo step.
    </p>
  </HelpTopic>
);

// -- Exports -------------------------------------------------------------------

export { StepTimingHelp };
