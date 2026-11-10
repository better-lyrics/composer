import { Fragment } from "react";
import { HelpTopic } from "@/ui/help-topic";
import { PROSE, PROSE_LINK } from "@/ui/typography";

// -- Interfaces ---------------------------------------------------------------

interface CreditedPerson {
  name: string;
  href: string;
}

interface CreditedWork {
  name: string;
  href: string;
  by?: CreditedPerson[];
}

interface Credit {
  use: string;
  inspiration?: boolean;
  works: CreditedWork[];
}

// -- Constants ----------------------------------------------------------------

const CREDITS: Credit[] = [
  {
    use: "Beat detection",
    works: [
      {
        name: "Beat This!",
        href: "https://github.com/CPJKU/beat_this",
        by: [{ name: "JKU Linz", href: "https://github.com/CPJKU" }],
      },
    ],
  },
  {
    use: "Vocal separation",
    works: [
      {
        name: "HTDemucs",
        href: "https://github.com/facebookresearch/demucs",
        by: [{ name: "Meta", href: "https://github.com/facebookresearch" }],
      },
    ],
  },
  {
    use: "Pitch line",
    works: [
      {
        name: "SwiftF0",
        href: "https://github.com/lars76/swift-f0",
        by: [{ name: "Lars Nieradzik", href: "https://github.com/lars76" }],
      },
    ],
  },
  {
    use: "Auto-align",
    works: [
      {
        name: "HubertFA",
        href: "https://github.com/wolfgitpr/HubertFA",
        by: [{ name: "wolfgitpr", href: "https://github.com/wolfgitpr" }],
      },
    ],
  },
  {
    use: "Pronunciations",
    works: [
      { name: "CMU Pronouncing Dictionary", href: "https://github.com/cmusphinx/cmudict" },
      { name: "kuromoji.js", href: "https://github.com/sglkc/kuromoji.js" },
      { name: "pinyin-pro", href: "https://github.com/zh-lx/pinyin-pro" },
    ],
  },
  {
    use: "Step timing",
    inspiration: true,
    works: [
      {
        name: "Spicy Lyrics TTML Tool",
        href: "https://github.com/spicylyrics/ttml-tool",
        by: [
          { name: "TX24", href: "https://github.com/TheX24" },
          { name: "NaeNaeTart", href: "https://github.com/NaeNaeTart" },
        ],
      },
    ],
  },
  {
    use: "Lyrics search",
    works: [
      { name: "LRCLIB", href: "https://lrclib.net" },
      {
        name: "BiniLyrics",
        href: "https://lyrics.binimum.org",
        by: [{ name: "binimum", href: "https://github.com/binimum" }],
      },
    ],
  },
  { use: "Song details", works: [{ name: "MusicBrainz", href: "https://musicbrainz.org" }] },
  {
    use: "Preview",
    works: [
      {
        name: "am-lyrics",
        href: "https://github.com/binimum/am-lyrics",
        by: [{ name: "binimum", href: "https://github.com/binimum" }],
      },
    ],
  },
  {
    use: "Waveform",
    works: [
      {
        name: "wavesurfer.js",
        href: "https://wavesurfer.xyz",
        by: [{ name: "katspaugh", href: "https://github.com/katspaugh" }],
      },
    ],
  },
  {
    use: "Scrub audio",
    works: [
      {
        name: "Signalsmith Stretch",
        href: "https://signalsmith-audio.co.uk/code/stretch/",
        by: [{ name: "Signalsmith Audio", href: "https://github.com/Signalsmith-Audio" }],
      },
    ],
  },
  {
    use: "Model runtime",
    works: [
      {
        name: "ONNX Runtime",
        href: "https://onnxruntime.ai",
        by: [{ name: "Microsoft", href: "https://github.com/microsoft" }],
      },
    ],
  },
  { use: "Icons", works: [{ name: "Tabler Icons", href: "https://tabler.io/icons" }] },
];

// -- Components ---------------------------------------------------------------

const CreditedWorkLink: React.FC<{ work: CreditedWork }> = ({ work }) => (
  <>
    <a href={work.href} target="_blank" rel="noopener noreferrer" className={PROSE_LINK}>
      {work.name}
    </a>
    {work.by && " by "}
    {work.by?.map((person, index) => (
      <Fragment key={person.href}>
        {index > 0 && " and "}
        <a href={person.href} target="_blank" rel="noopener noreferrer" className={PROSE_LINK}>
          {person.name}
        </a>
      </Fragment>
    ))}
  </>
);

const AboutCredits: React.FC = () => (
  <HelpTopic title="Credits">
    <dl className={`${PROSE} grid grid-cols-[max-content_1fr] gap-x-5 gap-y-1`}>
      {CREDITS.map((credit) => (
        <Fragment key={credit.use}>
          <dt className="text-(--muted)">{credit.use}</dt>
          <dd>
            {credit.inspiration && "Inspired by "}
            {credit.works.map((work, index) => (
              <Fragment key={work.name}>
                {index > 0 && ", "}
                <CreditedWorkLink work={work} />
              </Fragment>
            ))}
          </dd>
        </Fragment>
      ))}
    </dl>
    <p className={`${PROSE} mt-2.5`}>Thanks to everyone behind these.</p>
  </HelpTopic>
);

// -- Exports ------------------------------------------------------------------

export { AboutCredits };
