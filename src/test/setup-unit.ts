import { beforeEach } from "vitest";
import { resetAllStores } from "@/test/stores";

beforeEach(async () => {
  await resetAllStores();
});
