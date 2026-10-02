import { type ParserConversion, convertViaParser } from "@/pages/converters/convert-via-parser";
import { type ConvertArgs, ConverterView } from "@/pages/converters/converter-view";
import { SRT_OUTPUT } from "@/pages/converters/output-formats";
import { SAMPLE_TTML } from "@/pages/converters/sample-ttml";
import { LandingLayout } from "@/pages/landing/landing-layout";
import { BetterLyricsPromo } from "@/pages/landing/sections/better-lyrics-promo";
import { FaqSection } from "@/pages/landing/sections/faq-section";
import { PageHead } from "@/seo/page-head";
import { breadcrumbListSchema, faqPageSchema, howToSchema, organizationSchema } from "@/seo/schemas";
import { useCallback } from "react";

// -- Constants ----------------------------------------------------------------

const FAQS = [
  {
    question: "Why convert TTML lyrics to SRT?",
    answer:
      "SRT is the subtitle format nearly every video editor and video player reads. Converting lyrics to SRT lets you burn them into a lyric video or load them as captions next to the song.",
  },
  {
    question: "Is word timing kept in the SRT output?",
    answer:
      "No. SRT only has cue-level timing, so each TTML line becomes one cue that runs from its first word to its last word. The words themselves are all kept.",
  },
  {
    question: "What happens to background vocals?",
    answer: "They follow the main lyrics in the same cue, in parentheses, and the cue is long enough to cover them.",
  },
  {
    question: "Does the SRT keep the song title or singers?",
    answer:
      "No. SRT has no place for song details or singer names. Only the cue numbers, the timing and the text are written.",
  },
  {
    question: "Is my TTML file uploaded anywhere?",
    answer: "No. The entire conversion happens locally in your browser. Nothing is sent to a server.",
  },
];

const PATH = "/ttml-to-srt";
const TITLE = "TTML to SRT Converter ・ Lyrics to Subtitles, Free";
const DESCRIPTION =
  "Convert TTML lyrics to SRT subtitles in your browser. Every lyric line becomes a timed cue, ready for video editors and players. Free, no signup, no upload.";

const HOW_TO_STEPS = [
  { name: "Paste your TTML", text: "Paste your TTML file content into the input box." },
  { name: "Review the SRT", text: "Composer produces SRT output on the right as you paste." },
  { name: "Download", text: "Download the SRT file, or open the lyrics in Composer to refine timing first." },
];

const TTML_TO_SRT_CONVERSION: ParserConversion = {
  extension: "ttml",
  granularity: "auto",
  emptyMessage: "No timed lines found. Make sure your TTML contains <p> elements with begin and end times.",
  failureMessage: "Could not parse TTML. Check that the input is a complete TTML document.",
  logLabel: "TTML to SRT",
  output: SRT_OUTPUT,
};

// -- Components ---------------------------------------------------------------

// Split from the page so browser tests can render it: PageHead needs the head
// provider that only the SSG and client entries install.
const TtmlToSrtContent: React.FC = () => {
  const convert = useCallback((args: ConvertArgs) => convertViaParser(TTML_TO_SRT_CONVERSION, args), []);

  return (
    <>
      <ConverterView
        title="TTML to SRT Converter"
        inputLabel="Paste TTML"
        inputPlaceholder='<tt xmlns="http://www.w3.org/ns/ttml">&#10;  <body>&#10;    <div>&#10;      <p begin="00:00.500" end="00:03.000">'
        sampleInput={SAMPLE_TTML}
        convert={convert}
        outputFormat={SRT_OUTPUT}
      />
      <section className="px-6 py-14 max-w-3xl mx-auto text-composer-text-secondary leading-relaxed space-y-5">
        <h2 className="text-2xl font-semibold text-composer-text">About TTML to SRT</h2>
        <p>
          SRT (SubRip) is the subtitle format most video tools read. Each cue has a number, a start and end time such as
          <code className="font-mono text-composer-accent-text"> 00:00:12,500 --&gt; 00:00:15,000</code>, and its text.
        </p>
        <p>
          This converter writes one cue for each TTML
          <code className="font-mono text-composer-accent-text"> &lt;p&gt; </code>element. The cue starts at the
          line&apos;s first word and ends at its last, so word-synced and line-synced TTML both convert. Times are kept
          to the millisecond. SRT has no word timing, no singers and no song details, so only the text and its timing
          carry over.
        </p>
        <p>
          Need the reverse? Use the
          <a href="/srt-to-ttml" className="text-composer-accent-text hover:text-composer-accent">
            SRT to TTML converter
          </a>
          .
        </p>
      </section>
      <FaqSection title="TTML to SRT FAQ" entries={FAQS} />
      <BetterLyricsPromo />
    </>
  );
};

const TtmlToSrtPage: React.FC = () => {
  return (
    <LandingLayout>
      <PageHead
        title={TITLE}
        description={DESCRIPTION}
        path={PATH}
        jsonLd={[
          faqPageSchema(FAQS),
          howToSchema("Convert TTML to SRT online", DESCRIPTION, HOW_TO_STEPS),
          breadcrumbListSchema([
            { name: "Composer", path: "/" },
            { name: "TTML to SRT", path: PATH },
          ]),
          organizationSchema(),
        ]}
      />
      <TtmlToSrtContent />
    </LandingLayout>
  );
};

// -- Exports ------------------------------------------------------------------

export default TtmlToSrtPage;
export { TtmlToSrtContent };
