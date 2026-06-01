import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import "vite-react-ssg";
import { writeSeoAssets } from "./scripts/build-seo-assets";
import { kuroshiroDictPlugin } from "./scripts/kuroshiro-dict-plugin";
import pkg from "./package.json";

const SITE_ORIGIN = "https://composer.boidu.dev";

export default defineConfig({
  plugins: [react(), tailwindcss(), kuroshiroDictPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  ssgOptions: {
    formatting: "none",
    crittersOptions: false,
    async onFinished(outDir) {
      await writeSeoAssets(outDir, SITE_ORIGIN);
    },
  },
});
