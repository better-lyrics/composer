import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { SRC_ROOT, isTestFile, walkSourceFiles } from "@/test/source-files";

// -- Interfaces ---------------------------------------------------------------

interface ScannedSource {
  relPath: string;
  code: string;
}

interface HookCall {
  line: number;
  argument: string;
}

// -- Constants ----------------------------------------------------------------

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /(^|[\s;,{}()])\/\/.*$/gm;
const NOT_NEWLINE = /[^\n]/g;

// -- Helpers ------------------------------------------------------------------

// Blanks comments but keeps line numbers, so a rule never fires on prose about the pattern it bans.
function withoutComments(code: string): string {
  return code.replace(BLOCK_COMMENT, (block) => block.replace(NOT_NEWLINE, " ")).replace(LINE_COMMENT, "$1");
}

function productionSources(...dirs: string[]): ScannedSource[] {
  return dirs.flatMap((dir) =>
    [...walkSourceFiles(join(SRC_ROOT, dir))].flatMap((file) => {
      const relPath = relative(SRC_ROOT, file).split("\\").join("/");
      return isTestFile(relPath) ? [] : [{ relPath, code: withoutComments(readFileSync(file, "utf8")) }];
    }),
  );
}

function lineAt(code: string, index: number): number {
  return code.slice(0, index).split("\n").length;
}

function matchLines(code: string, pattern: RegExp): number[] {
  const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  return [...code.matchAll(global)].map((match) => lineAt(code, match.index));
}

// Every `<hook>(...)` call with its full argument text, balanced across lines.
function hookCalls(code: string, hook: string): HookCall[] {
  const calls: HookCall[] = [];
  const opener = `${hook}(`;
  for (let start = code.indexOf(opener); start !== -1; start = code.indexOf(opener, start + 1)) {
    if (/[\w.]/.test(code[start - 1] ?? "")) continue;
    let end = start + opener.length;
    for (let depth = 1; depth > 0 && end < code.length; end++) {
      if (code[end] === "(") depth++;
      else if (code[end] === ")") depth--;
    }
    calls.push({ line: lineAt(code, start), argument: code.slice(start + opener.length, end - 1).trim() });
  }
  return calls;
}

// -- Exports ------------------------------------------------------------------

export { hookCalls, matchLines, productionSources };
export type { ScannedSource };
