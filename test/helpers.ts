import type { GeoPage, GeoSitemapFlat, JsonLdNode } from "../src";

export const URL_ = "https://www.example.com/products/cms";

export const basePage = (overrides: Partial<GeoPage> = {}): GeoPage => ({
  pageID: 12,
  name: "cms",
  path: "/products/cms",
  title: "CMS",
  menuText: "CMS",
  pageType: "static",
  seo: { metaDescription: "The meta description.", metaKeywords: "", metaHTML: "" },
  ...overrides,
});

export const sitemap: GeoSitemapFlat = {
  "/home": { pageID: 1, title: "Home", name: "home", path: "/home", menuText: "Home", pageType: "static" },
  "/products": { pageID: 10, title: "Products", name: "products", path: "/products", menuText: "Products", pageType: "static" },
  "/products/cms": { pageID: 12, title: "CMS", name: "cms", path: "/products/cms", menuText: "The CMS", pageType: "static" },
  "/resources": { pageID: 20, title: "Resources", name: "resources", path: "/resources", menuText: "Resources", pageType: "folder" },
  "/resources/blog": { pageID: 21, title: "Blog", name: "blog", path: "/resources/blog", menuText: "Blog", pageType: "static" },
  "/resources/blog/hello-world": {
    pageID: 22,
    title: "Hello World",
    name: "hello-world",
    path: "/resources/blog/hello-world",
    menuText: "Hello World",
    pageType: "dynamic_node",
  },
};

export const byId = (graph: JsonLdNode[], id: string) => graph.filter((node) => node["@id"] === id);
export const byType = (graph: JsonLdNode[], type: string) => graph.filter((node) => node["@type"] === type);
