import { SyllableSample } from "@/best-practices/examples";
import type { RuleGroup } from "@/best-practices/model";

// -- Rules ---------------------------------------------------------------------

const SYLLABLES: RuleGroup = {
  id: "syllables",
  label: "Syllables",
  rules: [
    {
      id: "split-on-stretch",
      title: "Split when the singer stretches, not when the dictionary says so",
      body: [
        "Whole words by default.",
        'Split one into syllables when the artist is leaning on a single syllable and holding it far longer than the rest. That\'s the only case where the extra timing shows up on screen. Cutting "beautiful" into three parts because a dictionary says it has three is work nobody will ever see.',
      ],
      aside:
        "Spell the word normally however long it's held. Never stretch the spelling to show it, the renderer does that from the timing.",
      example: {
        wrong: (
          <div className="flex flex-col gap-3">
            <SyllableSample parts={["for", "eeeeever"]} caption="Spelling the stretch out" />
            <SyllableSample parts={["beau", "ti", "ful"]} caption="Splitting by dictionary" />
          </div>
        ),
        right: (
          <div className="flex flex-col gap-3">
            <SyllableSample parts={["for", "ever"]} caption={'"forever", last syllable held'} />
            <SyllableSample parts={["beautiful"]} caption={'"beautiful", sung straight'} />
          </div>
        ),
      },
    },
    {
      id: "cut-on-boundary",
      title: "Cut on the syllable boundary, not on the stretch",
      body: [
        "Once you've decided to split, put the cut where the word divides and let the stretched vowel sit inside whichever part owns it.",
        "Someone holding the end of \"hello\" out is why you're splitting the word at all. It still cuts hel|lo, not hell|o. The stretch picks the word. It doesn't get a say in where the cut lands.",
      ],
      example: {
        wrong: <SyllableSample parts={["hell", "o"]} caption="Cut where the held vowel starts" />,
        right: <SyllableSample parts={["hel", "lo"]} caption="Cut on the syllable boundary" />,
      },
    },
  ],
};

// -- Exports -------------------------------------------------------------------

export { SYLLABLES };
