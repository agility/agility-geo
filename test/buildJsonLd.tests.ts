import { buildJsonLd, toLanguageTag, validateJsonLd } from "../src";
import type { GeoContentItem, JsonLdNode } from "../src";
import workedExample from "./fixtures/worked-example-4.6.json";
import { URL_, basePage, byId, byType, sitemap } from "./helpers";

describe("buildJsonLd: the WebPage node", () => {
  it("builds a WebPage from a page with no geo", () => {
    const doc = buildJsonLd({ page: basePage(), url: URL_ });
    expect(doc).toEqual({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": `${URL_}#webpage`,
          url: URL_,
          name: "CMS",
          description: "The meta description.",
        },
      ],
    });
  });

  it("takes @type from geo.schemaType, name from seo.title and description from geo.summary", () => {
    const page = basePage({
      seo: { metaDescription: "The meta description.", title: "The SEO title" },
      geo: { schemaType: "AboutPage", summary: "The answer-first summary." },
    });
    const [webPage] = buildJsonLd({ page, url: URL_, locale: "en-us" })["@graph"];
    expect(webPage).toMatchObject({
      "@type": "AboutPage",
      name: "The SEO title",
      description: "The answer-first summary.",
      inLanguage: "en-US",
    });
  });

  it("strips a fragment from the URL before building @id", () => {
    const [webPage] = buildJsonLd({ page: basePage(), url: `${URL_}#pricing` })["@graph"];
    expect(webPage["@id"]).toBe(`${URL_}#webpage`);
    expect(webPage.url).toBe(URL_);
  });

  it.each([
    ["missing", undefined],
    ["null", null],
    ["an empty object", {}],
    ["an empty string", ""],
    ["whitespace", "   "],
    ["the literal string null", "null"],
    ["invalid JSON", "{not json"],
  ])("treats geo that is %s as no GEO data", (_label, geo) => {
    const doc = buildJsonLd({ page: basePage({ geo: geo as any }), url: URL_ });
    expect(doc["@graph"]).toHaveLength(1);
    expect(doc["@graph"][0]["@type"]).toBe("WebPage");
    expect(doc["@graph"][0].description).toBe("The meta description.");
  });

  it("reads geo delivered as a JSON string", () => {
    const geo = JSON.stringify({ schemaType: "ContactPage", summary: "Get in touch." });
    const [webPage] = buildJsonLd({ page: basePage({ geo }), url: URL_ })["@graph"];
    expect(webPage).toMatchObject({ "@type": "ContactPage", description: "Get in touch." });
  });

  it("leaves out name and description when the page has neither", () => {
    const page = { seo: null, geo: { summary: "  " } };
    const [webPage] = buildJsonLd({ page, url: URL_ })["@graph"];
    expect(webPage).toEqual({ "@type": "WebPage", "@id": `${URL_}#webpage`, url: URL_ });
  });

  it("ignores unknown geo keys and an invalid schemaType", () => {
    const page = basePage({ geo: { schemaType: "not a type!", somethingNew: { a: 1 } } });
    const [webPage] = buildJsonLd({ page, url: URL_ })["@graph"];
    expect(webPage["@type"]).toBe("WebPage");
  });

  it("requires page and url", () => {
    expect(() => buildJsonLd({ page: undefined as any, url: URL_ })).toThrow(TypeError);
    expect(() => buildJsonLd({ page: basePage(), url: "" })).toThrow(TypeError);
  });
});

