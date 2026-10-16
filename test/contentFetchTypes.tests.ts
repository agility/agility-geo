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

    // A page from an SDK version that already carries `geo`.
    const withGeo: Page & { geo?: GeoProperties } = { ...page, geo: { schemaType: "WebPage" } };

    expect(buildJsonLd({ page, item, sitemap, url: "https://www.example.com/" })["@graph"]).toHaveLength(1);
    expect(buildJsonLd({ page: withGeo, url: "https://www.example.com/" })["@graph"]).toHaveLength(1);
  });
});
