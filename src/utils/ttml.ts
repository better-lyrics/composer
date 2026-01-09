import type { Agent, LyricLine, ProjectMetadata } from "@/stores/project";

// -- Helpers ------------------------------------------------------------------

function formatTime(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return "0:00.000";
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	const ms = Math.floor((seconds % 1) * 1000);
	return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

function escapeXml(str: string): string {
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

function getLineTiming(line: LyricLine): { begin: number; end: number } | null {
	if (line.words?.length) {
		const firstWord = line.words[0];
		const lastWord = line.words[line.words.length - 1];
		return { begin: firstWord.begin, end: lastWord.end };
	}
	if (line.begin !== undefined && line.end !== undefined) {
		return { begin: line.begin, end: line.end };
	}
	return null;
}

// -- Generator ----------------------------------------------------------------

interface TTMLOptions {
	metadata: ProjectMetadata;
	agents: Agent[];
	lines: LyricLine[];
	granularity: "line" | "word";
}

function generateTTML({ metadata, agents, lines, granularity }: TTMLOptions): string {
	const xmlParts: string[] = [];

	// Root element with namespaces
	xmlParts.push(
		`<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" xmlns:composer="https://composer.boidu.dev/ttml" ttp:timeBase="media" xml:lang="${escapeXml(metadata.language || "en")}">`,
	);

	// Head section
	xmlParts.push("  <head>");
	xmlParts.push("    <metadata>");

	// Title
	if (metadata.title) {
		xmlParts.push(`      <ttm:title>${escapeXml(metadata.title)}</ttm:title>`);
	}

	// Agents
	for (const agent of agents) {
		const nameAttr = agent.name ? ` ttm:name="${escapeXml(agent.name)}"` : "";
		xmlParts.push(
			`      <ttm:agent xml:id="${escapeXml(agent.id)}" type="${agent.type}"${nameAttr}/>`,
		);
	}

	xmlParts.push("    </metadata>");
	xmlParts.push("  </head>");

	// Body section
	xmlParts.push("  <body>");
	xmlParts.push("    <div>");

	// Lines
	for (const line of lines) {
		const timing = getLineTiming(line);
		if (!timing) continue;

		const agentAttr = line.agentId ? ` ttm:agent="${escapeXml(line.agentId)}"` : "";

		if (granularity === "word" && line.words?.length) {
			// Word-level timing
			xmlParts.push(
				`      <p begin="${formatTime(timing.begin)}" end="${formatTime(timing.end)}"${agentAttr}>`,
			);

			for (let i = 0; i < line.words.length; i++) {
				const word = line.words[i];
				const isLast = i === line.words.length - 1;
				const text = isLast ? escapeXml(word.text) : `${escapeXml(word.text)} `;
				xmlParts.push(
					`        <span begin="${formatTime(word.begin)}" end="${formatTime(word.end)}">${text}</span>`,
				);
			}

			// Background vocals
			if (line.backgroundText) {
				xmlParts.push(`        <span ttm:role="x-bg">${escapeXml(line.backgroundText)}</span>`);
			}

			xmlParts.push("      </p>");
		} else {
			// Line-level timing
			let content = escapeXml(line.text);
			if (line.backgroundText) {
				content += ` <span ttm:role="x-bg">${escapeXml(line.backgroundText)}</span>`;
			}
			xmlParts.push(
				`      <p begin="${formatTime(timing.begin)}" end="${formatTime(timing.end)}"${agentAttr}>${content}</p>`,
			);
		}
	}

	xmlParts.push("    </div>");
	xmlParts.push("  </body>");
	xmlParts.push("</tt>");

	return xmlParts.join("\n");
}

// -- Exports ------------------------------------------------------------------

export { generateTTML, formatTime };