describe("buildJsonLd: BreadcrumbList", () => {
  it("builds the breadcrumb from the sitemap path and links it from the WebPage", () => {
    const graph = buildJsonLd({ page: basePage(), url: URL_, sitemap })["@graph"];
    const [webPage] = graph;
    const [breadcrumb] = byType(graph, "BreadcrumbList");
    expect(webPage.breadcrumb).toEqual({ "@id": `${URL_}#breadcrumb` });
    expect(breadcrumb).toEqual({
      "@type": "BreadcrumbList",
      "@id": `${URL_}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Products", item: "https://www.example.com/products" },
        { "@type": "ListItem", position: 2, name: "CMS", item: URL_ },
      ],
    });
  });

  it("skips folders and uses path/baseUrl when the public URL has a prefix", () => {
    const url = "https://www.example.com/fr/resources/blog/hello-world";
    const graph = buildJsonLd({
      page: basePage({ title: "Hello World", seo: null }),
      url,
      sitemap,
      path: "/resources/blog/hello-world",
      baseUrl: "https://www.example.com/fr",
    })["@graph"];
    const [breadcrumb] = byType(graph, "BreadcrumbList");
    // "/resources" is a folder, so it isn't a step.
    expect(breadcrumb.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Blog", item: "https://www.example.com/fr/resources/blog" },
      { "@type": "ListItem", position: 2, name: "Hello World", item: url },
    ]);
  });

  it("emits no breadcrumb for a top-level page", () => {
    const graph = buildJsonLd({ page: basePage(), url: "https://www.example.com/products", sitemap })["@graph"];
    expect(byType(graph, "BreadcrumbList")).toHaveLength(0);
    expect(graph[0].breadcrumb).toBeUndefined();
  });
});

describe("buildJsonLd: merging structuredData by @id", () => {
  it("merges a node with the same @id: later properties replace earlier ones, arrays replaced", () => {
    const page = basePage({
      geo: {
        structuredData: {
          "@context": "https://schema.org",
          "@graph": [
            { "@id": `${URL_}#webpage`, name: "Editor's name", keywords: ["a"] },
            { "@id": "https://www.example.com/#org", "@type": "Organization", sameAs: ["https://one.example"] },
            { "@id": "https://www.example.com/#org", sameAs: ["https://two.example"], url: "https://www.example.com" },
          ],
        },
      },
    });
    const graph = buildJsonLd({ page, url: URL_ })["@graph"];

    const [webPage] = byId(graph, `${URL_}#webpage`);
    expect(webPage).toMatchObject({ "@type": "WebPage", name: "Editor's name", keywords: ["a"] });

    const orgs = byId(graph, "https://www.example.com/#org");
    expect(orgs).toHaveLength(1);
    expect(orgs[0]).toEqual({
      "@id": "https://www.example.com/#org",
      "@type": "Organization",
      sameAs: ["https://two.example"],
      url: "https://www.example.com",
    });
  });

  it("appends nodes without @id or with a new @id, and drops schema.org @context", () => {
    const page = basePage({
      geo: {
        structuredData: [
          { "@context": "https://schema.org", "@type": "Thing", name: "No id" },
          { "@context": "http://schema.org/", "@type": "Thing", "@id": "#new", name: "New id" },
          "not an object" as any,
        ],
      },
    });
    const graph = buildJsonLd({ page, url: URL_ })["@graph"];
    expect(graph).toHaveLength(3);
    expect(graph[1]).toEqual({ "@type": "Thing", name: "No id" });
    expect(graph[2]).toEqual({ "@type": "Thing", "@id": "#new", name: "New id" });
  });

  it("can replace the generated @type of the WebPage", () => {
    const page = basePage({ geo: { structuredData: { "@id": `${URL_}#webpage`, "@type": ["WebPage", "ItemPage"] } } });
    const [webPage] = buildJsonLd({ page, url: URL_ })["@graph"];
    expect(webPage["@type"]).toEqual(["WebPage", "ItemPage"]);
  });

  it("parses structuredData delivered as a JSON string, and ignores it when invalid", () => {
    const ok = basePage({ geo: { structuredData: '{"@type":"Thing","name":"x"}' } });
    expect(buildJsonLd({ page: ok, url: URL_ })["@graph"]).toHaveLength(2);
    const bad = basePage({ geo: { structuredData: "{oops" } });
    expect(buildJsonLd({ page: bad, url: URL_ })["@graph"]).toHaveLength(1);
  });

  it("doesn't change the page passed in", () => {
    const structuredData = { "@id": `${URL_}#webpage`, name: "x", nested: { a: [1] } };
    const page = basePage({ geo: { structuredData } });
    const snapshot = JSON.stringify(page);
    const doc = buildJsonLd({ page, url: URL_ });
    (doc["@graph"][0].nested as any).a.push(2);
    expect(JSON.stringify(page)).toBe(snapshot);
  });
});

