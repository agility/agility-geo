const ESCAPES: { [char: string]: string } = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

/**
 * Serialize JSON-LD for a `<script type="application/ld+json">` tag.
 *
 * `<`, `>` and `&` are written as `\u003c`, `\u003e` and `\u0026` (and U+2028/U+2029 as their
 * escapes), so editor-supplied text such as `</script>` can't close the tag and inject markup.
 * The output is still valid JSON that parses back to the same value.
 */
export function serializeJsonLd(json: unknown, space?: number): string {
  const text = JSON.stringify(json, null, space);
  if (text === undefined) return "null";
  return text.replace(/[<>&\u2028\u2029]/g, (char) => ESCAPES[char]);
}

/** The complete `<script type="application/ld+json">…</script>` tag, escaped with `serializeJsonLd`. */
export function jsonLdScriptTag(json: unknown): string {
  return `<script type="application/ld+json">${serializeJsonLd(json)}</script>`;
}
