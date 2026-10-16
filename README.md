# @agility/geo

Build, serialize and validate [schema.org](https://schema.org) JSON-LD for [Agility CMS](https://agilitycms.com) pages, for search engines and AI answer engines (GEO / AEO).

- One `@graph` per page, built from the page's `geo` and `seo` properties in the Fetch API.
- Editor-supplied JSON-LD merged in by `@id`, so pasted markup and generated markup become one graph instead of several unrelated `<script>` blocks.
- Safe serialization for `<script type="application/ld+json">`.
- A validator that the Agility Content Manager and your site share, so what editors are told matches what renders.
- No runtime dependencies. Works in Node.js 18+, browsers, and edge runtimes. CommonJS and ESM.

> **Status: 0.x.** The API may change in minor versions until 1.0. Picking a settings profile per sitemap (`resolveSiteSettings`), content-model mappings, and `robots.txt` / `llms.txt` builders (with the AI-bot catalog) are planned for later versions.

## Install

```bash
npm install @agility/geo
```

`@agility/content-fetch` is an optional peer: `@agility/geo` never fetches anything, and takes the page you already have.

## Quick start

```ts
import agility from "@agility/content-fetch";
import { buildJsonLd, serializeJsonLd } from "@agility/geo";

const api = agility.getApi({ guid, apiKey });
const page = await api.getPage({ pageID: 12, locale: "en-us" });
const sitemap = await api.getSitemapFlat({ channelName: "website", locale: "en-us" });

const jsonLd = buildJsonLd({
  page,
  sitemap,
  url: "https://www.example.com/products/cms",
  locale: "en-us",
  siteSettings: {
    organization: { name: "Example Inc.", url: "https://www.example.com/", logo: "https://cdn.example.com/logo.svg" },
    website: { name: "Example" },
  },
});

// In your <head>:
// <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
```

Always serialize with `serializeJsonLd` (or `jsonLdScriptTag`), never with plain `JSON.stringify`. See [Escaping](#escaping).

## The page data it reads

The Fetch API delivers GEO data as a top-level `geo` object on the page, and four SEO properties inside the existing `seo` object. Every property is optional, and the API leaves out anything that isn't set: a page with no GEO data has no `geo` key at all.

```jsonc
{
  "pageID": 12,
  "title": "CMS",
  "seo": {
    "metaDescription": "…",
    "title": "…",            // independent <title>; falls back to the page title
    "canonicalUrl": "…",
    "robots": { "index": true, "follow": true },
    "ogImage": "https://…"
  },
  "geo": {
    "schemaType": "WebPage",  // WebPage | AboutPage | ContactPage | CollectionPage | FAQPage | ItemPage | ProfilePage
    "summary": "…",           // answer-first plain-text summary
    "structuredData": { },    // JSON-LD: one node, an array, or a document with @graph
    "ai": { "llmsInclude": "inherit", "crawl": "inherit" }
  }
}
```

Missing, empty, `null` or unparseable values are treated as "no data"; nothing here throws on bad content. Unknown keys are ignored, so a newer API never breaks an older copy of this package.

## API

### `buildJsonLd(options): JsonLdDocument`

Returns `{ "@context": "https://schema.org", "@graph": [...] }`.

| Option | Type | |
|---|---|---|
| `page` | page | **Required.** The page from `getPage` / `getPageByPath`. |
| `url` | `string` | **Required.** The page's absolute public URL. The WebPage `@id` is `` `${url}#webpage` ``. |
| `item` | content item | The item, when rendering a dynamic page's item. See [Dynamic pages](#dynamic-pages). |
| `sitemap` | flat sitemap | From `getSitemapFlat`. When given, a BreadcrumbList is built from the page's path. |
| `locale` | `string` | The page's locale, e.g. `en-us`. Sets `inLanguage` (`en-US`). |
| `path` | `string` | The page's path in the sitemap, for the breadcrumb. Defaults to the URL's pathname; pass it when the public URL adds a prefix (a locale segment, a base path). |
| `baseUrl` | `string` | The origin breadcrumb links are built on. Defaults to the URL's origin. |
| `siteSettings` | `GeoSiteSettings` | The site's settings profile: Organization, WebSite and the default page type. See [Site settings](#site-settings). |
| `organization` | `"full"` \| `"home-only"` | `"full"` (default) emits the Organization node on every page; `"home-only"` emits it on the home page and only an `@id` reference elsewhere. |
| `isHome` | `boolean` | Whether this is the home page, for `"home-only"`. Defaults to true when the URL's pathname is `/`. |
| `transform` | `(graph, ctx) => graph \| void` | Runs last. Add, change or remove nodes in code. `ctx` holds `page`, `item`, `siteSettings`, `url`, `locale` and the resolved `geo`. |

The graph is built in this order:

1. **Organization** and **WebSite** from `siteSettings`.
2. **WebPage**: `@type` from `geo.schemaType` (else the site's `defaultSchemaType`, else `WebPage`), `url`, `name` (`seo.title`, else the page title), `description` (`geo.summary`, else `seo.metaDescription`), `inLanguage`, `isPartOf` (the WebSite), `publisher` (the Organization), and a `breadcrumb` reference.
3. **BreadcrumbList**, when `sitemap` is given: one step per ancestor page in the sitemap (folders and links are skipped), ending with the page itself. Omitted for top-level pages.
4. **`geo.structuredData`**, merged by `@id`:
   - a node whose `@id` is already in the graph is merged into that node, and its properties **replace** the earlier ones (arrays are replaced, not concatenated), so an editor can always correct generated data. To change the generated WebPage, use `@id` `` `${url}#webpage` ``; to add to the Organization, use its `@id` (below);
   - a node with a new `@id`, or with none, is added;
   - a schema.org `@context` on pasted blocks is dropped, because the document carries it once.
5. **`transform`**.

#### Site settings

```ts
interface GeoSiteSettings {
  organization?: { name?, url?, logo?, sameAs?: string[], email?, telephone?, properties? };
  website?: { name?, url?, searchUrl?, properties? };
  defaultSchemaType?: string;
}
```

- **Organization** is emitted when it has a `name` or `url`. Its `@id` is `<organization url>/#organization` (falling back to the website URL, then the page's origin), so every page references the same node.
- **WebSite** is emitted when there's an Organization, or the website has a `name` or `url`. Its `@id` is `<website url>/#website`, its `name` falls back to the organization's, and its `publisher` references the Organization. A `searchUrl` containing `{query}` (e.g. `https://example.com/search?q={query}`) becomes a SearchAction.
- `properties` holds any other schema.org properties (`foundingDate`, `legalName`, `address`, …) as an object or a JSON string, and is merged into the node last. It can't change the node's `@id`. Invalid JSON is ignored.

In Agility these settings will come from the `AgilityGeoSettings` content model (one item per settings profile); until then, pass them from your own configuration.

#### Dynamic pages

When you pass `item`, the graph describes that item's page. Only the dynamic page's `schemaType`, robots and `ai.*` apply to it. The dynamic page's `summary` and `structuredData` describe the dynamic page itself, so they are **not** applied to its items (otherwise every item would carry the same summary and JSON-LD). The description is the item's `seo.metaDescription`, and the name is the item's sitemap title.

```ts
buildJsonLd({ page: dynamicPage, item: post, sitemap, url: "https://www.example.com/blog/hello-world" });
```

### `serializeJsonLd(json, space?): string` and `jsonLdScriptTag(json): string`

`serializeJsonLd` is `JSON.stringify` with `<`, `>` and `&` written as `\u003c`, `\u003e` and `\u0026` (and U+2028 / U+2029 escaped). `jsonLdScriptTag` wraps the result in `<script type="application/ld+json">…</script>`.

### `validateJsonLd(json): { valid, value?, reason?, detail?, errors, warnings }`

Takes a JSON string or a parsed value (a single block, an array of blocks, or a `@graph` document). Each issue has a `code`, a `message`, a `path` (such as `$["@graph"][2]`) and, where relevant, the `type`.

- Empty input (`undefined`, `null`, or an empty or whitespace string) is **valid**, with no `value`: an editor who clears the field stores nothing. The string `"null"` isn't empty: it's a `not-object` error.
- `value` is the parsed object or array, whenever the input parsed to one.
- `reason` (`not-json` or `not-object`) and `detail` (the parser's message) are set when the input as a whole is unusable. These match the Agility Content Manager's structured-data field, which calls this function.

**Errors** (`valid: false`):

| Code | When |
|---|---|
| `not-json` | The string doesn't parse. |
| `not-object` | The value, a block or a `@graph` entry isn't an object. |

**Warnings** (still valid schema.org; other consumers may use it):

| Code | When |
|---|---|
| `unknown-type` | A type isn't in the package's list of common schema.org types (likely a typo; types are case-sensitive). |
| `software-application-rich-result` | A SoftwareApplication (or Mobile/WebApplication, VideoGame) lacks `offers.price`, or lacks `aggregateRating` / `review`, so Google shows no rich result. |
| `product-rich-result` | A Product has none of `offers`, `review`, `aggregateRating`. |
| `faq-page` | FAQPage markup: Google no longer shows FAQ rich results for most sites, and FAQ markup must match Q&A visible on the page. |
| `how-to` | HowTo markup: Google no longer shows HowTo rich results. |
| `duplicate-type` | The same type appears in several top-level nodes that nothing connects, e.g. two separately pasted Organizations. Give them one `@id` so they merge. |
| `duplicate-entity` | Two top-level nodes of the same type have the same `name` or `url` under different `@id`s, e.g. a pasted Organization next to the one from site settings. Page types are exempt. |

Validate the final graph, after `transform`:

```ts
const { valid, errors, warnings } = validateJsonLd(buildJsonLd({ page, url }));
```

### Helpers

- `resolvePageGeo({ page, item? })`: the page's effective `schemaType`, `summary`, `description`, `structuredData`, `robots` and `ai` after the dynamic-page rule.
- `readGeo(raw)`, `readStructuredData(raw)`: defensive readers for `geo` and `structuredData` (accept objects or JSON strings; return `undefined` for empty or invalid values).
- `toNodes(jsonLd)`, `mergeNodes(graph, nodes)`: the flatten and merge-by-`@id` steps.
- `buildSiteNodes(siteSettings, { origin, includeOrganization })`: the Organization and WebSite nodes on their own, with their `@id`s.
- `toLanguageTag("en-us")` → `"en-US"`.
- `GEO_SCHEMA_TYPES`, `COMMON_SCHEMA_TYPES`.

## Escaping

JSON-LD sits inside a `<script>` element, and the HTML parser ends that element at the first `</script>`, even inside a JSON string. `structuredData` and summaries are written by editors, so a plain `JSON.stringify` lets editor text close the tag and inject markup into your site. `serializeJsonLd` escapes the characters that matter; the output is still valid JSON and parses back to the same value.

## Development

```bash
npm install     # also builds dist/
npm test        # type-check + jest
npm run build   # dist/node.js (CommonJS), dist/index.mjs (ESM), dist/*.d.ts
```

Releases publish from GitHub Actions on a `v<version>` tag that matches `package.json`, through npm Trusted Publishing with provenance, always under the **`beta`** dist-tag (as `@agility/content-fetch` does). Promote a version by hand once it's proven: `npm dist-tag add @agility/geo@<version> latest`. Add the version's section to `CHANGELOG.md` in the same PR that bumps the version.

Rendering adapters (`<AgilityJsonLd/>`, `generateAgilityMetadata()`) live in `@agility/nextjs`, not here; they use `serializeJsonLd`.

## License

MIT
