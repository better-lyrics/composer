import type { GuideEvent, GuideTrigger } from "@/domain/guide/model";

// -- Rules --------------------------------------------------------------------

function firesOn(trigger: GuideTrigger, events: readonly GuideEvent[], now: number): boolean {
  const latest = events.findLast((event) => event.signal === trigger.signal);
  if (!latest) return false;
  const sameSpot = (key: string | undefined) =>
    trigger.near === undefined ? key === latest.key : Math.abs(Number(key) - Number(latest.key)) <= trigger.near;
  const matching = events.filter(
    (event) => event.signal === trigger.signal && sameSpot(event.key) && now - event.at < trigger.windowMs,
  );
  return matching.length >= trigger.count;
}

// -- Exports ------------------------------------------------------------------

export { firesOn };
