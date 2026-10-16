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

const aiValue = <T extends string>(ai: unknown, key: keyof GeoAiProperties, allowed: string[]): T | undefined => {
  if (!isObject(ai)) return undefined;
  const value = ai[key];
  return typeof value === "string" && allowed.indexOf(value) >= 0 ? (value as T) : undefined;
};

/**
 * Read `ai.*`. Each property is taken from the first source that sets it to something other than
 * `inherit` (an item's own value, then its dynamic page's), else `inherit`.
 */
const readAi = (...sources: unknown[]): Required<GeoAiProperties> => {
  const pick = <T extends string>(key: keyof GeoAiProperties, allowed: string[]): T => {
    for (const source of sources) {
      const value = aiValue<T>(source, key, allowed);
      if (value && value !== "inherit") return value;
    }
    return "inherit" as T;
  };
  return { llmsInclude: pick("llmsInclude", LLMS_INCLUDE), crawl: pick("crawl", CRAWL) };
};

/** A schema.org type name: letters and digits, starting with a capital. */
const TYPE_NAME = /^[A-Z][A-Za-z0-9]*$/;

/**
 * Work out a page's effective GEO values.
 *
 * The page type is `geo.schemaType`, else the site's `defaultSchemaType`, else `WebPage`.
 *
 * - **A page:** everything comes from the page. The description is `geo.summary`, falling back to
 *   `seo.metaDescription`.
 * - **An item on a dynamic page:** `schemaType`, robots (`seo.robots`) and each `ai.*` property
 *   are the item's own value when it sets one, else the dynamic page's (the page's value is the
 *   default for all its items; an `ai.*` value of `inherit` counts as not set). `summary` and
 *   `structuredData` are the **item's own only**: the dynamic page's describe the dynamic page
 *   itself, so they are never applied to its items. The description is the item's `geo.summary`,
 *   falling back to the item's `seo.metaDescription`. An item with no `geo` gets exactly the
 *   dynamic page's `schemaType`, robots and `ai.*`, and its `seo.metaDescription`.
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
  const itemGeo = item ? readGeo(item.geo) ?? {} : undefined;
  const validType = (value: unknown) => {
    const type = nonEmpty(value);
    return type && TYPE_NAME.test(type) ? type : undefined;
  };

  const resolved: ResolvedGeo = {
    schemaType:
      validType(itemGeo?.schemaType) ?? validType(geo.schemaType) ?? validType(defaultSchemaType) ?? "WebPage",
    ai: readAi(itemGeo?.ai, geo.ai),
  };

  const robots = isObject(item?.seo?.robots) ? item!.seo!.robots : page.seo?.robots;
  if (isObject(robots)) resolved.robots = { ...robots };

  // An item's summary and JSON-LD are its own; the dynamic page's never flow to its items.
  const source: { geo: GeoProperties; seo?: GeoPage["seo"] } = itemGeo
    ? { geo: itemGeo, seo: item!.seo }
    : { geo, seo: page.seo };

  const summary = nonEmpty(source.geo.summary);
  if (summary) resolved.summary = summary;

  const description = summary ?? nonEmpty(source.seo?.metaDescription);
  if (description) resolved.description = description;

  const structuredData = readStructuredData(source.geo.structuredData);
  if (structuredData) resolved.structuredData = structuredData;

  return resolved;
}
