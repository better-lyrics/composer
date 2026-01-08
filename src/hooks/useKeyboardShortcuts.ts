import { useCallback, useEffect } from "react";

// -- Types --------------------------------------------------------------------

interface Shortcut {
	key: string;
	ctrl?: boolean;
	shift?: boolean;
	alt?: boolean;
	meta?: boolean;
	action: () => void;
	description: string;
}

interface ShortcutOptions {
	enabled?: boolean;
}

// -- Helpers ------------------------------------------------------------------

function matchesShortcut(event: KeyboardEvent, shortcut: Shortcut): boolean {
	const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
	const ctrlMatches = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
	const shiftMatches = !!shortcut.shift === event.shiftKey;
	const altMatches = !!shortcut.alt === event.altKey;

	return keyMatches && ctrlMatches && shiftMatches && altMatches;
}

// -- Hook ---------------------------------------------------------------------

function useKeyboardShortcuts(shortcuts: Shortcut[], options: ShortcutOptions = {}): void {
	const { enabled = true } = options;

	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (!enabled) return;

			const target = event.target as HTMLElement;
			const isInput =
				target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

			for (const shortcut of shortcuts) {
				if (matchesShortcut(event, shortcut)) {
					if (isInput && !shortcut.ctrl && !shortcut.meta) {
						continue;
					}
					event.preventDefault();
					shortcut.action();
					return;
				}
			}
		},
		[shortcuts, enabled],
	);

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown]);
}

export { useKeyboardShortcuts, matchesShortcut };
export type { Shortcut, ShortcutOptions };
