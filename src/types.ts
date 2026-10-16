/**
 * Types for the GEO/AEO data Agility delivers on a page, and for the JSON-LD this package builds.
 *
 * The page types are structural: they describe only the properties `@agility/geo` reads, so a
 * `Page` / `ContentItem` from `@agility/content-fetch` can be passed in directly, and so can the
 * same objects from any other client. Unknown properties are ignored.
 */

/** The page types an editor can choose. Delivered as `page.geo.schemaType`. */
export type GeoSchemaType =
  | "WebPage"
  | "AboutPage"
  | "ContactPage"
  | "CollectionPage"
  | "FAQPage"
  | "ItemPage"
  | "ProfilePage";

export const GEO_SCHEMA_TYPES: readonly GeoSchemaType[] = [
  "WebPage",
  "AboutPage",
  "ContactPage",
  "CollectionPage",
  "FAQPage",
  "ItemPage",
  "ProfilePage",
];

/** Whether the page is listed in `llms.txt`. `inherit` follows the page's sitemap visibility. */
export type GeoLlmsInclude = "inherit" | "include" | "exclude";

/** Whether AI crawlers may fetch the page. `inherit` follows the site policy. */
export type GeoCrawl = "inherit" | "block";

export interface GeoAiProperties {
  llmsInclude?: GeoLlmsInclude;
  crawl?: GeoCrawl;
}

/** A JSON-LD value as an editor supplies it: one node, an array of nodes, or a document with `@graph`. */
export type JsonLdInput = JsonLdNode | JsonLdNode[] | { "@context"?: unknown; "@graph": JsonLdNode[] };

/**
 * The page's top-level `geo` object. The API leaves it out when the page has no GEO data, and
 * leaves out each property that isn't set. Unknown keys are allowed and ignored, so a newer API
 * never breaks an older copy of this package.
 */
export interface GeoProperties {
  schemaType?: GeoSchemaType | string;
  /** Answer-first plain-text summary. */
  summary?: string | null;
  /** JSON-LD merged into the generated graph by `@id`. */
  structuredData?: JsonLdInput | string | null;
  ai?: GeoAiProperties | null;
  [key: string]: unknown;
}

export interface GeoRobots {
  index?: boolean;
  follow?: boolean;
}

/** The page's `seo` object: the existing properties plus the four added for GEO. */
export interface GeoSeoProperties {
  metaDescription?: string | null;
  metaKeywords?: string | null;
  metaHTML?: string | null;
  /** Independent `<title>`; falls back to the page title. */
  title?: string | null;
  canonicalUrl?: string | null;
  robots?: GeoRobots | null;
  ogImage?: string | null;
}

/** The parts of a page (`getPage` / `getPageByPath`) this package reads. */
export interface GeoPage {
  pageID?: number;
  title?: string;
  name?: string;
  path?: string;
  menuText?: string;
  pageType?: string;
  dynamicItemContentID?: number;
  seo?: GeoSeoProperties | null;
  geo?: GeoProperties | string | null;
}

/** The parts of a content item this package reads (the item a dynamic page renders). */
export interface GeoContentItem {
  contentID?: number;
  seo?: GeoSeoProperties | null;
  fields?: { [key: string]: any };
}

/** One entry of a flat sitemap (`getSitemapFlat`). */
export interface GeoSitemapItem {
  pageID?: number;
  title?: string;
  name?: string;
  path: string;
  menuText?: string;
  pageType?: string;
}

/** A flat sitemap: page path → sitemap entry. */
export interface GeoSitemapFlat {
  [path: string]: GeoSitemapItem;
}

/** Extra JSON-LD properties for a settings node: an object, or a JSON string holding one. */
export type GeoExtraProperties = { [property: string]: unknown } | string | null;

/** Who the site is: the Organization node every page references. */
export interface GeoOrganizationSettings {
  name?: string | null;
  /** The organization's home URL. Also the base of the Organization and WebSite `@id`s. */
  url?: string | null;
  /** The logo's URL. */
  logo?: string | null;
  /** Profile URLs (LinkedIn, G2, …). */
  sameAs?: string[] | null;
  email?: string | null;
  telephone?: string | null;
  /**
   * Any other schema.org Organization properties (`foundingDate`, `legalName`, `address`, …),
   * merged into the node last, so they can also override the typed fields.
   */
  properties?: GeoExtraProperties;
}

