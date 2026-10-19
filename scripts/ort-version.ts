import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The package `exports` map hides package.json from `import`, so read it from disk.
function readOrtVersion(root: string): string {
  const pkgPath = resolve(root, "node_modules/onnxruntime-web/package.json");
  return (JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string }).version;
}

export { readOrtVersion };
