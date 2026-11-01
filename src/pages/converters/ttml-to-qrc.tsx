import { type ParserConversion, convertViaParser } from "@/pages/converters/convert-via-parser";
import { type ConvertArgs, ConverterView } from "@/pages/converters/converter-view";
import { QRC_OUTPUT } from "@/pages/converters/output-formats";
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
    question: "What is a QRC file?",
    answer:
      "QRC is the karaoke lyric format QQ Music uses. Every line and every word has a begin time and a duration in milliseconds, and the word tag comes after the word it belongs to.",
  },
  {
    question: "Is word timing kept in the QRC output?",
    answer:
      "Yes, to the millisecond. A word-synced TTML line becomes a QRC line with a tag behind every word. A line-synced TTML line becomes a QRC line with only its line header.",
  },
  {
    question: "Do multiple singers survive the conversion?",
    answer:
      "Yes. When the TTML has more than one agent, Composer writes a QQ-style singer marker, the singer name followed by a colon, at every change of voice.",
  },
  {
    question: "What happens to background vocals?",
    answer: "They follow the main words on the same line, in parentheses, and keep their own word timing.",
  },
  {
    question: "Is my TTML file uploaded anywhere?",
    answer: "No. The entire conversion happens locally in your browser. Nothing is sent to a server.",
  },
];

const PATH = "/ttml-to-qrc";
const TITLE = "TTML to QRC Converter ・ Apple Music TTML to QQ Music QRC";
const DESCRIPTION =
  "Convert TTML lyrics to QQ Music QRC in your browser. Word timing, background vocals and singer changes are all kept. Free, no signup, no upload.";

const HOW_TO_STEPS = [
  { name: "Paste your TTML", text: "Paste your TTML file content into the input box." },
  { name: "Review the QRC", text: "Composer produces QRC output on the right as you paste." },
  { name: "Download", text: "Download the QRC file, or open the lyrics in Composer to refine timing first." },
];

const TTML_TO_QRC_CONVERSION: ParserConversion = {
  extension: "ttml",
  granularity: "auto",
  emptyMessage: "No timed lines found. Make sure your TTML contains <p> elements with begin and end times.",
  failureMessage: "Could not parse TTML. Check that the input is a complete TTML document.",
  logLabel: "TTML to QRC",
};

// -- Components ---------------------------------------------------------------

// Split from the page so browser tests can render it: PageHead needs the head
// provider that only the SSG and client entries install.
const TtmlToQrcContent: React.FC = () => {
  const convert = useCallback((args: ConvertArgs) => convertViaParser(TTML_TO_QRC_CONVERSION, args), []);

  return (
    <>
      <ConverterView
        title="TTML to QRC Converter"
        inputLabel="Paste TTML"
        inputPlaceholder='<tt xmlns="http://www.w3.org/ns/ttml">&#10;  <body>&#10;    <div>&#10;      <p begin="00:00.500" end="00:03.000">'
        inputExtension={TTML_TO_QRC_CONVERSION.extension}
        sampleInput={SAMPLE_TTML}
        convert={convert}
        outputFormat={QRC_OUTPUT}
      />
      <section className="px-6 py-14 max-w-3xl mx-auto text-composer-text-secondary leading-relaxed space-y-5">
        <h2 className="text-2xl font-semibold text-composer-text">About TTML to QRC</h2>
        <p>
          QRC is the karaoke lyric format behind QQ Music. Every line opens with a header such as
          <code className="font-mono text-composer-accent-text"> [34059,2299]</code>: its start and its duration, both
          in milliseconds. Every word is followed by a tag of its own, so{" "}
          <code className="font-mono text-composer-accent-text">Is (34059,130)it (34189,120)</code> times the word
          before each tag.
        </p>
        <p>
          TTML stores a begin and an end where QRC stores a begin and a duration, so timed words convert to the
          millisecond. Each TTML agent becomes a singer marker, a line with the singer name and a colon, written
          wherever the voice changes. The output is a bare QRC body with
          <code className="font-mono text-composer-accent-text"> [ti:]</code>,
          <code className="font-mono text-composer-accent-text"> [ar:]</code> and
          <code className="font-mono text-composer-accent-text"> [al:]</code> header tags, not the encrypted file QQ
          Music downloads.
        </p>
        <p>
          Need the reverse? Use the
          <a href="/qrc-to-ttml" className="text-composer-accent-text hover:text-composer-accent">
            QRC to TTML converter
          </a>
          .
        </p>
      </section>
      <FaqSection title="TTML to QRC FAQ" entries={FAQS} />
      <BetterLyricsPromo />
    </>
  );
};

const TtmlToQrcPage: React.FC = () => {
  return (
    <LandingLayout>
      <PageHead
        title={TITLE}
        description={DESCRIPTION}
        path={PATH}
        jsonLd={[
          faqPageSchema(FAQS),
          howToSchema("Convert TTML to QRC online", DESCRIPTION, HOW_TO_STEPS),
          breadcrumbListSchema([
            { name: "Composer", path: "/" },
            { name: "TTML to QRC", path: PATH },
          ]),
          organizationSchema(),
        ]}
      />
      <TtmlToQrcContent />
    </LandingLayout>
  );
};

// -- Exports ------------------------------------------------------------------

export default TtmlToQrcPage;
export { TtmlToQrcContent };
