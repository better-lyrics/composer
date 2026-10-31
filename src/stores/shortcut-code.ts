import {
  migrateSavedOverrides,
  type SavedBindings,
  SHORTCUT_BINDINGS_VERSION,
} from "@/stores/shortcut-bindings-migration";
import { isShortcutPresetId, type ShortcutPresetId } from "@/stores/shortcut-presets";
import { getShortcutById, type ShortcutBinding } from "@/stores/shortcut-registry";

// -- Types --------------------------------------------------------------------

interface ShortcutCode {
  preset: ShortcutPresetId;
  overrides: Record<string, ShortcutBinding>;
}

type Modifier = "mod" | "meta" | "ctrl" | "shift" | "alt";

// -- Constants ----------------------------------------------------------------

//   csk1:<preset>:<version>:<id>=<modifier+...+encoded key>;...
const CODE_PREFIX = "csk1:";
const UNBOUND_CODE = "none";
const MODIFIERS: readonly Modifier[] = ["mod", "meta", "ctrl", "shift", "alt"];

const NOT_A_CODE = "That isn't a shortcuts code. It should start with csk1:.";
const UNKNOWN_PRESET = "This code uses a preset Composer doesn't know.";

// -- Helpers ------------------------------------------------------------------

function encodeBinding(binding: ShortcutBinding): string {
  if (binding.key === "") return UNBOUND_CODE;
  return [...MODIFIERS.filter((modifier) => binding[modifier]), encodeURIComponent(binding.key)].join("+");
}

function encodeShortcutCode(preset: ShortcutPresetId, overrides: Record<string, ShortcutBinding>): string {
  const entries = Object.entries(overrides).map(([id, binding]) => `${id}=${encodeBinding(binding)}`);
  return `${CODE_PREFIX}${preset}:${SHORTCUT_BINDINGS_VERSION}:${entries.join(";")}`;
}

function isModifier(part: string): part is Modifier {
  return MODIFIERS.some((modifier) => modifier === part);
}

function decodeBinding(text: string): ShortcutBinding {
  if (text === UNBOUND_CODE) return { key: "" };
  const parts = text.split("+");
  const encodedKey = parts.pop();
  if (!encodedKey || !parts.every(isModifier)) throw new Error(NOT_A_CODE);
  let key: string;
  try {
    key = decodeURIComponent(encodedKey);
  } catch (error) {
    throw new Error(NOT_A_CODE, { cause: error });
  }
  const binding: ShortcutBinding = { key };
  for (const modifier of parts) binding[modifier] = true;
  return binding;
}

function decodeOverrides(tail: string): Record<string, ShortcutBinding> {
  return Object.fromEntries(
    tail
      .split(";")
      .filter((entry) => entry !== "")
      .map((entry) => {
        const separator = entry.indexOf("=");
        if (separator <= 0) throw new Error(NOT_A_CODE);
        return [entry.slice(0, separator), decodeBinding(entry.slice(separator + 1))];
      }),
  );
}

function decodeShortcutCode(code: string): ShortcutCode {
  const text = code.trim();
  if (!text.startsWith(CODE_PREFIX)) throw new Error(NOT_A_CODE);
  const [preset, versionText, ...rest] = text.slice(CODE_PREFIX.length).split(":");
  const version = Number(versionText);
  if (rest.length === 0 || !Number.isInteger(version)) throw new Error(NOT_A_CODE);
  if (!isShortcutPresetId(preset)) throw new Error(UNKNOWN_PRESET);
  const saved = { overrides: decodeOverrides(rest.join(":")) };
  const { overrides = {} } = migrateSavedOverrides(saved, version) as SavedBindings;
  const unknownId = Object.keys(overrides).find((id) => !getShortcutById(id));
  if (unknownId) throw new Error(`This code has a shortcut Composer doesn't know: ${unknownId}.`);
  return { preset, overrides };
}

// -- Exports ------------------------------------------------------------------

export type { ShortcutCode };
export { decodeShortcutCode, encodeShortcutCode };
