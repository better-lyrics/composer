import { useSettingsStore } from "@/stores/settings";

// -- Helpers ------------------------------------------------------------------

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSplitCharacter(): string {
  return useSettingsStore.getState().splitCharacter;
}

function cleanSplitCharacters(text: string, char?: string): string {
  const c = char ?? getSplitCharacter();
  const escaped = escapeRegex(c);
  const leading = new RegExp(`^${escaped}+`);
  const trailing = new RegExp(`${escaped}+$`);
  const consecutive = new RegExp(`${escaped}{2,}`, "g");

  return text
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) => {
      const cleaned = token.replace(leading, "").replace(trailing, "").replace(consecutive, c);
      return cleaned || token.replace(new RegExp(escaped, "g"), "");
    })
    .filter(Boolean)
    .join(" ");
}

function stripSplitCharacter(text: string): string {
  const c = getSplitCharacter();
  return text.replaceAll(c, "");
}

// -- Exports ------------------------------------------------------------------

export { escapeRegex, getSplitCharacter, cleanSplitCharacters, stripSplitCharacter };
