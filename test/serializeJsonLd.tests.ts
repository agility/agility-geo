import { buildJsonLd, jsonLdScriptTag, serializeJsonLd } from "../src";
import { URL_, basePage } from "./helpers";

describe("serializeJsonLd", () => {
  const hostile = "</script><script>alert('x')</script> & <!-- -->";

  it("escapes <, > and & so editor text can't close the script tag", () => {
    const page = basePage({ geo: { summary: hostile, structuredData: { "@type": "Thing", name: hostile } } });
    const text = serializeJsonLd(buildJsonLd({ page, url: URL_ }));
    expect(text).not.toMatch(/[<>&]/);
    expect(text).toContain("\\u003c/script\\u003e");
    expect(text).toContain("\\u0026");
  });

  it("round-trips to the same value", () => {
    const value = { name: hostile, nested: ["<a>", { b: "a & b" }], line: "x\u2028y\u2029z" };
    const text = serializeJsonLd(value);
    expect(text).not.toMatch(/[\u2028\u2029]/);
    expect(JSON.parse(text)).toEqual(value);
  });

  it("supports indentation, and serializes undefined as null", () => {
    expect(serializeJsonLd({ a: "<" }, 2)).toBe('{\n  "a": "\\u003c"\n}');
    expect(serializeJsonLd(undefined)).toBe("null");
  });

  it("builds a complete script tag whose body can't break out", () => {
    const tag = jsonLdScriptTag({ name: hostile });
    expect(tag.startsWith('<script type="application/ld+json">')).toBe(true);
    expect(tag.endsWith("</script>")).toBe(true);
    expect(tag.match(/<\/script>/g)).toHaveLength(1);
  });
});
