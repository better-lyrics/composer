import { stripSplitCharacter } from "@/utils/split-character";

// -- Functions ----------------------------------------------------------------

// Normalizes a word's text for diff comparison: strips split characters and
// trailing whitespace so "love" matches "love " etc.
function wordKey(text: string): string {
  return stripSplitCharacter(text).trim();
}

// Standard longest-common-subsequence pairs. Returns [(beforeIdx, afterIdx), ...]
// in ascending order. Used to align unchanged words across a source structural edit.
function lcsPairs<T>(a: T[], b: T[]): Array<[number, number]> {
  const m = a.length;
  const n = b.length;
  if (m === 0 || n === 0) return [];
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      pairs.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  pairs.reverse();
  return pairs;
}

// -- Exports ------------------------------------------------------------------

export { lcsPairs, wordKey };
