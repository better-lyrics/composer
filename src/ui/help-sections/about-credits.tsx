import { Fragment } from "react";
import { HelpTopic } from "@/ui/help-topic";
import { PROSE, PROSE_LINK } from "@/ui/typography";

// -- Interfaces ---------------------------------------------------------------

interface CreditedWork {
  name: string;
  href: string;
  by?: string;
}

interface Credit {
  use: string;
  works: CreditedWork[];
}

// -- Constants ----------------------------------------------------------------

const CREDITS: Credit[] = [
  {
    use: "Beat detection",
    works: [{ name: "Beat This!", href: "https://github.com/CPJKU/beat_this", by: "JKU Linz" }],
  },
  {
    use: "Vocal separation",
    works: [{ name: "HTDemucs", href: "https://github.com/facebookresearch/demucs", by: "Meta" }],
  },
  {
    use: "Pitch line",
    works: [{ name: "SwiftF0", href: "https://github.com/lars76/swift-f0", by: "Lars Nieradzik" }],
  },
  { use: "Auto-align", works: [{ name: "HubertFA", href: "https://github.com/wolfgitpr/HubertFA", by: "wolfgitpr" }] },
  {
    use: "Pronunciations",
    works: [
      { name: "CMU Pronouncing Dictionary", href: "https://github.com/cmusphinx/cmudict" },
      { name: "kuromoji.js", href: "https://github.com/sglkc/kuromoji.js" },
      { name: "pinyin-pro", href: "https://github.com/zh-lx/pinyin-pro" },
    ],
  },
  { use: "Lyrics search", works: [{ name: "LRCLIB", href: "https://lrclib.net" }] },
  { use: "Song details", works: [{ name: "MusicBrainz", href: "https://musicbrainz.org" }] },
  {
    use: "Preview",
    works: [{ name: "am-lyrics", href: "https://github.com/binimum/am-lyrics", by: "binimum" }],
  },
  { use: "Waveform", works: [{ name: "wavesurfer.js", href: "https://wavesurfer.xyz", by: "katspaugh" }] },
  { use: "Model runtime", works: [{ name: "ONNX Runtime", href: "https://onnxruntime.ai", by: "Microsoft" }] },
  { use: "Icons", works: [{ name: "Tabler Icons", href: "https://tabler.io/icons" }] },
];

// -- Components ---------------------------------------------------------------

const CreditedWorkLink: React.FC<{ work: CreditedWork }> = ({ work }) => (
  <>
    <a href={work.href} target="_blank" rel="noopener noreferrer" className={PROSE_LINK}>
      {work.name}
    </a>
    {work.by && ` by ${work.by}`}
  </>
);

const AboutCredits: React.FC = () => (
  <HelpTopic title="Credits">
    <dl className={`${PROSE} grid grid-cols-[max-content_1fr] gap-x-5 gap-y-1`}>
      {CREDITS.map((credit) => (
        <Fragment key={credit.use}>
          <dt className="text-(--muted)">{credit.use}</dt>
          <dd>
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
