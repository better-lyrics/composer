import { LyricSample, TimingSample } from "@/best-practices/examples";
import type { RuleGroup } from "@/best-practices/model";

// -- Rules ---------------------------------------------------------------------

const BACKGROUND_VOCALS: RuleGroup = {
  id: "background-vocals",
  label: "Background vocals",
  rules: [
    {
      id: "brackets",
      title: "Backgrounds carry brackets",
      body: [
        "Not required. The file validates fine without them, and you should use them anyway.",
        "Brackets are what mark background text as background to somebody reading the lyrics rather than listening to them. Take them away and a backing part is indistinguishable from a short lead line.",
      ],
      example: {
        wrong: <LyricSample lines={[{ main: "I can't stop", background: "ooh yeah" }]} />,
        right: <LyricSample lines={[{ main: "I can't stop", background: "(ooh yeah)" }]} />,
      },
    },
    {
      id: "one-bracket-pair",
      title: "One pair of brackets for the whole run",
      body: [
        "Two background snippets in the same line share one outer pair. Bracket each of them separately and you get a background line that's more punctuation than words.",
      ],
      aside: "Settings → Preserve brackets when extracting does this for you, and it's on by default.",
      example: {
        wrong: <LyricSample lines={[{ main: "Running through the night", background: "(ooh yeah) (ooh yeah)" }]} />,
        right: <LyricSample lines={[{ main: "Running through the night", background: "(ooh yeah, ooh yeah)" }]} />,
      },
    },
    {
      id: "ad-libs-are-backgrounds",
      title: "Ad-libs are background vocals",
      body: [
        'Every "yeah" and "come on" thrown over the top of a line is a background.',
        'Promote them to main lines and they push the actual lyric down the screen. Nobody is reading along to "uh".',
      ],
      aside: "One exception, over in Voices: a credited artist ad-libbing words of their own.",
      example: {
        wrong: <LyricSample lines={[{ main: "Take it higher" }, { main: "Uh, come on" }]} />,
        right: <LyricSample lines={[{ main: "Take it higher", background: "(uh, come on)" }]} />,
      },
    },
    {
      id: "ad-lib-in-a-gap",
      title: "An ad-lib in a gap goes wherever it won't stretch a line",
      body: [
        "TTML has no background-only line, so an ad-lib stranded between two verses has to go somewhere.",
        "Attaching it to the nearest line folds it into that line's paragraph, which keeps the line on screen until the ad-lib has finished. Landing close by, that's invisible. Landing five seconds out, the verse line is just sitting there waiting for it.",
        "Close, attach it. Far, give it a line of its own and drop the brackets, since for that moment it is the lead.",
      ],
      example: {
        wrong: (
          <div className="flex flex-col gap-2.5">
            <LyricSample lines={[{ main: "Last line of the verse", background: "(yeah!)" }]} />
            <TimingSample
              caption="Far out, still one paragraph"
              cells={[
                {
                  kind: "group",
                  cells: [
                    { kind: "word", label: "verse line", wide: true },
                    { kind: "gap", width: "lg" },
                    { kind: "word", label: "yeah!", highlighted: true },
                  ],
                },
              ]}
            />
            <p className="text-[11px] text-composer-text-muted">
              The verse line hangs on screen through the whole gap.
            </p>
          </div>
        ),
        right: (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2.5">
              <LyricSample lines={[{ main: "Last line of the verse", background: "(yeah!)" }]} />
              <TimingSample
                caption="Close by, one paragraph"
                cells={[
                  {
                    kind: "group",
                    cells: [
                      { kind: "word", label: "verse line", wide: true },
                      { kind: "gap", width: "sm" },
                      { kind: "word", label: "yeah!", highlighted: true },
                    ],
                  },
                ]}
              />
            </div>
            <div className="flex flex-col gap-2.5">
              <LyricSample lines={[{ main: "Last line of the verse" }, { main: "Yeah!" }]} />
              <TimingSample
                caption="Far out, two paragraphs"
                cells={[
                  { kind: "group", cells: [{ kind: "word", label: "verse line", wide: true }] },
                  { kind: "gap", width: "lg" },
                  { kind: "group", cells: [{ kind: "word", label: "yeah!", highlighted: true }] },
                ]}
              />
            </div>
          </div>
        ),
      },
    },
    {
      id: "doubling",
      title: "Transcribe doubling only when you can hear it clearly",
      body: [
        "A backing take that shadows the lead word for word is worth writing down when you can plainly hear it, and worth skipping when it's buried.",
        "Repeating the lead in the background is completely normal. It just has to be loud enough to earn a second line on screen.",
        "If you're confused, put it in, as long as you can hear where the words start and stop.",
      ],
    },
    {
      id: "producer-tags",
      title: "Producer tags and stray shouts, only if they're words",
      body: [
        'An intelligible "yeah!" or a producer tag can go in as a background. A laugh doesn\'t, and neither does anything you had to rewind four times to make out.',
      ],
    },
  ],
};

// -- Exports -------------------------------------------------------------------

export { BACKGROUND_VOCALS };
