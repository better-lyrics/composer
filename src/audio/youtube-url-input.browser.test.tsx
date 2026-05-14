import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { YouTubeUrlInput } from "@/audio/youtube-url-input";
import { useAudioStore } from "@/stores/audio";
import { render } from "@/test/render";

describe("YouTubeUrlInput", () => {
  it("renders the input and a disabled Load button when empty", async () => {
    const screen = await render(<YouTubeUrlInput />);
    const input = screen.getByPlaceholder(/YouTube URL/i);
    await expect.element(input).toBeInTheDocument();
    const loadButton = screen.getByRole("button", { name: /Load$/ });
    expect((loadButton.element() as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables the Load button once a non-empty value is entered", async () => {
    const screen = await render(<YouTubeUrlInput />);
    await screen.getByPlaceholder(/YouTube URL/i).fill("dQw4w9WgXcQ");
    const loadButton = screen.getByRole("button", { name: /Load$/ });
    expect((loadButton.element() as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows an error message when an invalid input is submitted", async () => {
    const screen = await render(<YouTubeUrlInput />);
    await screen.getByPlaceholder(/YouTube URL/i).fill("not a valid id");
    await screen.getByRole("button", { name: /Load$/ }).click();
    await expect.element(screen.getByText(/doesn't look like a valid YouTube/)).toBeInTheDocument();
  });

  it("clears the error as the user types again", async () => {
    const screen = await render(<YouTubeUrlInput />);
    const input = screen.getByPlaceholder(/YouTube URL/i);
    await input.fill("not valid");
    await screen.getByRole("button", { name: /Load$/ }).click();
    await expect.element(screen.getByText(/doesn't look like a valid YouTube/)).toBeInTheDocument();
    await input.fill("not validX");
    await expect.element(screen.getByText(/doesn't look like a valid YouTube/)).not.toBeInTheDocument();
  });

  it("submits on Enter when the input has focus", async () => {
    const screen = await render(<YouTubeUrlInput />);
    const input = screen.getByPlaceholder(/YouTube URL/i);
    await input.fill("not-valid");
    (input.element() as HTMLInputElement).focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(screen.getByText(/doesn't look like a valid YouTube/)).toBeInTheDocument();
  });

  it("disables the input and shows 'Loading' while isLoading is true", async () => {
    useAudioStore.setState({ isLoading: true });
    const screen = await render(<YouTubeUrlInput />);
    const input = screen.getByPlaceholder(/YouTube URL/i).element() as HTMLInputElement;
    expect(input.disabled).toBe(true);
    await expect.element(screen.getByRole("button", { name: /Loading/ })).toBeInTheDocument();
  });
});
