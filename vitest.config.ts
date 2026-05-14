import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: [
      "@tabler/icons-react",
      "@floating-ui/react",
      "overlayscrollbars-react",
      "motion/react",
      "@dnd-kit/core",
      "react-router-dom",
    ],
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          globals: true,
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.browser.test.{ts,tsx}"],
          setupFiles: ["./src/test/setup-unit.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.{ts,tsx}"],
          setupFiles: ["./src/test/setup-browser.ts"],
          browser: {
            enabled: true,
            provider: playwright({
              launchOptions: {
                args: ["--autoplay-policy=no-user-gesture-required"],
              },
            }),
            headless: true,
            screenshotFailures: false,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
