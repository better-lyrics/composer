import { withoutSplitCharacter } from "./split-character-text";

// -- Functions ----------------------------------------------------------------

// Normalizes a word's text for diff comparison: strips split characters and
// trailing whitespace so "love" matches "love " etc.
function wordKey(text: string, splitChar: string): string {
  return withoutSplitCharacter(text, splitChar).trim();
}

// Standard longest-common-subsequence pairs. Returns [(beforeIdx, afterIdx), ...]
// in ascending order. Used to align unchanged words across a source structural edit.
// A shared start pairs in place first, so a repeated item added after it is the new one, not the old ones moved.
function lcsPairs<T>(a: T[], b: T[]): Array<[number, number]> {
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  const m = a.length - prefix;
  const n = b.length - prefix;
  const pairs: Array<[number, number]> = [];
  if (m > 0 && n > 0) {
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[prefix + i - 1] === b[prefix + j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
      if (a[prefix + i - 1] === b[prefix + j - 1]) {
        pairs.push([prefix + i - 1, prefix + j - 1]);
        i--;
        j--;
      } else if (dp[i - 1][j] >= dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }
  }
  for (let index = prefix - 1; index >= 0; index--) pairs.push([index, index]);
  pairs.reverse();
  return pairs;
}

// -- Exports ------------------------------------------------------------------

export { lcsPairs, wordKey };
