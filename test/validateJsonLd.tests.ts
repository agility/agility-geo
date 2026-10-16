import { validateJsonLd } from "../src";
import workedExample from "./fixtures/worked-example-4.6.json";

const codes = (json: unknown) => validateJsonLd(json).warnings.map((w) => w.code);

describe("validateJsonLd: the Content Manager's structured-data contract", () => {
  // The same cases as the Manager App's interim validateStructuredData adapter (PROD-2724), so
  // swapping it for validateJsonLd changes no editor-visible behaviour for these inputs.
  it.each([undefined, null, "", "   \n"])("treats %j as nothing to store", (text) => {
    expect(validateJsonLd(text)).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it("returns the parsed object", () => {
    const result = validateJsonLd('{ "@context": "https://schema.org", "@type": "WebPage" }');
    expect(result.valid).toBe(true);
    expect(result.value).toEqual({ "@context": "https://schema.org", "@type": "WebPage" });
  });

  it("returns the parsed array", () => {
    const result = validateJsonLd('[{ "@type": "Organization" }, { "@type": "WebSite" }]');
    expect(result.valid).toBe(true);
    expect(result.value).toHaveLength(2);
  });

  it("rejects text that doesn't parse, with the parser's message", () => {
    const result = validateJsonLd('{ "@type": "FAQPage", }');
    expect(result).toMatchObject({ valid: false, reason: "not-json", detail: expect.any(String) });
  });

  it.each(['"just a string"', "42", "true", "null"])("rejects %s, which parses but isn't an object or array", (text) => {
    expect(validateJsonLd(text)).toMatchObject({ valid: false, reason: "not-object" });
    expect(validateJsonLd(text).value).toBeUndefined();
  });

  it("returns the value but no reason when the error is inside the value", () => {
    const result = validateJsonLd([{ "@type": "Thing" }, 3]);
    expect(result.valid).toBe(false);
    expect(result.reason).toBeUndefined();
    expect(result.value).toHaveLength(2);
  });
});

describe("validateJsonLd: errors", () => {
  it("rejects a string that doesn't parse", () => {
    const result = validateJsonLd('{"@type": "Thing",');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatchObject({ code: "not-json", path: "$" });
    expect(result.reason).toBe("not-json");
    expect(result.detail).toEqual(expect.any(String));
    expect(result.value).toBeUndefined();
  });

  it.each([["the string null", "null"], ["a number", 42], ["a string literal", '"text"'], ["a boolean", true]])(
    "rejects %s",
    (_label, value) => {
      const result = validateJsonLd(value);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe("not-object");
    },
  );

  it("rejects non-object blocks and @graph entries, with their path", () => {
    expect(validateJsonLd([{ "@type": "Thing" }, 3]).errors[0]).toMatchObject({ code: "not-object", path: "$[1]" });
    expect(validateJsonLd({ "@graph": [{ "@type": "Thing" }, "x"] }).errors[0]).toMatchObject({
      code: "not-object",
      path: '$["@graph"][1]',
    });
  });

  it("accepts an object, a JSON string and an array of blocks", () => {
    expect(validateJsonLd({ "@context": "https://schema.org", "@type": "WebPage" })).toEqual({
      valid: true,
      value: { "@context": "https://schema.org", "@type": "WebPage" },
      errors: [],
      warnings: [],
    });
    expect(validateJsonLd('{"@type":"Organization","name":"x"}').valid).toBe(true);
    expect(validateJsonLd([{ "@type": "Organization" }, { "@type": "WebSite" }]).valid).toBe(true);
  });
});

describe("validateJsonLd: unknown types", () => {
  it("warns about a misspelt or unlisted type, anywhere in the tree", () => {
    const result = validateJsonLd({ "@type": "Organisation", founder: { "@type": "Persn", name: "x" } });
    expect(result.valid).toBe(true);
    expect(result.warnings.map((w) => [w.code, w.type, w.path])).toEqual([
      ["unknown-type", "Organisation", "$"],
      ["unknown-type", "Persn", '$["founder"]'],
    ]);
  });

  it("accepts prefixed schema.org types and ignores other vocabularies", () => {
    expect(codes({ "@type": ["schema:Organization", "https://schema.org/Corporation", "ex:Custom"] })).toEqual([]);
  });
});

describe("validateJsonLd: rich-result requirements", () => {
  it("warns when a SoftwareApplication has no price or no rating/review", () => {
    const noPrice = { "@type": "SoftwareApplication", name: "App", offers: { "@type": "Offer" }, review: { "@type": "Review" } };
    const noRating = { "@type": "WebApplication", name: "App", offers: { "@type": "Offer", price: 0 } };
    const complete = {
      "@type": "SoftwareApplication",
      offers: [{ "@type": "Offer", priceSpecification: { "@type": "PriceSpecification", price: "10" } }],
      aggregateRating: { "@type": "AggregateRating", ratingValue: 4.5, ratingCount: 10 },
    };
    expect(validateJsonLd(noPrice).warnings[0].message).toContain("offers.price");
    expect(validateJsonLd(noRating).warnings[0]).toMatchObject({
      code: "software-application-rich-result",
      type: "WebApplication",
    });
    expect(validateJsonLd(noRating).warnings[0].message).toContain("aggregateRating or review");
    expect(codes(complete)).toEqual([]);
  });

  it("warns when a Product has none of offers, review or aggregateRating", () => {
    expect(codes({ "@type": "Product", name: "Thing" })).toEqual(["product-rich-result"]);
    expect(codes({ "@type": "Product", name: "Thing", review: { "@type": "Review" } })).toEqual([]);
  });

  it("only checks rich-result requirements on top-level nodes", () => {
    const offer = { "@type": "Offer", price: 5, itemOffered: { "@type": "Product", name: "x" } };
    expect(codes(offer)).toEqual([]);
  });

  it("warns about FAQPage and HowTo", () => {
    expect(codes({ "@type": "FAQPage", mainEntity: [] })).toEqual(["faq-page"]);
    expect(validateJsonLd({ "@type": "FAQPage" }).warnings[0].message).toContain("visible on the page");
    expect(codes({ "@type": "HowTo", step: [] })).toEqual(["how-to"]);
  });
});

describe("validateJsonLd: duplicate types", () => {
  it("warns when the same type is in several disconnected blocks", () => {
    const result = validateJsonLd([
      { "@context": "https://schema.org", "@type": "Organization", name: "A" },
      { "@context": "https://schema.org", "@type": "Organization", name: "A again" },
    ]);
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: "duplicate-type", type: "Organization", path: "$[1]" }),
    ]);
  });

  it("doesn't warn when the nodes share an @id, or one references the other", () => {
    expect(
      codes([
        { "@type": "Organization", "@id": "#org", name: "A" },
        { "@type": "Organization", "@id": "#org", url: "https://a.example" },
      ]),
    ).toEqual([]);
    expect(
      codes({
        "@graph": [
          { "@type": "Person", "@id": "#a", name: "A" },
          { "@type": "Person", "@id": "#b", name: "B" },
          { "@type": "Article", "@id": "#article", author: [{ "@id": "#a" }, { "@id": "#b" }] },
        ],
      }),
    ).toEqual([]);
  });
});

