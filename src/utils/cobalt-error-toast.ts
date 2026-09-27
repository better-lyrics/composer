import type { SettingHint } from "@/stores/settings-catalog";
import { CobaltApiError } from "@/utils/cobalt-api";

// -- Toast Message -------------------------------------------------------------

interface ToastErrorContext {
  isDefault: boolean;
  instanceLabel: string;
}

interface ToastMessage {
  message: string;
  hint?: SettingHint;
}

const SWITCH_INSTANCE_HINT: SettingHint = { text: "Try a different cobalt instance in", setting: "cobaltInstances" };
const ADD_INSTANCE_HINT: SettingHint = {
  text: "Add a working instance from cobalt.directory in",
  setting: "cobaltInstances",
};

function formatCobaltErrorForToast(err: unknown, ctx: ToastErrorContext): ToastMessage {
  if (!(err instanceof CobaltApiError)) return { message: "Couldn't load YouTube audio." };

  const { isDefault, instanceLabel } = ctx;
  const switchHint = isDefault ? undefined : SWITCH_INSTANCE_HINT;

  switch (err.code) {
    case "empty_audio":
      return isDefault
        ? { message: "Couldn't extract audio for this video. Try again in a bit." }
        : { message: `${instanceLabel} returned an empty file for this video.`, hint: switchHint };

    case "bad_response":
      return { message: `${instanceLabel} sent a malformed response.`, hint: switchHint };

    case "cobalt_failed":
      return { message: `${instanceLabel} couldn't fetch the audio for this video.`, hint: switchHint };

    case "bot_detection":
      return isDefault
        ? { message: "YouTube is blocking Composer's default Cobalt instance.", hint: ADD_INSTANCE_HINT }
        : { message: `YouTube is blocking ${instanceLabel} as a bot.`, hint: switchHint };

    case "geo_blocked":
      return isDefault
        ? { message: "This video isn't available in this region." }
        : { message: `${instanceLabel} can't access this video in its region.`, hint: switchHint };

    case "rate_limited":
      return isDefault
        ? { message: "Too many requests. Wait a minute and try again." }
        : { message: `${instanceLabel} is rate-limiting you. Wait a minute or pick a different instance.` };

    case "too_long":
      return isDefault
        ? { message: "This video is too long to import." }
        : { message: `${instanceLabel} won't process videos this long.`, hint: switchHint };

    case "auth_required":
      return { message: `${instanceLabel} requires authentication that Composer doesn't support.`, hint: switchHint };

    case "invalid_origin":
      return { message: `${instanceLabel} doesn't allow requests from this site.`, hint: switchHint };

    case "video_unavailable":
      return { message: "YouTube marks this video as private, removed, or age-restricted." };

    case "picker_unsupported":
      return { message: "This URL returns multiple items, which Composer can't import." };

    case "invalid_video_id":
      return { message: "That doesn't look like a valid YouTube video." };

    case "network_error":
      return { message: "Network error. Check your connection and try again." };

    case "turnstile_failed":
      return { message: "Verification failed. Refresh the page and try again." };

    case "turnstile_missing":
      return { message: "Verification didn't complete. Refresh the page." };

    case "jwt_expired":
    case "jwt_invalid":
      return { message: "Your session expired. Refresh the page." };

    case "ip_mismatch":
      return { message: "Your network changed. Refresh the page to continue." };

    default:
      return { message: err.message };
  }
}

// -- Exports -------------------------------------------------------------------

export { formatCobaltErrorForToast };
