import { logout } from "@/lib/unison/endpoints";
import { clearUnisonSession } from "@/lib/unison/session";
import { showDisconnectedToast } from "@/utils/unison-toast";

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[UnisonAccount]";

// -- Functions -----------------------------------------------------------------

function signOutOfUnison(): void {
  // logout() reads the token before its first await, so clearing right after still signs this session out.
  logout().catch((error: unknown) => {
    console.warn(LOG_PREFIX, "Could not end the session on Unison, cleared it here only", error);
  });
  clearUnisonSession();
  showDisconnectedToast();
}

// -- Exports -------------------------------------------------------------------

export { signOutOfUnison };
