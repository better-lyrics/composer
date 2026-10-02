import { type ParserConversion, convertViaParser } from "@/pages/converters/convert-via-parser";
import { type ConvertArgs, ConverterView } from "@/pages/converters/converter-view";
import { LRC_OUTPUT } from "@/pages/converters/output-formats";
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
    question: "Why convert TTML to LRC?",
    answer:
      "LRC is the lyric format most music players, car stereos and karaoke apps read. TTML is what Apple Music uses, but many local players only understand LRC. Converting gives you a file that works almost everywhere.",
  },
  {
    question: "Is word timing kept in the LRC output?",
    answer:
      "Yes. A word-synced TTML line becomes an Enhanced LRC line, with a timestamp in angle brackets in front of every word and one after the last word to mark where it ends. A line-synced TTML line becomes a plain LRC line.",
  },
  {
    question: "What happens to background vocals?",
    answer:
      "They follow the main lyrics on the same line, in parentheses, with their own word timestamps when the TTML has them. LRC has one text track per line, so this is the closest it can get.",
  },
  {
    question: "What happens to multiple singers?",
    answer:
      "LRC has no standard way to say who sings a line, so the singer split is not written. Use the TTML to QRC converter if you need the vocalists kept.",
  },
  {
    question: "Is my TTML file uploaded anywhere?",
    answer: "No. The entire conversion happens locally in your browser. Nothing is sent to a server.",
  },
];

const PATH = "/ttml-to-lrc";
const TITLE = "TTML to LRC Converter ・ Apple Music TTML to Enhanced LRC";
const DESCRIPTION =
  "Convert TTML lyrics to LRC in your browser. Word timing becomes Enhanced LRC, background vocals, title, artist and album are kept. Free, no signup, no upload.";

const HOW_TO_STEPS = [
  { name: "Paste your TTML", text: "Paste your TTML file content into the input box." },
  { name: "Review the LRC", text: "Composer produces LRC output on the right as you paste." },
  { name: "Download", text: "Download the LRC file, or open the lyrics in Composer to refine timing first." },
];

const TTML_TO_LRC_CONVERSION: ParserConversion = {
  extension: "ttml",
  granularity: "auto",
  emptyMessage: "No timed lines found. Make sure your TTML contains <p> elements with begin and end times.",
  failureMessage: "Could not parse TTML. Check that the input is a complete TTML document.",
  logLabel: "TTML to LRC",
};

// -- Components ---------------------------------------------------------------

// Split from the page so browser tests can render it: PageHead needs the head
// provider that only the SSG and client entries install.
const TtmlToLrcContent: React.FC = () => {
  const convert = useCallback((args: ConvertArgs) => convertViaParser(TTML_TO_LRC_CONVERSION, args), []);

  return (
    <>
      <ConverterView
        title="TTML to LRC Converter"
        inputLabel="Paste TTML"
        inputPlaceholder='<tt xmlns="http://www.w3.org/ns/ttml">&#10;  <body>&#10;    <div>&#10;      <p begin="00:00.500" end="00:03.000">'
        inputExtension={TTML_TO_LRC_CONVERSION.extension}
        sampleInput={SAMPLE_TTML}
        convert={convert}
        outputFormat={LRC_OUTPUT}
      />
      <section className="px-6 py-14 max-w-3xl mx-auto text-composer-text-secondary leading-relaxed space-y-5">
        <h2 className="text-2xl font-semibold text-composer-text">About TTML to LRC</h2>
        <p>
          LRC gives every line a start time in square brackets, such as
          <code className="font-mono text-composer-accent-text"> [00:12.50]</code>, and nothing else. A reader shows
          each line until the next one begins. Enhanced LRC adds a timestamp in angle brackets in front of every word,
          which is how word-by-word karaoke is stored.
        </p>
        <p>
          TTML gives every line and every word both a begin and an end time, so it holds more than LRC can. This
          converter keeps the start of every line and every word. Because LRC has no end times, it writes an empty
          timestamp after a line that is followed by a pause, so the line stops on time instead of running into the
          silence. The title, artist and album become
          <code className="font-mono text-composer-accent-text"> [ti:]</code>,
          <code className="font-mono text-composer-accent-text"> [ar:]</code> and
          <code className="font-mono text-composer-accent-text"> [al:]</code> tags.
        </p>
        <p>
          Need the reverse? Use the
          <a href="/lrc-to-ttml" className="text-composer-accent-text hover:text-composer-accent">
            LRC to TTML converter
          </a>
          , or read
          <a href="/guides/what-is-ttml" className="text-composer-accent-text hover:text-composer-accent">
            what TTML is
          </a>
          .
        </p>
      </section>
      <FaqSection title="TTML to LRC FAQ" entries={FAQS} />
      <BetterLyricsPromo />
    </>
  );
};

const TtmlToLrcPage: React.FC = () => {
  return (
    <LandingLayout>
      <PageHead
        title={TITLE}
        description={DESCRIPTION}
        path={PATH}
        jsonLd={[
          faqPageSchema(FAQS),
          howToSchema("Convert TTML to LRC online", DESCRIPTION, HOW_TO_STEPS),
          breadcrumbListSchema([
            { name: "Composer", path: "/" },
            { name: "TTML to LRC", path: PATH },
          ]),
          organizationSchema(),
        ]}
      />
      <TtmlToLrcContent />
    </LandingLayout>
  );
};

// -- Exports ------------------------------------------------------------------

export default TtmlToLrcPage;
export { TtmlToLrcContent };
