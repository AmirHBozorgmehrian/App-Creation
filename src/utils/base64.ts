// Minimal UTF-8-safe base64 codec. GitHub's Contents API requires file
// content as base64, and React Native doesn't reliably ship btoa/atob on
// every device, so we implement it directly instead of depending on one.
const CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function utf8ToBase64(input: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    let code = input.codePointAt(i)!;
    if (code > 0xffff) i++; // consumed a surrogate pair
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }

  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += CHARS[b0 >> 2];
    out += CHARS[((b0 & 3) << 4) | (b1 === undefined ? 0 : b1 >> 4)];
    out += b1 === undefined ? "=" : CHARS[((b1 & 15) << 2) | (b2 === undefined ? 0 : b2 >> 6)];
    out += b2 === undefined ? "=" : CHARS[b2 & 63];
  }
  return out;
}

export function base64ToUtf8(input: string): string {
  const clean = input.replace(/[\r\n]/g, "");
  const lookup = new Map(CHARS.split("").map((c, i) => [c, i]));
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = lookup.get(clean[i]) ?? 0;
    const c1 = lookup.get(clean[i + 1]) ?? 0;
    const c2 = clean[i + 2] === "=" || clean[i + 2] === undefined ? null : lookup.get(clean[i + 2]) ?? 0;
    const c3 = clean[i + 3] === "=" || clean[i + 3] === undefined ? null : lookup.get(clean[i + 3]) ?? 0;
    bytes.push((c0 << 2) | (c1 >> 4));
    if (c2 !== null) bytes.push(((c1 & 15) << 4) | (c2 >> 2));
    if (c3 !== null) bytes.push(((c2! & 3) << 6) | c3);
  }

  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++];
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
    } else if (b0 >> 5 === 0x06) {
      const b1 = bytes[i++];
      out += String.fromCharCode(((b0 & 0x1f) << 6) | (b1 & 0x3f));
    } else if (b0 >> 4 === 0x0e) {
      const b1 = bytes[i++];
      const b2 = bytes[i++];
      out += String.fromCharCode(((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f));
    } else {
      const b1 = bytes[i++];
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      const code =
        ((b0 & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f);
      out += String.fromCodePoint(code);
    }
  }
  return out;
}
