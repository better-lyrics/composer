import type { LyricLine } from "@/domain/line/model";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

function useLanguageTargets(lines: LyricLine[], metadata: ProjectMetadata, projectSession: number) {
  const persisted = [...new Set(lines.flatMap((line) => Object.keys(line.translations ?? {})))];
  const [context, setContext] = useState(() => ({
    session: projectSession,
    lineIds: new Set(lines.map((line) => line.id)),
    persisted,
    targets: [...new Set([...persisted, ...(metadata.language !== "en" ? ["en"] : [])])],
    project: {},
  }));
  const replaced =
    projectSession !== context.session ||
    (context.lineIds.size > 0 ? !lines.some((line) => context.lineIds.has(line.id)) : lines.length > 0);
  let current = context;
  if (replaced || JSON.stringify(persisted) !== JSON.stringify(context.persisted)) {
    current = {
      session: projectSession,
      lineIds: new Set(lines.map((line) => line.id)),
      persisted,
      // Persisted tracks can change through imports or undo while this panel is
      // hidden. Keep empty user-selected targets only within the same project.
      targets: replaced
        ? [...new Set([...persisted, ...(metadata.language !== "en" ? ["en"] : [])])]
        : [...new Set([...context.targets, ...persisted])],
      project: replaced ? {} : context.project,
    };
    setContext(current);
  }
  const targetsRef = useRef(current.targets);
  useLayoutEffect(() => {
    // Only publish committed targets to asynchronous generation callbacks.
    // A suspended or discarded render must not change the active request's targets.
    targetsRef.current = current.targets;
  }, [current.targets]);
  const setTargets = useCallback((value: string[] | ((previous: string[]) => string[])) => {
    const targets = typeof value === "function" ? value(targetsRef.current) : value;
    targetsRef.current = targets;
    setContext((previous) => ({ ...previous, targets }));
  }, []);
  return { targets: current.targets, targetsRef, setTargets, project: current.project };
}

export { useLanguageTargets };
