import { TimingSample } from "@/best-practices/examples";
import type { RuleGroup } from "@/best-practices/model";

// -- Rules ---------------------------------------------------------------------

const TIMING: RuleGroup = {
  id: "timing",
  label: "Timing",
  rules: [
    {
      id: "keep-the-pauses",
      title: "Keep the pauses",
      body: [
        "Words butted flush against each other is right for a phrase sung in one breath, and wrong the second the singer stops for air.",
        "Flush timing everywhere is the quickest route to lyrics that drift against the vocal. Where there's a real pause, whether between two words or inside a word you've split, leave the pause in.",
      ],
      example: {
        wrong: (
          <TimingSample
            caption={'"stop" stretched to swallow the rest'}
            cells={[
              { kind: "word", label: "I" },
              { kind: "word", label: "can't" },
              { kind: "word", label: "stop", highlighted: true, wide: true },
              { kind: "word", label: "think" },
              { kind: "word", label: "ing" },
            ]}
          />
        ),
        right: (
          <TimingSample
            caption="The breath left where it actually is"
            cells={[
              { kind: "word", label: "I" },
              { kind: "word", label: "can't" },
              { kind: "word", label: "stop", highlighted: true },
              { kind: "gap", width: "lg" },
              { kind: "word", label: "think" },
              { kind: "word", label: "ing" },
            ]}
          />
        ),
      },
    },
    {
      id: "link-the-repeats",
      title: "Link the repeats",
      body: [
        "A chorus that comes back three times is one piece of work, not three.",
        "Group it once and paste the repeats as linked instances. Fix a typo in one and every copy follows, and the same goes for the voice on the line and the background text.",
        "Timing is the exception, and it's worth knowing before you assume otherwise. Each instance keeps its own begin, end and word timings. Retime the second chorus and the other two stay exactly where they were.",
      ],
    },
  ],
};

// -- Exports -------------------------------------------------------------------

export { TIMING };
