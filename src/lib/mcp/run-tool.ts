import { type ToolArgs, ToolInputError, toolArgs } from "@/domain/mcp/tool-args";
import { alignTransliteration } from "@/lib/mcp/alignment-tool";
import { editLines } from "@/lib/mcp/edit-tool";
import { setProjectLanguage } from "@/lib/mcp/project-tool";
import { setTranslations, setTransliterations } from "@/lib/mcp/language-tools";
import { getLines, getProject } from "@/lib/mcp/read-tools";

// -- Types --------------------------------------------------------------------

interface ToolCallResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[McpBridge]";

const TOOL_HANDLERS: Record<string, (args: ToolArgs) => unknown> = {
  get_project: getProject,
  get_lines: getLines,
  set_project_language: setProjectLanguage,
  edit_lines: editLines,
  set_transliterations: setTransliterations,
  set_translations: setTranslations,
  align_transliteration: alignTransliteration,
};

// -- Helpers ------------------------------------------------------------------

function textResult(value: unknown, isError = false): ToolCallResult {
  return {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 1) }],
    ...(isError ? { isError } : {}),
  };
}

// -- Functions ----------------------------------------------------------------

function runMcpTool(name: string, rawArgs: unknown): ToolCallResult {
  const handler = TOOL_HANDLERS[name];
  if (!handler) return textResult(`Composer has no tool named ${name}. Reload Composer to get the latest tools.`, true);
  try {
    return textResult(handler(toolArgs(rawArgs)));
  } catch (error) {
    if (error instanceof ToolInputError) return textResult(error.message, true);
    console.error(LOG_PREFIX, `tool ${name} failed`, error);
    return textResult(
      `Composer could not run ${name}: ${error instanceof Error ? error.message : String(error)}`,
      true,
    );
  }
}

// -- Exports ------------------------------------------------------------------

export { runMcpTool };