/** The WebSite node. */
export interface GeoWebSiteSettings {
  name?: string | null;
  /** The site's home URL. Defaults to the organization URL, then to the page's origin. */
  url?: string | null;
  /**
   * A site search URL with `{query}` where the search terms go, e.g.
   * `https://example.com/search?q={query}`. Becomes a SearchAction.
   */
  searchUrl?: string | null;
  /** Any other schema.org WebSite properties, merged into the node last. */
  properties?: GeoExtraProperties;
}

/**
 * Site-level GEO settings: one resolved settings profile (plan §4.2, §4.7).
 *
 * 0.1 reads `organization`, `website` and `defaultSchemaType`. The AI-crawler policy, llms.txt
 * settings, model mappings and `resolveSiteSettings()` (which picks a profile per sitemap) come
 * with the Phase 2 and 3 builders. Unknown keys are allowed and ignored.
 */
export interface GeoSiteSettings {
  organization?: GeoOrganizationSettings | null;
  website?: GeoWebSiteSettings | null;
  /** The page type for pages that don't set `geo.schemaType`. Default `WebPage`. */
  defaultSchemaType?: GeoSchemaType | string | null;
  [key: string]: unknown;
}

/** One JSON-LD node. */
export interface JsonLdNode {
  "@id"?: string;
  "@type"?: string | string[];
  [property: string]: unknown;
}

/** The document `buildJsonLd` returns: one `@graph` with a schema.org context. */
export interface JsonLdDocument {
  "@context": "https://schema.org";
  "@graph": JsonLdNode[];
}

/** The page's effective GEO values after the dynamic-page rules are applied. */
export interface ResolvedGeo {
  schemaType: string;
  summary?: string;
  description?: string;
  structuredData?: JsonLdInput;
  robots?: GeoRobots;
  ai: Required<GeoAiProperties>;
}

export interface TransformContext {
  page: GeoPage;
  item?: GeoContentItem;
  siteSettings?: GeoSiteSettings | null;
  url: string;
  locale?: string;
  geo: ResolvedGeo;
}

/** Return a new graph, or change the one passed in and return nothing. */
export type JsonLdTransform = (graph: JsonLdNode[], ctx: TransformContext) => JsonLdNode[] | void;

export interface BuildJsonLdOptions {
  /** The page from the Fetch API. */
  page: GeoPage;
  /** The content item, when rendering an item on a dynamic page. */
  item?: GeoContentItem;
  /** The site's resolved settings profile: Organization, WebSite and the default page type. */
  siteSettings?: GeoSiteSettings | null;
  /** A flat sitemap. When given, a BreadcrumbList is built from the page's path. */
  sitemap?: GeoSitemapFlat;
  /** The page's absolute public URL. The WebPage `@id` is `${url}#webpage`. */
  url: string;
  /** The page's locale, e.g. `en-us`. Sets `inLanguage` (written as `en-US`). */
  locale?: string;
  /**
   * The page's path in the sitemap, for the breadcrumb. Defaults to the URL's pathname. Pass it
   * when the public URL adds a prefix (a locale segment, a base path) the sitemap doesn't have.
   */
  path?: string;
  /** The origin breadcrumb links are built on. Defaults to the URL's origin. */
  baseUrl?: string;
  /**
   * How the Organization from site settings is emitted. `"full"` (the default) puts the whole
   * node on every page. `"home-only"` puts it on the home page only, and elsewhere just a
   * reference to its `@id` (Google asks for Organization markup on the home or about page).
   */
  organization?: "full" | "home-only";
  /**
   * Whether this is the site's home page, for `organization: "home-only"`. Defaults to true when
   * the URL's pathname is `/`.
   */
  isHome?: boolean;
  /** A hook that runs last and may add, change or remove nodes. */
  transform?: JsonLdTransform;
}