describe("buildJsonLd: dynamic pages (Phase 1 rule)", () => {
  const dynamicPage = basePage({
    pageID: 21,
    title: "Blog post",
    path: "/resources/blog/blog-post-details",
    pageType: "dynamic",
    seo: {
      metaDescription: "The template's description.",
      title: "Template SEO title",
      robots: { index: false, follow: true },
    },
    geo: {
      schemaType: "ItemPage",
      summary: "The dynamic page's own summary.",
      structuredData: { "@type": "Thing", "@id": "#template-only", name: "Template JSON-LD" },
      ai: { llmsInclude: "exclude", crawl: "block" },
    },
  });
  const item: GeoContentItem = {
    contentID: 99,
    seo: { metaDescription: "The item's description." },
    fields: { title: "Hello World" },
  };
  const url = "https://www.example.com/resources/blog/hello-world";

  it("applies only schemaType from the page; not its summary or structuredData", () => {
    const graph = buildJsonLd({ page: dynamicPage, item, url, sitemap })["@graph"];
    const [webPage] = graph;
    expect(webPage["@type"]).toBe("ItemPage");
    expect(webPage.description).toBe("The item's description.");
    expect(webPage.name).toBe("Hello World");
    expect(byId(graph, "#template-only")).toHaveLength(0);
  });

  it("passes robots and ai.* down to the item, in the transform context", () => {
    let seen: any;
    buildJsonLd({ page: dynamicPage, item, url, transform: (_graph, ctx) => void (seen = ctx.geo) });
    expect(seen).toEqual({
      schemaType: "ItemPage",
      description: "The item's description.",
      robots: { index: false, follow: true },
      ai: { llmsInclude: "exclude", crawl: "block" },
    });
  });

  it("has no description when the item has no meta description (never the page's summary)", () => {
    const [webPage] = buildJsonLd({ page: dynamicPage, item: { contentID: 1 }, url })["@graph"];
    expect(webPage.description).toBeUndefined();
    expect(webPage.name).toBe("Blog post");
  });

  it("builds the item's breadcrumb from the sitemap", () => {
    const graph = buildJsonLd({ page: dynamicPage, item, url, sitemap })["@graph"];
    const [breadcrumb] = byType(graph, "BreadcrumbList");
    expect((breadcrumb.itemListElement as JsonLdNode[]).map((step) => step.name)).toEqual(["Blog", "Hello World"]);
  });
});

describe("buildJsonLd: transform", () => {
  it("runs last, and can return a new graph", () => {
    const page = basePage({ geo: { structuredData: { "@type": "Thing", name: "from editor" } } });
    const doc = buildJsonLd({
      page,
      url: URL_,
      locale: "fr-ca",
      transform: (graph, ctx) => {
        expect(graph).toHaveLength(2);
        expect(ctx.url).toBe(URL_);
        expect(ctx.locale).toBe("fr-ca");
        return [...graph.filter((node) => node["@type"] !== "Thing"), { "@type": "Event", name: "Added in code" }];
      },
    });
    expect(doc["@graph"].map((node) => node["@type"])).toEqual(["WebPage", "Event"]);
  });

  it("can change the graph in place", () => {
    const doc = buildJsonLd({ page: basePage(), url: URL_, transform: (graph) => void (graph[0].name = "Changed") });
    expect(doc["@graph"][0].name).toBe("Changed");
  });
});

describe("buildJsonLd: the §4.6 worked example", () => {
  it("turns three pasted blocks into one @graph with the WebPage", () => {
    const page = basePage({ geo: { structuredData: workedExample as any } });
    const doc = buildJsonLd({ page, url: URL_, locale: "en-us" });
    expect(doc["@graph"].map((node) => node["@type"])).toEqual([
      "WebPage",
      "Organization",
      "FAQPage",
      "SoftwareApplication",
    ]);
    expect(doc["@graph"].some((node) => "@context" in node)).toBe(false);

    const result = validateJsonLd(doc);
    expect(result.valid).toBe(true);
    expect(result.warnings.map((w) => w.code).sort()).toEqual(["faq-page", "software-application-rich-result"]);
  });
});

describe("toLanguageTag", () => {
  it.each([
    ["en-us", "en-US"],
    ["FR-ca", "fr-CA"],
    ["zh-hans-cn", "zh-Hans-CN"],
    ["de", "de"],
    ["pt_br", "pt-BR"],
  ])("%s → %s", (input, output) => expect(toLanguageTag(input)).toBe(output));
});
