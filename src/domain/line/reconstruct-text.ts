import type { WordTiming } from "@/stores/project";

// -- Text reconstruction ------------------------------------------------------

// Rebuilds a line's text from its word array. Word texts carry their trailing
// space when a real space follows; two adjacent words with no space between
// them are syllables of one token, so the split character is reinserted at that
// joint. The result tokenizes 1:1 back to the same word count.
function reconstructLineText(words: WordTiming[], splitChar: string): string {
  let result = "";
  for (let i = 0; i < words.length; i++) {
    result += words[i].text;
    if (i < words.length - 1 && !words[i].text.endsWith(" ")) {
      result += splitChar;
    }
  }
  return result;
}

// -- Exports ------------------------------------------------------------------

export { reconstructLineText };
