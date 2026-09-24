// Sends push notifications via ntfy.sh - a free, sign-up-free pub-sub
// notification service. No Google services, no service account, no
// per-device token bookkeeping: anyone subscribed to the topic (via the
// ntfy Android/iOS app) gets the notification.
//
// Uses ntfy's JSON publish endpoint (POST to the base URL with a JSON
// body) rather than the header-based one, since HTTP headers aren't
// reliably UTF-8 safe across every client/library - and stock names
// here are in Farsi.
const NTFY_SERVER = "https://ntfy.sh";

/** Publishes one notification to the given ntfy topic. */
export async function sendNtfyAlert(topic, { title, message, tags = [] }) {
  if (!topic) return;
  const res = await fetch(NTFY_SERVER, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, title, message, tags }),
  });
  if (!res.ok) {
    console.error(`ntfy send failed: ${res.status} ${await res.text()}`);
  }
}
