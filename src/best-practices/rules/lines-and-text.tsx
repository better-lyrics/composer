import { LyricSample } from "@/best-practices/examples";
import type { RuleGroup } from "@/best-practices/model";

// -- Rules ---------------------------------------------------------------------

const LINES_AND_TEXT: RuleGroup = {
  id: "lines-and-text",
  label: "Lines and text",
  rules: [
    {
      id: "one-breath-per-line",
      title: "One breath per line",
      body: [
        "Break where the singer breathes.",
        "Two phrases in one line means Better Lyrics holds the whole thing on screen while half of it is being sung, and the highlight runs off ahead into words nobody has heard yet.",
      ],
      example: {
        wrong: <LyricSample lines={[{ main: "I've been waiting for you all night, where did you go, my love?" }]} />,
        right: (
          <LyricSample
            lines={[{ main: "I've been waiting for you all night" }, { main: "Where did you go, my love?" }]}
          />
        ),
      },
    },
    {
      id: "sentence-case",
      title: "Sentence case, no full stop",
      body: [
        "Capital at the start, no period at the end. Everything in between stays as it reads, apostrophes and question marks included.",
      ],
      aside:
        "Treat that as a default and not much more. Plenty of songs do something deliberate with their own capitalisation, and those are worth following instead.",
      example: {
        wrong: <LyricSample lines={[{ main: "i cant stop." }, { main: "WHERE DID YOU GO, MY LOVE." }]} />,
        right: <LyricSample lines={[{ main: "I can't stop" }, { main: "Where did you go, my love?" }]} />,
      },
    },
    {
      id: "empty-instrumental",
      title: "Leave the instrumental empty",
      body: [
        'Nothing goes in an instrumental break. Not a blank line, not "(instrumental)".',
        "Better Lyrics works the break out from the silence between one line's end and the next one's begin. Anything you park in there is one more thing it has to draw.",
      ],
      example: {
        wrong: (
          <LyricSample
            lines={[
              { main: "The last line of the verse" },
              { main: "(instrumental)" },
              { main: "First line of the chorus" },
            ]}
          />
        ),
        right: (
          <LyricSample
            lines={[
              { main: "The last line of the verse" },
              { rest: "18 seconds of nothing" },
              { main: "First line of the chorus" },
            ]}
          />
        ),
      },
    },
    {
      id: "only-sung-is-a-line",
      title: "Only what's sung is a line",
      body: [
        "Lines hold sung words and nothing else. Section tags like [Verse] or [Chorus], stage directions, and producer notes were never sung, so none of them go on screen.",
        'Same reason the instrumental stays empty. Better Lyrics draws whatever you hand it, so a line reading "[Chorus]" lights up mid-song as though someone sang the word.',
      ],
      example: {
        wrong: <LyricSample lines={[{ main: "[Chorus]" }, { main: "Where did you go, my love?" }]} />,
        right: <LyricSample lines={[{ main: "Where did you go, my love?" }]} />,
      },
    },
  ],
};

// -- Exports -------------------------------------------------------------------

export { LINES_AND_TEXT };
