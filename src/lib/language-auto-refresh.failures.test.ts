import { useProjectStore } from "@/stores/project";
import { createRefresher, disposeRefreshers, gate, lineById, timedLine } from "@/test/generated-language-lines";
import { stubGoogleLanguageFetch } from "@/test/google-language-fetch";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// -- Setup --------------------------------------------------------------------

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  disposeRefreshers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// -- Tests --------------------------------------------------------------------

describe("createLanguageAutoRefresh failures", () => {
  it("asks Google again for a failed line only after the line changes", async () => {
    const requests = stubGoogleLanguageFetch({
      detectedLanguage: "ru",
      romanizations: { "Сильный дождь": "Silnyy dozhd" },
      translations: { "Сильный дождь": "Heavy rain" },
    });
    useProjectStore.setState({ lines: [timedLine("a", ["Слабый", "дождь"], ["Lyogkiy", "dozhd"], "Лёгкий дождь")] });
    const refresher = createRefresher();

    await refresher.refreshNow();
    const failedRequests = requests.length;
    await refresher.refreshNow();
    expect(requests.length).toBe(failedRequests);

    useProjectStore.getState().updateLine("a", { text: "Сильный дождь" }, { deriveText: false });
    await refresher.refreshNow();
    expect(lineById("a").transliteration?.text).toBe("Silnyy  dozhd");
  });

  it("asks Google again for a failed line when another project opens", async () => {
    const line = timedLine("a", ["Ранний", "снег"], ["Pozdniy", "sneg"], "Поздний снег");
    useProjectStore.setState({ lines: [line] });
    const refresher = createRefresher();
    stubGoogleLanguageFetch({ detectedLanguage: "ru", romanizations: {}, translations: {} });
    await refresher.refreshNow();

    useProjectStore.getState().startProjectSession();
    useProjectStore.setState({ lines: [line] });
    stubGoogleLanguageFetch({
      detectedLanguage: "ru",
      romanizations: { "Ранний снег": "Ranniy sneg" },
      translations: { "Ранний снег": "Early snow" },
    });
    await refresher.refreshNow();

    expect(lineById("a").transliteration?.text).toBe("Ranniy  sneg");
  });

  it("refreshes a failed line by itself when the browser comes back online", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    useProjectStore.setState({ lines: [timedLine("a", ["Новая", "весна"], ["Staraya", "vesna"], "Старая весна")] });
    const refresher = createRefresher();
    stubGoogleLanguageFetch({ detectedLanguage: "ru", romanizations: {}, translations: {} });
    await refresher.refreshNow();
    stubGoogleLanguageFetch({
      detectedLanguage: "ru",
      romanizations: { "Новая весна": "Novaya vesna" },
      translations: { "Новая весна": "New spring" },
    });

    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(1000);

    await vi.waitFor(() => expect(lineById("a").transliteration?.text).toBe("Novaya  vesna"));
  });

  it("regression: a request that fails while reconnecting does not block the line", async () => {
    useProjectStore.setState({
      lines: [timedLine("a", ["Яркое", "солнце"], ["Blednoye", "solntse"], "Бледное солнце")],
    });
    const refresher = createRefresher();
    const answer = gate();
    const requests = stubGoogleLanguageFetch(
      { detectedLanguage: "ru", romanizations: {}, translations: {} },
      answer.opened,
    );

    const failing = refresher.refreshNow();
    await vi.waitFor(() => expect(requests.length).toBeGreaterThan(0));
    window.dispatchEvent(new Event("online"));
    answer.open();
    await failing;
    stubGoogleLanguageFetch({
      detectedLanguage: "ru",
      romanizations: { "Яркое солнце": "Yarkoye solntse" },
      translations: { "Яркое солнце": "Bright sun" },
    });
    await refresher.refreshNow();

    expect(lineById("a").transliteration?.text).toBe("Yarkoye  solntse");
  });
});
