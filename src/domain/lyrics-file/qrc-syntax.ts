// Owns QRC timing grammar only; content conventions live in utils/lyrics-parsers/qrc-metadata.ts.

// -- Constants ----------------------------------------------------------------

const QRC_LINE_HEADER_REGEX = /\[(\d+),(\d+)\]/;
const QRC_WORD_TAG_REGEX = /\((\d+),(\d+)\)/;

// -- Derived ------------------------------------------------------------------

function scannerFor(regex: RegExp): RegExp {
  return new RegExp(regex.source, "g");
}

function matchAllLineHeaders(text: string): RegExpExecArray[] {
  return [...text.matchAll(scannerFor(QRC_LINE_HEADER_REGEX))];
}

function matchAllWordTags(text: string): RegExpExecArray[] {
  return [...text.matchAll(scannerFor(QRC_WORD_TAG_REGEX))];
}

function stripWordTags(text: string): string {
  return text.replace(scannerFor(QRC_WORD_TAG_REGEX), "");
}

// -- Exports ------------------------------------------------------------------

export { matchAllLineHeaders, matchAllWordTags, QRC_LINE_HEADER_REGEX, QRC_WORD_TAG_REGEX, stripWordTags };
