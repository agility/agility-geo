import { mergeNodes, toNodes } from "./merge";
import { resolvePageGeo } from "./resolve";
import { buildSiteNodes } from "./siteSettings";
import type {
  BuildJsonLdOptions,
  GeoSitemapFlat,
  GeoSitemapItem,
  JsonLdDocument,
  JsonLdNode,
  TransformContext,
} from "./types";

const nonEmpty = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;

/** Agility locale codes are lower case (`en-us`); BCP 47 writes the region in capitals (`en-US`). */
export function toLanguageTag(locale: string): string {
  return locale
    .trim()
    .replace(/_/g, "-")
    .split("-")
    .filter(Boolean)
    .map((part, index) => {
      if (index === 0) return part.toLowerCase();
      if (part.length === 2) return part.toUpperCase();
      if (part.length === 4) return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      return part.toLowerCase();
    })
    .join("-");
}

const stripHash = (url: string) => {
  const hash = url.indexOf("#");
  return hash >= 0 ? url.slice(0, hash) : url;
};

/** Split an absolute URL into origin and pathname without depending on a global `URL`. */
const splitUrl = (url: string): { origin: string; pathname: string } => {
  const match = /^([a-z][a-z0-9+.-]*:\/\/[^/?#]*)([^?#]*)/i.exec(url);
  if (!match) return { origin: "", pathname: url.split(/[?#]/)[0] || "/" };
  return { origin: match[1], pathname: match[2] || "/" };
};

const normalizePath = (path: string): string => {
  const trimmed = path.trim().replace(/\/+$/, "");
  return (trimmed.startsWith("/") ? trimmed : "/" + trimmed).toLowerCase() || "/";
};

const lookup = (sitemap: GeoSitemapFlat): { [path: string]: GeoSitemapItem } => {
  const byPath: { [path: string]: GeoSitemapItem } = {};
  for (const key of Object.keys(sitemap)) {
    const entry = sitemap[key];
    if (!entry || typeof entry !== "object") continue;
    byPath[normalizePath(entry.path || key)] = entry;
  }
  return byPath;
};

/** Folders and links have no page of their own, so they aren't breadcrumb steps. */
const isBreadcrumbStep = (entry: GeoSitemapItem) => entry.pageType !== "folder" && entry.pageType !== "link";

const joinUrl = (base: string, path: string) => base.replace(/\/+$/, "") + (path.startsWith("/") ? path : "/" + path);

function buildBreadcrumb(
  sitemap: GeoSitemapFlat,
  path: string,
  baseUrl: string,
  pageUrl: string,
  pageName: string | undefined,
): JsonLdNode | undefined {
  const byPath = lookup(sitemap);
  const segments = normalizePath(path).split("/").filter(Boolean);
  const items: JsonLdNode[] = [];

  let current = "";
  segments.forEach((segment, index) => {
    current += "/" + segment;
    const isLast = index === segments.length - 1;
    const entry = byPath[current];
    if (isLast) {
      const name = pageName ?? nonEmpty(entry?.menuText) ?? nonEmpty(entry?.title) ?? segment;
      items.push({ "@type": "ListItem", position: items.length + 1, name, item: pageUrl });
    } else if (entry && isBreadcrumbStep(entry)) {
      const name = nonEmpty(entry.menuText) ?? nonEmpty(entry.title) ?? nonEmpty(entry.name) ?? segment;
      items.push({ "@type": "ListItem", position: items.length + 1, name, item: joinUrl(baseUrl, entry.path) });
    }
  });

  if (items.length < 2) return undefined;
  return { "@type": "BreadcrumbList", "@id": `${pageUrl}#breadcrumb`, itemListElement: items };
}

/**
 * Build one schema.org JSON-LD `@graph` for a page.
 *
 * The graph is assembled in this order, merging nodes by `@id` (a later property replaces an
 * earlier one, arrays included; a node with a new `@id` is added):
 * 1. Organization and WebSite from `siteSettings` (see `buildSiteNodes`).
 * 2. The WebPage node (`@type` from `geo.schemaType`, else the site's `defaultSchemaType`, else
 *    `WebPage`), and a BreadcrumbList when a sitemap is given.
 * 3. The page's `geo.structuredData`. Not applied when rendering an item on a dynamic page.
 * 4. `transform(graph, ctx)`.
 *
 * Serialize the result with `serializeJsonLd`, never with plain `JSON.stringify`.
 */
export function buildJsonLd(options: BuildJsonLdOptions): JsonLdDocument {
  const { page, item, siteSettings, sitemap, url, locale, transform } = options;
  if (!page || typeof page !== "object") throw new TypeError("buildJsonLd: `page` is required.");
  if (!nonEmpty(url)) throw new TypeError("buildJsonLd: `url` is required.");

  const pageUrl = stripHash(url.trim());
  const { origin, pathname } = splitUrl(pageUrl);
  const geo = resolvePageGeo({ page, item, defaultSchemaType: siteSettings?.defaultSchemaType });
  const inLanguage = nonEmpty(locale) ? toLanguageTag(locale!) : undefined;
  const sitemapPath = nonEmpty(options.path) ?? pathname;

  // An item on a dynamic page is named by its sitemap entry; the dynamic page's own SEO title
  // describes the template, not the item.
  let name: string | undefined;
  if (item) {
    const entry = sitemap ? lookup(sitemap)[normalizePath(sitemapPath)] : undefined;
    name = nonEmpty(entry?.title) ?? nonEmpty(page.title);
  } else {
    name = nonEmpty(page.seo?.title) ?? nonEmpty(page.title);
  }

  const webPage: JsonLdNode = { "@type": geo.schemaType, "@id": `${pageUrl}#webpage`, url: pageUrl };
  if (name) webPage.name = name;
  if (geo.description) webPage.description = geo.description;
  if (inLanguage) webPage.inLanguage = inLanguage;

  const isHome = typeof options.isHome === "boolean" ? options.isHome : pathname === "/";
  const site = buildSiteNodes(siteSettings, {
    origin: nonEmpty(options.baseUrl) ?? origin,
    includeOrganization: options.organization !== "home-only" || isHome,
  });
  if (site.websiteId) webPage.isPartOf = { "@id": site.websiteId };
  if (site.organizationId) webPage.publisher = { "@id": site.organizationId };

  let graph: JsonLdNode[] = [...site.nodes, webPage];

  if (sitemap) {
    const breadcrumb = buildBreadcrumb(sitemap, sitemapPath, nonEmpty(options.baseUrl) ?? origin, pageUrl, name);
    if (breadcrumb) {
      webPage.breadcrumb = { "@id": breadcrumb["@id"] };
      graph.push(breadcrumb);
    }
  }

  // Extension point: model mappings (the item's entity, Phase 3) merge in here, before the
  // page's structured data.

  if (geo.structuredData) graph = mergeNodes(graph, toNodes(geo.structuredData));

  if (transform) {
    const ctx: TransformContext = { page, item, siteSettings, url: pageUrl, locale, geo };
    const returned = transform(graph, ctx);
    if (Array.isArray(returned)) graph = returned;
  }

  return { "@context": "https://schema.org", "@graph": graph };
}
