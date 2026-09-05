import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { useLanguageTargets } from "@/views/languages/use-language-targets";
import { Suspense, startTransition, useLayoutEffect, useState } from "react";
import { expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

it("publishes only committed targets while preserving synchronous target changes", async () => {
  const initial: LyricLine[] = [{ id: "line", text: "Hello", agentId: "v1" }];
  const imported: LyricLine[] = [
    {
      ...initial[0],
      translations: { fr: { language: "fr", text: "Bonjour", origin: "import", sourceFingerprint: "source" } },
    },
  ];
  const metadata = useProjectStore.getState().metadata;
  let committed: ReturnType<typeof useLanguageTargets> | undefined;
  const attemptedImport = vi.fn();
  let ready = false;
  let release = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });

  function ImportGate({ importing }: { importing: boolean }) {
    if (importing && !ready) {
      attemptedImport();
      throw pending;
    }
    return null;
  }

  function Targets({ lines }: { lines: LyricLine[] }) {
    const result = useLanguageTargets(lines, metadata, 0);
    useLayoutEffect(() => {
      committed = result;
    });
    return (
      <>
        <output aria-label="Targets">{result.targets.join(",")}</output>
        <button
          type="button"
          onClick={() => {
            result.setTargets((targets) => targets.filter((target) => target !== "en"));
            result.setTargets((targets) => [...targets, "es"]);
          }}
        >
          Change targets
        </button>
        <ImportGate importing={lines === imported} />
      </>
    );
  }

  function Harness() {
    const [lines, setLines] = useState(initial);
    return (
      <>
        <button type="button" onClick={() => startTransition(() => setLines(imported))}>
          Import
        </button>
        <Suspense fallback="Loading">
          <Targets lines={lines} />
        </Suspense>
      </>
    );
  }

  const screen = await render(<Harness />);
  await expect.element(screen.getByLabelText("Targets")).toHaveTextContent("en");
  await screen.getByRole("button", { name: "Import", exact: true }).click();
  await expect.poll(() => attemptedImport.mock.calls.length).toBeGreaterThan(0);
  // The suspended render knows about French, but generation callbacks must
  // still see the currently committed English-only target selection.
  expect(committed?.targetsRef.current).toEqual(["en"]);

  ready = true;
  release();
  await expect.element(screen.getByLabelText("Targets")).toHaveTextContent("en,fr");
  expect(committed?.targetsRef.current).toEqual(["en", "fr"]);

  await screen.getByRole("button", { name: "Change targets", exact: true }).click();
  await expect.element(screen.getByLabelText("Targets")).toHaveTextContent("fr,es");
  expect(committed?.targetsRef.current).toEqual(["fr", "es"]);
});
