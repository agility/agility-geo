// Compile-time check: objects from @agility/content-fetch can be passed straight in.
import type { ContentItem, Page } from "@agility/content-fetch";
import type { SitemapFlat } from "@agility/content-fetch/dist/types/SitemapFlat";
import { buildJsonLd } from "../src";
import type { GeoProperties } from "../src";

describe("@agility/content-fetch types", () => {
  it("accepts a Page, a ContentItem and a SitemapFlat", () => {
    const page = {
      pageID: 1,
      name: "home",
      path: "/home",
      title: "Home",
      menuText: "Home",
      pageType: "static",
      templateName: "Main",
      securePage: false,
      properties: { created: new Date(), modified: new Date(), state: 2, versionID: 1 },
      zones: {},
      visible: { menu: true, sitemap: true },
      seo: { metaDescription: "d", metaKeywords: "", metaHTML: "", menuVisible: true, sitemapVisible: true },
    } as Page;
    const item = { contentID: 1, properties: {} as any, fields: {} } as ContentItem;
    const sitemap = {} as SitemapFlat;

    // content-fetch 2.0.14+ types `geo` itself, as its own interface. Passing those objects must
    // compile; an index signature on GeoProperties broke this in 0.1.1.
    const withGeo: Page = { ...page, geo: { schemaType: "WebPage", summary: "s", ai: { crawl: "block" } } };
    const itemWithGeo: ContentItem = { ...item, geo: { summary: "item summary" } };
    const geoFromSdk: GeoProperties | undefined = withGeo.geo;

    expect(buildJsonLd({ page, item, sitemap, url: "https://www.example.com/" })["@graph"]).toHaveLength(1);
    expect(buildJsonLd({ page: withGeo, url: "https://www.example.com/" })["@graph"]).toHaveLength(1);
    expect(buildJsonLd({ page: withGeo, item: itemWithGeo, url: "https://www.example.com/" })["@graph"]).toHaveLength(1);
    expect(geoFromSdk?.summary).toBe("s");
  });
});
