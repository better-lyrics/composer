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
        On the last word of a line, <InlineKeyBadge keys={getEffectiveKeysArray("timeline.stepWord")} /> only ends the
        word. The gap before the next line stays, so set the next start with{" "}
        <InlineKeyBadge keys={getEffectiveKeysArray("timeline.setWordBegin")} />.
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
        With no word selected, the first press starts at the first word of the line at that time, or the next line.
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
