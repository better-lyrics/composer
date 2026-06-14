import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { HEADING, INLINE_CODE, PROSE } from "@/ui/help-sections/shared";
import { InlineKeyBadge } from "@/ui/inline-key-badge";

// -- Importing ----------------------------------------------------------------

const ImportSection: React.FC = () => (
  <div className="space-y-5">
    <div>
      <h4 className={HEADING}>Audio files</h4>
      <p className={PROSE}>Supported formats: MP3, WAV, M4A, OGG, FLAC.</p>
      <ul className={`${PROSE} list-disc pl-4 mt-1.5 space-y-1`}>
        <li>Use the Import tab's drop zone, or drop a file directly onto the Timeline empty state.</li>
        <li>Once loaded, the waveform renders across the top of Timeline.</li>
        <li>The file name auto-fills the project title in metadata.</li>
        <li>To replace audio, just drop a new file on the Import tab.</li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>YouTube URLs</h4>
      <p className={PROSE}>
        Paste any YouTube link (full URL, share link, or just the video ID) into the Import tab. Composer downloads the
        audio once and keeps it in memory, so seeking and waveform rendering stay instant after that.
      </p>
      <ul className={`${PROSE} list-disc pl-4 mt-1.5 space-y-1`}>
        <li>The video title fills in as your project title.</li>
        <li>To swap videos, paste a new URL into the same input on the Import tab.</li>
        <li>If a download fails, check that the URL is right and that the video is public.</li>
        <li>
          A small number of videos won't download due to geo-restrictions or rights blocks. In that case, grab the audio
          some other way and drop the file into the Import tab.
        </li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>YouTube backends: Cobalt and Composer Bridge</h4>
      <p className={PROSE}>
        YouTube audio doesn't come from YouTube directly. Composer routes the request through a small backend service
        that fetches the audio and hands it back. There are two options.
      </p>
      <p className={`${PROSE} mt-2`}>
        <strong>Cobalt</strong> is the default. Composer ships with a public instance that handles verification
        automatically, but YouTube is currently blocking it. To get unblocked, add a working instance from
        cobalt.directory in Settings → Advanced, or self-host. Each custom instance shows a small status icon next to
        its name reflecting the last attempt, with the actual error in the tooltip if anything went wrong.
      </p>
      <p className={`${PROSE} mt-3`}>
        <strong>Composer Bridge</strong>
        <span className="ml-2 text-[10px] tracking-wide text-composer-accent-text">Experimental</span>
        <br />A tiny binary you run on your own machine that downloads YouTube audio over your residential IP, so
        YouTube doesn't block it the way it blocks shared Cobalt hosts. Composer talks to it over localhost; nothing
        leaves your machine. Toggle "Composer Bridge for YouTube" on in Settings → Advanced and every YouTube import
        routes through the bridge instead of Cobalt.
      </p>
      <ul className={`${PROSE} list-disc pl-4 mt-1.5 space-y-1`}>
        <li>
          If the bridge isn't installed yet, an inline guide appears with a one-line install command for macOS and
          Linux, plus a link to the Windows download.
        </li>
        <li>
          Once installed, launch <span className={INLINE_CODE}>Composer Bridge</span> from your Applications folder or
          run the binary from a terminal. It lives in your menu bar (Mac) or system tray (Windows, Linux). Leave it
          running.
        </li>
        <li>
          The default URL is <span className={INLINE_CODE}>http://localhost:7777</span>. Change it in the bridge URL
          field if you're running on a different port, and hit "Reset" to restore the default.
        </li>
      </ul>
      <p className={`${PROSE} mt-3`}>
        Sources, releases, and self-build instructions live on{" "}
        <a
          href="https://github.com/better-lyrics/composer-bridge"
          target="_blank"
          rel="noopener noreferrer"
          className="text-composer-text underline underline-offset-2 hover:text-composer-text-bright"
        >
          GitHub
        </a>
        . The install script verifies the release checksum before unpacking.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>Lyrics files</h4>
      <p className={PROSE}>
        Open the lyrics modal from the import button in Edit or the Timeline header (or press{" "}
        <InlineKeyBadge keys={getEffectiveKeysArray("timeline.importLyrics")} /> in Timeline). It has three sections:
      </p>
      <ul className={`${PROSE} list-disc pl-4 mt-1.5 space-y-1`}>
        <li>
          <strong>Search</strong>: queries LRCLib, Binimum, and Better Lyrics in parallel. Type a track or paste a video
          ID; artist, album, and duration narrow the results. Each row shows its sync precision (syllable, word, line,
          or unsynced) and how close its duration is to your project's.
        </li>
        <li>
          <strong>Paste</strong>: drop in raw lyrics. Use <span className={INLINE_CODE}>|</span> to split syllables
          (e.g. <span className={INLINE_CODE}>beau|ti|ful</span>).
        </li>
        <li>
          <strong>Upload</strong>: drag a file in, or click to browse. Accepts .txt, .lrc, .srt, .ttml.
        </li>
      </ul>
      <p className={`${PROSE} mt-3`}>
        In Edit, double-clicking the import button skips the modal and opens the file picker directly, like the old
        flow.
      </p>
      <p className={`${PROSE} mt-3`}>
        Supported formats: .txt (plain text), .lrc (line-level timing), .srt (subtitles), .ttml (full timing + agents).
        Imported timing is preserved; plain .txt files get none and you sync them manually.
      </p>
      <p className={`${PROSE} mt-3`}>
        If Composer was opened with{" "}
        <span className={INLINE_CODE}>?title=…&amp;artist=…&amp;duration=…&amp;videoId=…</span> query params (for
        example from the Better Lyrics extension), the values stick around and pre-fill the next time you open the
        modal. Clear them with "Reset fields" in the Search section.
      </p>
    </div>
  </div>
);

// -- Exports ------------------------------------------------------------------

export { ImportSection };
