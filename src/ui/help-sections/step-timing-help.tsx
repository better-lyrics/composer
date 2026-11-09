import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { HelpTopic } from "@/ui/help-topic";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { PROSE } from "@/ui/typography";

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
        Background words are timed on their own. Click one, and{" "}
        <InlineKeyBadge keys={getEffectiveKeysArray("timeline.stepWord")} /> steps through them. On the last one it only
        ends the word, then moves to the next line without changing its start.
      </li>
      <li>
        With the pointer over the waveform or the spectrum, the keys write the time under the pointer, and a line shows
        that time. Anywhere else they write the playhead time.
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
      Press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.stepTimingOff")} /> or Escape to turn it off. Each key
      press is one undo step.
    </p>
  </HelpTopic>
);

// -- Exports -------------------------------------------------------------------

export { StepTimingHelp };
