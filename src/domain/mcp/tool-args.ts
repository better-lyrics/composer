// -- Types --------------------------------------------------------------------

type ToolArgs = Record<string, unknown>;

interface LanguageLineArg {
  lineId: string;
  text: string;
  backgroundText?: string;
}

interface AlignmentLineArg {
  lineId: string;
  part: "main" | "background";
  slices: string[];
}

// -- Errors -------------------------------------------------------------------

/** A tool call the agent can fix by changing its arguments. */
class ToolInputError extends Error {}

// -- Readers ------------------------------------------------------------------

function isRecord(value: unknown): value is ToolArgs {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toolArgs(value: unknown): ToolArgs {
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) throw new ToolInputError("Arguments must be an object.");
  return value;
}

function optionalString(args: ToolArgs, key: string): string | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new ToolInputError(`${key} must be a string.`);
  return value;
}

function requiredString(args: ToolArgs, key: string): string {
  const value = optionalString(args, key);
  if (value === undefined || !value.trim()) throw new ToolInputError(`${key} is required.`);
  return value;
}

function optionalBoolean(args: ToolArgs, key: string): boolean {
  const value = args[key];
  if (value === undefined) return false;
  if (typeof value !== "boolean") throw new ToolInputError(`${key} must be true or false.`);
  return value;
}

function optionalInteger(args: ToolArgs, key: string, fallback: number, min: number, max: number): number {
  const value = args[key];
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new ToolInputError(`${key} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

function stringList(value: unknown, key: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ToolInputError(`${key} must be a list of strings.`);
  }
  return value;
}

function optionalStringList(args: ToolArgs, key: string): string[] | undefined {
  return args[key] === undefined ? undefined : stringList(args[key], key);
}

function records(args: ToolArgs, key: string): ToolArgs[] {
  const value = args[key];
  if (!Array.isArray(value) || value.length === 0 || !value.every(isRecord)) {
    throw new ToolInputError(`${key} must be a non-empty list of objects.`);
  }
  return value;
}

function languageLines(args: ToolArgs): LanguageLineArg[] {
  return records(args, "lines").map((line, index) => {
    const at = `lines[${index}]`;
    const text = line.text;
    const backgroundText = line.backgroundText;
    if (typeof text !== "string") throw new ToolInputError(`${at}.text must be a string.`);
    if (backgroundText !== undefined && typeof backgroundText !== "string") {
      throw new ToolInputError(`${at}.backgroundText must be a string.`);
    }
    return {
      lineId: requiredString(line, "lineId"),
      text,
      ...(backgroundText !== undefined ? { backgroundText } : {}),
    };
  });
}

function editedLines(args: ToolArgs): Array<{ lineId: string; text: string }> {
  return records(args, "lines").map((line, index) => {
    const text = line.text;
    if (typeof text !== "string" || !text.trim())
      throw new ToolInputError(`lines[${index}].text must be non-empty text.`);
    if (text.includes("\n")) throw new ToolInputError(`lines[${index}].text must be a single line.`);
    return { lineId: requiredString(line, "lineId"), text };
  });
}

function alignmentLines(args: ToolArgs): AlignmentLineArg[] {
  return records(args, "lines").map((line, index) => {
    const part = line.part ?? "main";
    if (part !== "main" && part !== "background") {
      throw new ToolInputError(`lines[${index}].part must be main or background.`);
    }
    return { lineId: requiredString(line, "lineId"), part, slices: stringList(line.slices, `lines[${index}].slices`) };
  });
}

// -- Exports ------------------------------------------------------------------

export type { LanguageLineArg, ToolArgs };
export {
  alignmentLines,
  editedLines,
  languageLines,
  optionalBoolean,
  optionalInteger,
  optionalString,
  optionalStringList,
  requiredString,
  ToolInputError,
  toolArgs,
};
