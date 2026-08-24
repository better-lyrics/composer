import { LyricSample } from "@/best-practices/examples";
import type { RuleGroup } from "@/best-practices/model";

// -- Rules ---------------------------------------------------------------------

const VOICES: RuleGroup = {
  id: "voices",
  label: "Voices",
  rules: [
    {
      id: "line-belongs-to-main",
      title: "The line belongs to whoever sang the main part",
      body: [
        "Someone else singing backgrounds over A's line doesn't make it their line. It stays A's, however recognisable the voice underneath.",
      ],
      example: {
        wrong: (
          <LyricSample lines={[{ agent: "Artist B", main: "I've been waiting", background: "(waiting on you)" }]} />
        ),
        right: (
          <LyricSample lines={[{ agent: "Artist A", main: "I've been waiting", background: "(waiting on you)" }]} />
        ),
      },
    },
    {
      id: "credited-feature",
      title: "A credited feature gets a line of their own",
      body: [
        "This is the exception to the one above.",
        "A credited artist ad-libbing their own words isn't backing anyone up. They're taking a turn, and the file needs some way of saying so. Pull those ad-libs out of the background and give them a line carrying their own voice.",
        "Brackets come off, same reasoning as before. Both halves have to hold, though. Credited, and words that aren't just the lead's coming back at them. Uncredited session backing stays where it is.",
      ],
      example: {
        wrong: (
          <LyricSample
            lines={[
              { agent: "Artist A", main: "I've been waiting", background: "(yeah, uh-huh)" },
              { agent: "Artist A", main: "For you all night" },
            ]}
          />
        ),
        right: (
          <LyricSample
            lines={[
              { agent: "Artist A", main: "I've been waiting" },
              { agent: "Feat. Artist B", main: "Yeah, uh-huh" },
              { agent: "Artist A", main: "For you all night" },
            ]}
          />
        ),
      },
    },
    {
      id: "two-voices-is-chorus",
      title: "Two voices on one line is always a chorus",
      body: [
        "Both artists singing the same words at the same time is a chorus line. Every time.",
        'No exceptions, and no "but you can mostly hear A".',
      ],
      example: {
        wrong: (
          <LyricSample
            lines={[
              {
                agent: "Artist A",
                main: "We were never gonna make it",
                background: "(we were never gonna make it)",
              },
            ]}
          />
        ),
        right: <LyricSample lines={[{ agent: "Chorus", main: "We were never gonna make it" }]} />,
      },
    },
    {
      id: "hand-off",
      title: "Split a hand-off only on a clean break",
      body: [
        "One artist takes the first half of a line, the other takes the second.",
        "Lands on a phrase boundary? Two lines, a voice each. Lands mid-phrase? Leave the line whole and give it to the chorus. A phrase cut down the middle reads worse than a voice being slightly off.",
      ],
      example: {
        wrong: (
          <LyricSample
            lines={[
              { agent: "Artist A", main: "I've been waiting for" },
              { agent: "Artist B", main: "you all night" },
            ]}
          />
        ),
        right: (
          <LyricSample
            lines={[
              { agent: "Artist A", main: "I've been waiting" },
              { agent: "Artist B", main: "For you all night" },
              {
                agent: "Chorus, when the hand-off lands mid-phrase",
                main: "I've been waiting for you all night",
                spaced: true,
              },
            ]}
          />
        ),
      },
    },
  ],
};

// -- Exports -------------------------------------------------------------------

export { VOICES };
