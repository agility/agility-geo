# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-10-15

### Added
- `buildJsonLd()`: one schema.org `@graph` per page. A WebPage node typed by `geo.schemaType`,
  a BreadcrumbList from a flat sitemap, the editor's `geo.structuredData` merged in by `@id`
  (later properties replace earlier ones, arrays included), and a `transform` hook that runs last.
  On a dynamic page, the item's own `geo` is read too: its `schemaType`, robots and each `ai.*`
  property override the dynamic page's (which act as defaults), and its `summary` and
  `structuredData` are its own only (the dynamic page's never apply to its items). An item with no
  summary is described by its `seo.metaDescription`.
- Site settings in `buildJsonLd()`: Organization and WebSite nodes (with stable `@id`s the WebPage
  references through `publisher` and `isPartOf`), a SearchAction from a search URL, an
  extra-properties JSON escape hatch per node, a default page type, and `organization: "home-only"`.
  `buildSiteNodes()` builds the two nodes on their own.
- `serializeJsonLd()` and `jsonLdScriptTag()`: JSON for a `<script type="application/ld+json">`
  tag, with `<`, `>` and `&` escaped so editor text can't close the tag.
- `validateJsonLd()`: errors for JSON that doesn't parse or isn't an object; warnings for
  uncommon or misspelt types, missing Google rich-result properties (SoftwareApplication,
  Product), FAQPage/HowTo markup, the same type in several disconnected nodes, and the same
  entity (type plus name or URL) under different `@id`s. Empty input is valid, and the result
  carries the parsed `value` plus `reason`/`detail`, matching the Content Manager's
  structured-data field.
- `resolvePageGeo()`, `readGeo()`, `readStructuredData()`, `toNodes()`, `mergeNodes()` and
  `toLanguageTag()` helpers, and TypeScript types for the page `geo` and `seo` properties.
- CommonJS and ESM builds behind an `exports` map. No runtime dependencies.
