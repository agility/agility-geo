import type {
  GeoAiProperties,
  GeoContentItem,
  GeoPage,
  GeoProperties,
  JsonLdInput,
  ResolvedGeo,
} from "./types";

const isObject = (value: unknown): value is { [key: string]: unknown } =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nonEmpty = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;

/** Parse a JSON string, or return `undefined` for empty, whitespace, the literal `null` or invalid JSON. */
const parseJson = (value: string): unknown => {
  const text = value.trim();
  if (text === "" || text === "null") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/**
 * Read a page's `geo` value defensively. Missing, empty, whitespace, the literal `null` and
 * invalid JSON all mean "no GEO data"; this never throws. Unknown keys are kept and ignored.
 */
export function readGeo(raw: unknown): GeoProperties | undefined {
  const value = typeof raw === "string" ? parseJson(raw) : raw;
  return isObject(value) ? (value as GeoProperties) : undefined;
}

/** Read `structuredData` defensively: an object or array, or a JSON string holding one. */
export function readStructuredData(raw: unknown): JsonLdInput | undefined {
  const value = typeof raw === "string" ? parseJson(raw) : raw;
  if (Array.isArray(value)) return value.length > 0 ? (value as JsonLdInput) : undefined;
  if (isObject(value)) return Object.keys(value).length > 0 ? (value as JsonLdInput) : undefined;
  return undefined;
}

const LLMS_INCLUDE = ["inherit", "include", "exclude"];
const CRAWL = ["inherit", "block"];

const readAi = (ai: GeoAiProperties | null | undefined): Required<GeoAiProperties> => ({
  llmsInclude: ai && LLMS_INCLUDE.indexOf(ai.llmsInclude as string) >= 0 ? ai.llmsInclude! : "inherit",
  crawl: ai && CRAWL.indexOf(ai.crawl as string) >= 0 ? ai.crawl! : "inherit",
});

/** A schema.org type name: letters and digits, starting with a capital. */
const TYPE_NAME = /^[A-Z][A-Za-z0-9]*$/;

/**
 * Work out a page's effective GEO values.
 *
 * The page type is `geo.schemaType`, else the site's `defaultSchemaType`, else `WebPage`.
 *
 * - **A page:** everything comes from the page. The description is `geo.summary`, falling back to
 *   `seo.metaDescription`.
 * - **An item on a dynamic page (Phase 1 rule):** only `schemaType`, robots and `ai.*` come from
 *   the dynamic page. The page's `summary` and `structuredData` describe the dynamic page itself,
 *   so they are **not** applied to its items, and the description is the item's
 *   `seo.metaDescription`.
 */
export function resolvePageGeo({
  page,
  item,
  defaultSchemaType,
}: {
  page: GeoPage;
  item?: GeoContentItem;
  /** The site's default page type (site settings), used when the page sets none. */
  defaultSchemaType?: string | null;
}): ResolvedGeo {
  const geo = readGeo(page.geo) ?? {};
  const validType = (value: unknown) => {
    const type = nonEmpty(value);
    return type && TYPE_NAME.test(type) ? type : undefined;
  };

  const resolved: ResolvedGeo = {
    schemaType: validType(geo.schemaType) ?? validType(defaultSchemaType) ?? "WebPage",
    ai: readAi(isObject(geo.ai) ? (geo.ai as GeoAiProperties) : undefined),
  };

  const robots = page.seo?.robots;
  if (isObject(robots)) resolved.robots = { ...robots };

  if (item) {
    const description = nonEmpty(item.seo?.metaDescription);
    if (description) resolved.description = description;
    return resolved;
  }

  const summary = nonEmpty(geo.summary);
  if (summary) resolved.summary = summary;

  const description = summary ?? nonEmpty(page.seo?.metaDescription);
  if (description) resolved.description = description;

  const structuredData = readStructuredData(geo.structuredData);
  if (structuredData) resolved.structuredData = structuredData;

  return resolved;
}