describe("validateJsonLd: the §4.6 worked example", () => {
  it("is valid, with warnings for the FAQPage and the SoftwareApplication", () => {
    const result = validateJsonLd(JSON.stringify(workedExample));
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((w) => [w.code, w.path])).toEqual([
      ["faq-page", "$[1]"],
      ["software-application-rich-result", "$[2]"],
    ]);
    expect(result.warnings[1].message).toBe(
      "SoftwareApplication has no offers.price and no aggregateRating or review, so Google won't show a rich result for it.",
    );
  });
});

describe("validateJsonLd: duplicate-entity", () => {
  it("warns when two nodes of one type share a name or URL under different @ids", () => {
    const result = validateJsonLd({
      "@graph": [
        { "@type": "Organization", "@id": "https://example.com/#organization", name: "Example", url: "https://example.com/" },
        { "@type": "Organization", "@id": "https://example.com/#org", name: "example", url: "https://example.com" },
      ],
    });
    const dupes = result.warnings.filter((w) => w.code === "duplicate-entity");
    expect(dupes).toHaveLength(1);
    expect(dupes[0]).toMatchObject({ type: "Organization", path: '$["@graph"][1]' });
  });

  it("doesn't warn for the same @id split across blocks, different types, or page nodes", () => {
    const codes = validateJsonLd([
      { "@type": "Organization", "@id": "https://example.com/#organization", name: "Example" },
      { "@type": "Organization", "@id": "https://example.com/#organization", legalName: "Example Inc." },
      { "@type": "WebSite", "@id": "https://example.com/#website", name: "Example", url: "https://example.com/" },
      { "@type": "WebPage", "@id": "https://example.com/#webpage", name: "Example", url: "https://example.com/" },
      { "@type": "AboutPage", "@id": "https://example.com/about#webpage", url: "https://example.com/" },
    ]).warnings.map((w) => w.code);
    expect(codes).not.toContain("duplicate-entity");
  });
});
