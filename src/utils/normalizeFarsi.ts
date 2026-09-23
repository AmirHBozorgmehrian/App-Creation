/**
 * Iranian keyboards type Persian "ی" (U+06CC, no dots) and Persian "ک"
 * (U+06A9), but a lot of text on the web - including some TSETMC company
 * names - uses the Arabic look-alikes "ي"/"ى" (U+064A / U+0649) and "ك"
 * (U+0643), which render almost identically but are different characters.
 * Without this, searching "ملی" might not match a name stored as "ملي".
 *
 * This collapses both variants to one canonical form before comparing, and
 * also strips Arabic diacritics and zero-width non-joiners so spacing
 * differences don't block a match either.
 */
export function normalizeFarsi(input: string): string {
  return input
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/\u200c/g, " ")
    .trim()
    .toLowerCase();
}
