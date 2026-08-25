import { convertViaParser, type ParserConversion } from "@/pages/converters/convert-via-parser";
import { ConverterView, type ConvertArgs } from "@/pages/converters/converter-view";
import { LandingLayout } from "@/pages/landing/landing-layout";
import { BetterLyricsPromo } from "@/pages/landing/sections/better-lyrics-promo";
import { FaqSection } from "@/pages/landing/sections/faq-section";
import { PageHead } from "@/seo/page-head";
import { breadcrumbListSchema, faqPageSchema, howToSchema, organizationSchema } from "@/seo/schemas";
import { useCallback } from "react";

// -- Constants ----------------------------------------------------------------

const SAMPLE_QRC = `[ti:Sample Song]
[ar:Sample Artist]
[12765,752]Lead Vocalist：(12765,487)
[34059,2299]Is (34059,130)it (34189,120)so (34309,104)hard (34413,281)to (34694,277)say(34971,1387)`;

const FAQS = [
  {
    question: "What is a QRC file?",
    answer:
      "QRC is the karaoke lyric format QQ Music uses. It carries one timestamp per line and one timestamp per word, both in integer milliseconds, and it usually arrives wrapped in a small XML document with the lyric body held in a LyricContent attribute.",
  },
  {
    question: "How does QRC differ from LRC?",
    answer:
      "Two ways. QRC gives a begin time and a duration where LRC gives only a begin time, and a QRC word tag comes after the word it belongs to instead of before it. Enhanced LRC writes a timestamp in front of each word; QRC writes it behind.",
  },
  {
    question: "Do the singer markers in a QRC file survive the conversion?",
    answer:
      "Yes. A line whose whole text is a performer name and a colon marks a change of voice. Composer turns each name into a TTML agent and attributes every following line to it, so a duet keeps its vocalist split in the output.",
  },
  {
    question: "Is my QRC file uploaded anywhere?",
    answer: "No. The entire conversion happens locally in your browser. Nothing is sent to a server.",
  },
  {
    question: "What do I do if I need to adjust timing after converting?",
    answer:
      "Click 'Open in Composer' and the converted project opens inside the full editor. Load the matching audio file, nudge word timing against the waveform, and export TTML again.",
  },
];

const PATH = "/qrc-to-ttml";
const TITLE = "QRC to TTML Converter ・ QQ Music Lyrics to Apple Music TTML";
const DESCRIPTION =
  "Convert QQ Music QRC lyric files to Apple Music ready TTML in your browser. Word-level timing, singer credits and multiple vocalists are all preserved. Free, no signup.";

const HOW_TO_STEPS = [
  { name: "Paste your QRC", text: "Paste your QRC file content into the input box." },
  { name: "Review the TTML", text: "Composer produces TTML output on the right as you paste." },
  {
    name: "Download or refine",
    text: "Download the TTML, or open it in Composer to refine timing against an audio waveform.",
  },
];

const QRC_CONVERSION: ParserConversion = {
  extension: "qrc",
  granularity: "auto",
  emptyMessage: "No timed lines found. Make sure your QRC contains [beginMs,durationMs] line headers.",
  failureMessage: "Could not parse QRC. Check the input format.",
  logLabel: "QRC",
};

// -- Components ---------------------------------------------------------------

// Split from the page so browser tests can render it: PageHead needs the head
// provider that only the SSG and client entries install.
const QrcToTtmlContent: React.FC = () => {
  const convert = useCallback((args: ConvertArgs) => convertViaParser(QRC_CONVERSION, args), []);

  return (
    <>
      <ConverterView
        title="QRC to TTML Converter"
        inputLabel="Paste QRC"
        inputPlaceholder="[ti:Song title]&#10;[34059,2299]Is (34059,130)it (34189,120)"
        sampleInput={SAMPLE_QRC}
        convert={convert}
        downloadFilename="lyrics.ttml"
      />
      <section className="px-6 py-14 max-w-3xl mx-auto text-composer-text-secondary leading-relaxed space-y-5">
        <h2 className="text-2xl font-semibold text-composer-text">About QRC</h2>
        <p>
          QRC is the karaoke lyric format behind QQ Music. Every line opens with a header in square brackets,
          <code className="font-mono text-composer-accent-text"> [beginMs,durationMs]</code>, and every word inside that
          line carries a tag of its own in round brackets,
          <code className="font-mono text-composer-accent-text"> (beginMs,durationMs)</code>. Both numbers are integer
          milliseconds, and both give a duration rather than an end stamp.
        </p>
        <p>
          The detail that catches people out is where the word tag sits. A QRC word tag comes after the word it times,
          so in <code className="font-mono text-composer-accent-text">Is (34059,130)it (34189,120)</code> the tag
          34059,130 belongs to the word before it and starts the line at 34.059 seconds. Enhanced LRC does the opposite
          and writes its timestamp in front. Read the tags the wrong way round and every word in the file lands one slot
          early.
        </p>
        <p>
          QQ mixes two other things into the same body. A line whose entire text is a performer name and a colon is a
          singer marker: Composer reads it as a change of voice and writes each performer out as a TTML
          <code className="font-mono text-composer-accent-text"> &lt;ttm:agent&gt;</code>, so a duet keeps its vocalist
          split. The credits block at the top, the lines beginning with "Lyrics by" or "Composed by", becomes songwriter
          metadata rather than a lyric line.
        </p>
        <p>
          TTML, the target format here, is the W3C Timed Text Markup Language that Apple Music, Spotify, and Amazon
          Music use for synchronized lyrics. Word tags become
          <code className="font-mono text-composer-accent-text"> &lt;span&gt; </code>elements with begin and end
          attributes; a QRC line carrying no word tags converts to a line-synced
          <code className="font-mono text-composer-accent-text"> &lt;p&gt; </code>instead.
        </p>
        <p>
          New to the target format? Read{" "}
          <a href="/guides/what-is-ttml" className="text-composer-accent-text hover:text-composer-accent">
            what TTML is
          </a>
          , or convert from a different source with the{" "}
          <a href="/lrc-to-ttml" className="text-composer-accent-text hover:text-composer-accent">
            LRC to TTML converter
          </a>
          .
        </p>
      </section>
      <FaqSection title="QRC to TTML FAQ" entries={FAQS} />
      <BetterLyricsPromo />
    </>
  );
};

const QrcToTtmlPage: React.FC = () => {
  return (
    <LandingLayout>
      <PageHead
        title={TITLE}
        description={DESCRIPTION}
        path={PATH}
        jsonLd={[
          faqPageSchema(FAQS),
          howToSchema("Convert QRC to TTML online", DESCRIPTION, HOW_TO_STEPS),
          breadcrumbListSchema([
            { name: "Composer", path: "/" },
            { name: "QRC to TTML", path: PATH },
          ]),
          organizationSchema(),
        ]}
      />
      <QrcToTtmlContent />
    </LandingLayout>
  );
};

// -- Exports ------------------------------------------------------------------

export default QrcToTtmlPage;
export { QrcToTtmlContent };
