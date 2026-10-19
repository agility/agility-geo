import { buildJsonLd, buildSiteNodes, validateJsonLd } from "../src";
import type { GeoSiteSettings } from "../src";
import workedExample from "./fixtures/worked-example-4.6.json";
import { URL_, basePage, byId, byType } from "./helpers";

const ORG_ID = "https://www.example.com/#organization";
const SITE_ID = "https://www.example.com/#website";

const settings: GeoSiteSettings = {
  organization: {
    name: "Example Software Inc.",
    url: "https://www.example.com/",
    logo: "https://cdn.example.com/logo.svg",
    sameAs: ["https://www.linkedin.com/company/example", " ", "https://github.com/example"],
    email: "hello@example.com",
    properties: { foundingDate: "2002", "@id": "https://elsewhere.example/#org" },
  },
  website: { name: "Example", searchUrl: "https://www.example.com/search?q={query}" },
};

describe("buildJsonLd: site settings", () => {
  it("adds Organization and WebSite, and connects the WebPage to them", () => {
    const graph = buildJsonLd({ page: basePage(), url: URL_, siteSettings: settings })["@graph"];

    expect(graph.map((node) => node["@type"])).toEqual(["Organization", "WebSite", "WebPage"]);
    expect(byId(graph, ORG_ID)[0]).toEqual({
      "@type": "Organization",
      "@id": ORG_ID,
      name: "Example Software Inc.",
      url: "https://www.example.com/",
      logo: "https://cdn.example.com/logo.svg",
      sameAs: ["https://www.linkedin.com/company/example", "https://github.com/example"],
      email: "hello@example.com",
      foundingDate: "2002", // extra-properties JSON; its @id is ignored so references stay valid
    });
    expect(byId(graph, SITE_ID)[0]).toMatchObject({
      "@type": "WebSite",
      url: "https://www.example.com/",
      name: "Example",
      publisher: { "@id": ORG_ID },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: "https://www.example.com/search?q={search_term_string}" },
        "query-input": "required name=search_term_string",
      },
    });
    expect(byType(graph, "WebPage")[0]).toMatchObject({ isPartOf: { "@id": SITE_ID }, publisher: { "@id": ORG_ID } });
    expect(validateJsonLd({ "@graph": graph }).warnings).toEqual([]);
  });

  it('with organization: "home-only", emits the Organization on the home page only, and references it elsewhere', () => {
    const inner = buildJsonLd({ page: basePage(), url: URL_, siteSettings: settings, organization: "home-only" })["@graph"];
    expect(byType(inner, "Organization")).toHaveLength(0);
    expect(byType(inner, "WebSite")[0].publisher).toEqual({ "@id": ORG_ID });
    expect(byType(inner, "WebPage")[0].publisher).toEqual({ "@id": ORG_ID });

    const home = buildJsonLd({
      page: basePage({ path: "/home" }),
      url: "https://www.example.com/",
      siteSettings: settings,
      organization: "home-only",
    })["@graph"];
    expect(byType(home, "Organization")).toHaveLength(1);

    const flagged = buildJsonLd({ page: basePage(), url: URL_, siteSettings: settings, organization: "home-only", isHome: true });
    expect(byType(flagged["@graph"], "Organization")).toHaveLength(1);
  });

  it("uses the site's default page type when the page sets none", () => {
    const withDefault = { ...settings, defaultSchemaType: "ItemPage" };
    expect(byType(buildJsonLd({ page: basePage(), url: URL_, siteSettings: withDefault })["@graph"], "ItemPage")).toHaveLength(1);

    const page = basePage({ geo: { schemaType: "AboutPage" } });
    expect(byType(buildJsonLd({ page, url: URL_, siteSettings: withDefault })["@graph"], "AboutPage")).toHaveLength(1);
  });

  it("lets the page's structuredData amend the Organization by @id", () => {
    const page = basePage({ geo: { structuredData: { "@id": ORG_ID, "@type": "Organization", legalName: "Example Software Inc." } } });
    const graph = buildJsonLd({ page, url: URL_, siteSettings: settings })["@graph"];
    expect(byType(graph, "Organization")).toHaveLength(1);
    expect(byId(graph, ORG_ID)[0]).toMatchObject({ name: "Example Software Inc.", legalName: "Example Software Inc." });
  });

  it("warns when a pasted Organization duplicates the one from site settings (plan §4.6)", () => {
    // The worked example's Organization has a different @id from the settings one, so it's added,
    // not merged, and the validator flags the duplicate.
    const page = basePage({ geo: { structuredData: workedExample } });
    const graph = buildJsonLd({ page, url: URL_, siteSettings: settings })["@graph"];
    expect(byType(graph, "Organization")).toHaveLength(2);
    const codes = validateJsonLd({ "@graph": graph }).warnings.map((w) => w.code);
    expect(codes).toContain("duplicate-entity");
  });

  it("accepts the extra-properties JSON as a string, and ignores it when it doesn't parse", () => {
    const fromString = buildSiteNodes(
      { organization: { name: "Example", properties: '{ "foundingDate": "2002" }' } },
      { origin: "https://www.example.com", includeOrganization: true },
    );
    expect(fromString.nodes[0]).toMatchObject({ foundingDate: "2002", "@id": ORG_ID });

    const broken = buildSiteNodes(
      { organization: { name: "Example", properties: "{ not json" } },
      { origin: "https://www.example.com", includeOrganization: true },
    );
    expect(broken.nodes[0]).toEqual({ "@type": "Organization", "@id": ORG_ID, name: "Example" });
  });

  it("emits nothing for empty or missing settings", () => {
    for (const empty of [undefined, null, {}, { organization: {}, website: { name: " " } }] as GeoSiteSettings[]) {
      const graph = buildJsonLd({ page: basePage(), url: URL_, siteSettings: empty })["@graph"];
      expect(graph.map((node) => node["@type"])).toEqual(["WebPage"]);
      expect(graph[0].isPartOf).toBeUndefined();
    }
  });

  it("emits a WebSite without an Organization when only the website is set", () => {
    const graph = buildJsonLd({ page: basePage(), url: URL_, siteSettings: { website: { name: "Example" } } })["@graph"];
    expect(graph.map((node) => node["@type"])).toEqual(["WebSite", "WebPage"]);
    expect(graph[0]).toEqual({ "@type": "WebSite", "@id": SITE_ID, url: "https://www.example.com", name: "Example" });
  });

  it("passes siteSettings to transform", () => {
    let seen: unknown;
    buildJsonLd({ page: basePage(), url: URL_, siteSettings: settings, transform: (_graph, ctx) => void (seen = ctx.siteSettings) });
    expect(seen).toBe(settings);
  });
});
