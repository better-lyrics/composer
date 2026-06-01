import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin, ResolvedConfig } from "vite";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DICT_DIR = resolve(PROJECT_ROOT, "node_modules/kuroshiro-browser/dist/dict");

// kuroshiro-browser fetches its dictionaries at `./dict/*.br` and constructs
// `new Int32Array(arrayBuffer)` from the response. That requires the browser to
// transparently brotli-decompress the body, which only happens when the
// response carries `Content-Encoding: br`. Vite's static file middleware does
// not set that header for raw `.br` files; Cloudflare Pages assets serving
// doesn't either. This plugin: (a) streams the files with the correct headers
// in dev / test, and (b) at build time, copies the files to `dist/dict/` and
// writes a `_headers` rule so Cloudflare returns them with `Content-Encoding:
// br`.
function kuroshiroDictPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig | null = null;
  return {
    name: "composer:kuroshiro-dict",
    configResolved(config) {
      resolvedConfig = config;
    },
    configureServer(server) {
      server.middlewares.use("/dict", (req, res, next) => {
        const file = (req.url ?? "").split("?")[0];
        if (!file || !file.endsWith(".br")) {
          next();
          return;
        }
        const fullPath = resolve(SOURCE_DICT_DIR, `.${file}`);
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Encoding", "br");
        createReadStream(fullPath)
          .on("error", () => next())
          .pipe(res);
      });
    },
    async closeBundle() {
      if (!resolvedConfig || resolvedConfig.command !== "build") return;
      const outDir = resolve(resolvedConfig.root, resolvedConfig.build.outDir);
      const destDictDir = resolve(outDir, "dict");
      await mkdir(destDictDir, { recursive: true });
      const entries = await readdir(SOURCE_DICT_DIR);
      await Promise.all(entries.map((name) => copyFile(resolve(SOURCE_DICT_DIR, name), resolve(destDictDir, name))));
      await appendHeadersRule(outDir);
    },
  };
}

const HEADERS_RULE = "/dict/*\n  Content-Encoding: br\n  Content-Type: application/octet-stream\n";

async function appendHeadersRule(outDir: string): Promise<void> {
  const headersPath = resolve(outDir, "_headers");
  let existing = "";
  try {
    existing = await readFile(headersPath, "utf8");
  } catch {
    existing = "";
  }
  if (existing.includes("/dict/*")) return;
  const next = existing ? `${existing.trimEnd()}\n\n${HEADERS_RULE}` : HEADERS_RULE;
  await writeFile(headersPath, next);
}

export { kuroshiroDictPlugin };
