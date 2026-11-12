import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { isTestFile, SRC_ROOT, walkSourceFiles, walkStylesheets } from "@/test/source-files";

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

const NOT_NEWLINE = /[^\n]/g;
const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT_PRECEDERS = new Set(["", " ", "\t", "\n", ";", ",", "{", "}", "(", ")"]);
const REGEX_PRECEDERS = new Set(["", "(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";"]);

// -- Helpers ------------------------------------------------------------------

function quotedEnd(code: string, start: number, quote: string): number {
  let index = start + 1;
  while (index < code.length && code[index] !== quote && code[index] !== "\n") {
    index += code[index] === "\\" ? 2 : 1;
  }
  return Math.min(index + 1, code.length);
}

// Returns the index after the closing backtick, or after `${` when an expression opens.
function templateChunkEnd(code: string, start: number): { end: number; opensExpression: boolean } {
  let index = start;
  while (index < code.length) {
    if (code[index] === "\\") index += 2;
    else if (code[index] === "`") return { end: index + 1, opensExpression: false };
    else if (code[index] === "$" && code[index + 1] === "{") return { end: index + 2, opensExpression: true };
    else index++;
  }
  return { end: code.length, opensExpression: false };
}

function lastNonSpace(text: string): string {
  let index = text.length - 1;
  while (index >= 0 && (text[index] === " " || text[index] === "\t" || text[index] === "\n")) index--;
  return text[index] ?? "";
}

function regexLiteralEnd(code: string, start: number): number | null {
  let inClass = false;
  for (let index = start + 1; index < code.length && code[index] !== "\n"; index++) {
    const char = code[index];
    if (char === "\\") index++;
    else if (char === "[") inClass = true;
    else if (char === "]") inClass = false;
    else if (char === "/" && !inClass) return index + 1;
  }
  return null;
}

// Blanks comments but keeps line numbers and literal contents, so a rule never fires on prose about the pattern it bans.
function withoutComments(code: string): string {
  let out = "";
  let index = 0;
  let braceDepth = 0;
  const templateBraceDepths: number[] = [];
  const copyTemplateChunk = (from: number) => {
    const chunk = templateChunkEnd(code, from);
    out += code.slice(index, chunk.end);
    index = chunk.end;
    if (chunk.opensExpression) templateBraceDepths.push(braceDepth);
  };
  while (index < code.length) {
    const char = code[index];
    const next = code[index + 1];
    if (char === "/" && next === "*") {
      const close = code.indexOf("*/", index + 2);
      const end = close === -1 ? code.length : close + 2;
      out += code.slice(index, end).replace(NOT_NEWLINE, " ");
      index = end;
    } else if (char === "/" && next === "/" && LINE_COMMENT_PRECEDERS.has(code[index - 1] ?? "")) {
      const newline = code.indexOf("\n", index);
      index = newline === -1 ? code.length : newline;
    } else if (char === '"' || char === "'") {
      const end = quotedEnd(code, index, char);
      out += code.slice(index, end);
      index = end;
    } else if (char === "`") {
      copyTemplateChunk(index + 1);
    } else if (char === "}" && templateBraceDepths.at(-1) === braceDepth) {
      templateBraceDepths.pop();
      copyTemplateChunk(index + 1);
    } else if (char === "/" && REGEX_PRECEDERS.has(lastNonSpace(out))) {
      const end = regexLiteralEnd(code, index) ?? index + 1;
      out += code.slice(index, end);
      index = end;
    } else {
      if (char === "{") braceDepth++;
      else if (char === "}") braceDepth--;
      out += char;
      index++;
    }
  }
  return out;
}

function productionSources(...dirs: string[]): ScannedSource[] {
  return dirs.flatMap((dir) =>
    [...walkSourceFiles(join(SRC_ROOT, dir))].flatMap((file) => {
      const relPath = relative(SRC_ROOT, file).split("\\").join("/");
      return isTestFile(relPath) ? [] : [{ relPath, code: withoutComments(readFileSync(file, "utf8")) }];
    }),
  );
}

function stylesheetSources(): ScannedSource[] {
  return [...walkStylesheets(SRC_ROOT)].map((file) => ({
    relPath: relative(SRC_ROOT, file).split("\\").join("/"),
    code: readFileSync(file, "utf8").replace(CSS_COMMENT, (comment) => comment.replace(NOT_NEWLINE, " ")),
  }));
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

export type { ScannedSource };
export { hookCalls, matchLines, productionSources, stylesheetSources, withoutComments };
