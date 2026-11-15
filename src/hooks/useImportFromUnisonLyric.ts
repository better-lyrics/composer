import { useUnisonLyric } from "@/hooks/unison/useUnisonLyric";
import { openUnisonLyricFromLink } from "@/lib/unison/open-unison-lyric";
import { getPersistenceSettled, markLinkProjectSettled } from "@/lib/persistence-settled";
import { UNISON_LYRIC_PARAM, readBootUnisonLyric } from "@/utils/incoming-link";
import { showUnisonLyricLinkFailedToast } from "@/utils/unison-toast";
import { stripQueryParams } from "@/utils/url-params";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Boot]";

// -- Hook ---------------------------------------------------------------------

// A valid link settles the link project, so the ?v= hook leaves that signal to this one.
function useImportFromUnisonLyric(): void {
  // Read at render: the effect below strips the param.
  const [link] = useState(readBootUnisonLyric);
  const lyricQuery = useUnisonLyric(link.id);
  const navigate = useNavigate();
  const appliedRef = useRef(false);

  useEffect(() => {
    if (!link.present) return;
    stripQueryParams([UNISON_LYRIC_PARAM]);
    if (link.id === null) return;
    return () => {
      if (!appliedRef.current) markLinkProjectSettled("failed");
    };
  }, [link]);

  useEffect(() => {
    if (link.id === null || lyricQuery.status === "pending" || appliedRef.current) return;
    appliedRef.current = true;
    if (lyricQuery.status === "error") {
      console.warn(LOG_PREFIX, "could not fetch the linked Unison lyric", lyricQuery.error);
      showUnisonLyricLinkFailedToast();
      markLinkProjectSettled("failed");
      return;
    }
    const lyric = lyricQuery.data;
    getPersistenceSettled()
      .then(() => openUnisonLyricFromLink(lyric, navigate))
      .then((opened) => markLinkProjectSettled(opened ? "created" : "failed"))
      .catch((error: unknown) => {
        console.error(LOG_PREFIX, "could not open the linked Unison lyric", error);
        showUnisonLyricLinkFailedToast();
        markLinkProjectSettled("failed");
      });
  }, [link.id, lyricQuery.status, lyricQuery.data, lyricQuery.error, navigate]);
}

// -- Exports ------------------------------------------------------------------

export { useImportFromUnisonLyric };
