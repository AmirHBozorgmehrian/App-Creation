import { FOLLOWINGS_PATH } from "../config";
import { readJsonFile, writeJsonFile } from "../api/githubApi";

interface FollowingsPayload {
  insCodes: string[];
}

/** Pulls the shared followings list from GitHub. Returns null on any
 * failure (offline, no token, file doesn't exist yet) so callers can just
 * fall back to whatever's stored locally. */
export async function pullFollowings(): Promise<Set<string> | null> {
  try {
    const payload = await readJsonFile<FollowingsPayload>(FOLLOWINGS_PATH);
    if (!payload) return null;
    return new Set(payload.insCodes);
  } catch {
    return null;
  }
}

/** Pushes the full followings set to GitHub so your other phone picks it
 * up next time it opens. Silently no-ops on failure (e.g. no token set
 * yet) - the change still applies locally either way. */
export async function pushFollowings(followings: Set<string>): Promise<boolean> {
  try {
    await writeJsonFile(
      FOLLOWINGS_PATH,
      { insCodes: Array.from(followings) },
      "Update followings"
    );
    return true;
  } catch {
    return false;
  }
}
