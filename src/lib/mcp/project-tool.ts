import { type ToolArgs, ToolInputError, optionalString } from "@/domain/mcp/tool-args";
import { isValidLanguageTag, normalizeLanguageTag } from "@/domain/project/language";
import { requireOpenProject } from "@/lib/mcp/tool-project";
import { useProjectStore } from "@/stores/project";

// -- Tool ---------------------------------------------------------------------

/** The Song details language field, not the Languages tab's Source select: it never regenerates translations. */
function setProjectLanguage(args: ToolArgs): unknown {
  const projectId = requireOpenProject(optionalString(args, "projectId"));
  const requested = optionalString(args, "language");
  if (requested === undefined) throw new ToolInputError("language is required. Pass an empty string for auto-detect.");
  if (requested.trim() && !isValidLanguageTag(requested)) {
    throw new ToolInputError(`${requested} is not a valid BCP 47 language tag.`);
  }
  const store = useProjectStore.getState();
  const previous = store.metadata.language ?? null;
  const language = normalizeLanguageTag(requested);
  store.setMetadata({ language });
  return { projectId, language: language ?? null, previous };
}

// -- Exports ------------------------------------------------------------------

export { setProjectLanguage };
