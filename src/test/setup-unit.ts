import { beforeEach } from "vitest";
import { resetMusicBrainzQueue } from "@/lib/musicbrainz-client";
import { __resetPersistenceSettledForTests } from "@/lib/persistence-settled";
import { useSettingsStore } from "@/stores/settings";
import { resetAllStores } from "@/test/stores";

beforeEach(async () => {
  await resetAllStores();
  // Tests must never reach musicbrainz.org.
  useSettingsStore.setState({ musicBrainzLookup: "off" });
  resetMusicBrainzQueue();
  __resetPersistenceSettledForTests();
});
