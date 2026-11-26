// Lets plain Node run the app's TypeScript modules: `@/` resolves to src/, an
// extensionless import finds its .ts file, and JSON loads as a default export
// the way Vite imports it. Register with `node --import ./scripts/lib/alias-hooks.mjs`.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = new URL("../../src/", import.meta.url);

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const target = new URL(specifier.slice(2), SRC);
    const path = fileURLToPath(target);
    const file = existsSync(path) ? target : existsSync(`${path}.ts`) ? pathToFileURL(`${path}.ts`) : target;
    return next(file.href, context);
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.endsWith(".json")) {
    const source = await readFile(fileURLToPath(url), "utf8");
    return { format: "module", source: `export default ${source};`, shortCircuit: true };
  }
  return next(url, context);
}

if (!process.env.ALIAS_HOOKS_REGISTERED) {
  process.env.ALIAS_HOOKS_REGISTERED = "1";
  register(import.meta.url);
}
