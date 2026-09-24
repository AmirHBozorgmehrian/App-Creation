import { GITHUB_OWNER, GITHUB_REPO } from "../config";
import { getGithubToken } from "../storage/githubToken";
import { utf8ToBase64, base64ToUtf8 } from "../utils/base64";

const API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents`;

/**
 * Reads a JSON file from the repo via GitHub's Contents API (works even
 * without a token for a public repo, just at a lower rate limit).
 * Returns null if the file doesn't exist yet.
 */
export async function readJsonFile<T>(path: string): Promise<T | null> {
  const token = await getGithubToken();
  const res = await fetch(`${API_BASE}/${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`);
  const json = await res.json();
  return JSON.parse(base64ToUtf8(json.content)) as T;
}

/**
 * Writes a JSON file to the repo. Requires a GitHub token with write access
 * to this repo (see Settings in the app). Overwrites whatever is there -
 * fine for our use case, since only you use this app.
 */
export async function writeJsonFile(
  path: string,
  data: unknown,
  message: string
): Promise<void> {
  const token = await getGithubToken();
  if (!token) throw new Error("No GitHub token configured");

  // Need the current file's sha to update it (GitHub requires this to
  // avoid accidentally clobbering someone else's concurrent edit).
  let sha: string | undefined;
  const existing = await fetch(`${API_BASE}/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (existing.ok) {
    const json = await existing.json();
    sha = json.sha;
  }

  const res = await fetch(`${API_BASE}/${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      content: utf8ToBase64(JSON.stringify(data, null, 2)),
      ...(sha ? { sha } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub write failed: ${res.status} ${body}`);
  }
}
