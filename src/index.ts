export { buildJsonLd, toLanguageTag } from "./buildJsonLd";
export { serializeJsonLd, jsonLdScriptTag } from "./serialize";
export { validateJsonLd } from "./validate";
export { resolvePageGeo, readGeo, readStructuredData } from "./resolve";
export { mergeNodes, toNodes } from "./merge";
export { buildSiteNodes } from "./siteSettings";
export { COMMON_SCHEMA_TYPES } from "./schemaTypes";
export { GEO_SCHEMA_TYPES } from "./types";

export type { JsonLdIssue, JsonLdIssueCode, JsonLdValidationResult } from "./validate";
export type { SiteNodes } from "./siteSettings";
export type {
  BuildJsonLdOptions,
  GeoAiProperties,
  GeoContentItem,
  GeoCrawl,
  GeoExtraProperties,
  GeoLlmsInclude,
  GeoOrganizationSettings,
  GeoPage,
  GeoProperties,
  GeoRobots,
  GeoSchemaType,
  GeoSeoProperties,
  GeoSiteSettings,
  GeoSitemapFlat,
  GeoSitemapItem,
  GeoWebSiteSettings,
  JsonLdDocument,
  JsonLdInput,
  JsonLdNode,
  JsonLdTransform,
  ResolvedGeo,
  TransformContext,
} from "./types";
