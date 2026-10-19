import { COMMON_SCHEMA_TYPES } from "./schemaTypes";

export type JsonLdIssueCode =
  | "not-json"
  | "not-object"
  | "unknown-type"
  | "software-application-rich-result"
  | "product-rich-result"
  | "faq-page"
  | "how-to"
  | "duplicate-type"
  | "duplicate-entity";

export interface JsonLdIssue {
  code: JsonLdIssueCode;
  message: string;
  /** Where the issue is, e.g. `$["@graph"][2]`. `$` is the whole value. */
  path: string;
  /** The schema.org type the issue is about, when there is one. */
  type?: string;
}

export interface JsonLdValidationResult {
  /**
   * `false` only when there are errors. Warnings don't make JSON-LD invalid. Empty input (an
   * empty or whitespace string, `null` or `undefined`) is valid: there's nothing to store.
   */
  valid: boolean;
  /** The parsed value, when the input parsed to an object or array (even with errors inside it). */
  value?: object;
  /** The first error's code, when it's about the input as a whole: it doesn't parse, or isn't an object/array. */
  reason?: "not-json" | "not-object";
  /** The JSON parser's message, when `reason` is `not-json`. */
  detail?: string;
  errors: JsonLdIssue[];
  warnings: JsonLdIssue[];
}

type Json = { [key: string]: unknown };

const KNOWN_TYPES: { [type: string]: true } = {};
for (const type of COMMON_SCHEMA_TYPES) KNOWN_TYPES[type] = true;

/** Page types share a name or URL with other nodes by design, so they're left out of duplicate-entity. */
const WEB_PAGE_TYPES = ["WebPage", "AboutPage", "ContactPage", "CollectionPage", "FAQPage", "ItemPage", "ProfilePage", "QAPage", "SearchResultsPage", "CheckoutPage", "MedicalWebPage"];

const SOFTWARE_TYPES = ["SoftwareApplication", "MobileApplication", "WebApplication", "VideoGame"];

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const keyPath = (path: string, key: string | number) =>
  typeof key === "number" ? `${path}[${key}]` : `${path}[${JSON.stringify(key)}]`;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : value === undefined ? [] : [value]);

/**
 * A node's schema.org types, without a `schema:` or `https://schema.org/` prefix. Types from
 * other vocabularies (`ex:Thing`, `https://example.com/Thing`) are left out, since they can't be checked.
 */
function schemaTypes(node: Json): string[] {
  const types: string[] = [];
  for (const raw of asArray(node["@type"])) {
    if (typeof raw !== "string") continue;
    const type = raw.trim().replace(/^(schema:|https?:\/\/schema\.org\/)/i, "");
    if (type && !/[:/]/.test(type)) types.push(type);
  }
  return types;
}

const isPresent = (value: unknown) =>
  value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0);

/** True when some offer has a price, directly or in a `priceSpecification`. */
function hasOfferPrice(offers: unknown): boolean {
  return asArray(offers).some(
    (offer) =>
      isObject(offer) &&
      (isPresent(offer.price) ||
        isPresent(offer.lowPrice) ||
        asArray(offer.priceSpecification).some((spec) => isObject(spec) && isPresent(spec.price))),
  );
}

/** Collect every `{"@id": …}` reference made from inside another node. */
function collectReferences(value: unknown, owner: string | undefined, refs: { [id: string]: true }, depth = 0): void {
  if (Array.isArray(value)) {
    for (const entry of value) collectReferences(entry, owner, refs, depth);
    return;
  }
  if (!isObject(value)) return;
  const id = value["@id"];
  if (depth > 0 && typeof id === "string" && id !== owner) refs[id] = true;
  for (const key of Object.keys(value)) {
    if (key === "@id") continue;
    collectReferences(value[key], owner, refs, depth + 1);
  }
}

/**
 * Validate JSON-LD, as a JSON string or an already-parsed value.
 *
 * Empty input (`undefined`, `null`, or a string that is empty or whitespace) is valid, with no
 * `value`: there's nothing to store. The string `"null"` is not empty; it parses to a non-object.
 * The result's `valid`, `value`, `reason` and `detail` match the Content Manager's structured-data
 * check, so it can call this directly.
 *
 * **Errors** (the value can't be used): the string doesn't parse, or the value isn't a JSON-LD
 * object (or an array of them).
 *
 * **Warnings** (still valid schema.org, but worth telling the editor):
 * - a type that isn't in the package's list of common schema.org types (likely a typo);
 * - a SoftwareApplication without `offers.price` plus `aggregateRating` or `review`, or a Product
 *   without any of `offers`, `review` or `aggregateRating`: Google shows no rich result for them;
 * - FAQPage or HowTo markup: Google no longer shows these, and FAQ markup must match Q&A visible
 *   on the page;
 * - the same type in several top-level nodes that nothing connects (e.g. two Organizations);
 * - two top-level nodes of the same type with the same name or URL under different `@id`s (e.g. a
 *   pasted Organization next to the one generated from site settings).
 */
export function validateJsonLd(json: unknown): JsonLdValidationResult {
  const errors: JsonLdIssue[] = [];
  const warnings: JsonLdIssue[] = [];
  let parsed: object | undefined;
  const result = (extra?: Partial<JsonLdValidationResult>): JsonLdValidationResult => {
    const out: JsonLdValidationResult = { valid: errors.length === 0, errors, warnings, ...extra };
    if (parsed !== undefined) out.value = parsed;
    return out;
  };

  // Nothing to validate: an editor who clears the field stores nothing.
  if (json === undefined || json === null || (typeof json === "string" && json.trim() === "")) return result();

  let value = json;
  if (typeof json === "string") {
    try {
      value = JSON.parse(json);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      errors.push({ code: "not-json", path: "$", message: `The JSON doesn't parse: ${detail}` });
      return result({ reason: "not-json", detail });
    }
  }

  if (!isObject(value) && !Array.isArray(value)) {
    errors.push({ code: "not-object", path: "$", message: "JSON-LD must be an object, or an array of objects." });
    return result({ reason: "not-object" });
  }
  if (Array.isArray(value) && value.length === 0) {
    errors.push({ code: "not-object", path: "$", message: "JSON-LD must contain at least one object." });
    return result({ reason: "not-object" });
  }
  parsed = value;

  // Top-level nodes: each block (an array entry, or the value itself), or the nodes of its @graph.
  const topLevel: { node: Json; path: string }[] = [];
  const blocks = Array.isArray(value) ? value.map((block, i) => ({ block, path: keyPath("$", i) })) : [{ block: value, path: "$" }];
  for (const { block, path } of blocks) {
    if (!isObject(block)) {
      errors.push({ code: "not-object", path, message: "Each JSON-LD block must be an object." });
      continue;
    }
    if (Array.isArray(block["@graph"])) {
      const graphPath = keyPath(path, "@graph");
      block["@graph"].forEach((node, i) => {
        if (isObject(node)) topLevel.push({ node, path: keyPath(graphPath, i) });
        else errors.push({ code: "not-object", path: keyPath(graphPath, i), message: "Each @graph entry must be an object." });
      });
    } else {
      topLevel.push({ node: block, path });
    }
  }
  // Every error so far is a block or @graph entry that isn't an object. Don't hand back a value that
  // isn't valid JSON-LD: callers that store `value` would save it.
  if (errors.length > 0) {
    parsed = undefined;
    return result({ reason: "not-object" });
  }

  // Unknown types and FAQPage/HowTo, anywhere in the tree.
  const visit = (node: unknown, path: string): void => {
    if (Array.isArray(node)) {
      node.forEach((entry, i) => visit(entry, keyPath(path, i)));
      return;
    }
    if (!isObject(node)) return;
    for (const type of schemaTypes(node)) {
      if (!KNOWN_TYPES[type]) {
        warnings.push({
          code: "unknown-type",
          path,
          type,
          message: `"${type}" isn't a common schema.org type. Check the spelling (types are case-sensitive).`,
        });
      }
      if (type === "FAQPage") {
        warnings.push({
          code: "faq-page",
          path,
          type,
          message:
            "Google no longer shows FAQ rich results for most sites, and its guidelines require FAQ markup to match questions and answers visible on the page. Use a visible FAQ component instead.",
        });
      }
      if (type === "HowTo") {
        warnings.push({ code: "how-to", path, type, message: "Google no longer shows HowTo rich results." });
      }
    }
    for (const key of Object.keys(node)) {
      if (key !== "@context") visit(node[key], keyPath(path, key));
    }
  };
  for (const { node, path } of topLevel) visit(node, path);

  // Rich-result requirements, on top-level nodes.
  for (const { node, path } of topLevel) {
    const types = schemaTypes(node);
    const software = types.find((type) => SOFTWARE_TYPES.indexOf(type) >= 0);
    if (software) {
      const missing: string[] = [];
      if (!hasOfferPrice(node.offers)) missing.push("offers.price");
      if (!isPresent(node.aggregateRating) && !isPresent(node.review)) missing.push("aggregateRating or review");
      if (missing.length > 0) {
        warnings.push({
          code: "software-application-rich-result",
          path,
          type: software,
          message: `${software} has no ${missing.join(" and no ")}, so Google won't show a rich result for it.`,
        });
      }
    }
    if (types.indexOf("Product") >= 0 && !isPresent(node.offers) && !isPresent(node.review) && !isPresent(node.aggregateRating)) {
      warnings.push({
        code: "product-rich-result",
        path,
        type: "Product",
        message: "Product has none of offers, review or aggregateRating, so Google won't show a rich result for it.",
      });
    }
  }

  // The same type in several top-level nodes that nothing references.
  const refs: { [id: string]: true } = {};
  for (const { node } of topLevel) {
    collectReferences(node, typeof node["@id"] === "string" ? node["@id"] : undefined, refs);
  }
  const byType: { [type: string]: { ids: { [id: string]: true }; paths: string[] } } = {};
  for (const { node, path } of topLevel) {
    const id = typeof node["@id"] === "string" ? node["@id"] : undefined;
    if (id && refs[id]) continue;
    for (const type of schemaTypes(node)) {
      const group = (byType[type] = byType[type] || { ids: {}, paths: [] });
      if (id && group.ids[id]) continue; // the same node split across blocks, merged by @id
      if (id) group.ids[id] = true;
      group.paths.push(path);
    }
  }
  for (const type of Object.keys(byType)) {
    const { paths } = byType[type];
    if (paths.length > 1) {
      warnings.push({
        code: "duplicate-type",
        path: paths[1],
        type,
        message: `${type} appears in ${paths.length} separate top-level nodes (${paths.join(", ")}) that nothing connects. If they describe the same thing, give them one @id so they merge.`,
      });
    }
  }

  // The same type and name or URL under different @ids: most likely one thing described twice,
  // e.g. a pasted Organization next to the one generated from site settings.
  const seen: { [slot: string]: { id: string | undefined; path: string } } = {};
  const reported: { [pair: string]: true } = {};
  const normalizeUrl = (url: string) => url.trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
  for (const { node, path } of topLevel) {
    const id = typeof node["@id"] === "string" ? node["@id"] : undefined;
    const keys: string[] = [];
    if (typeof node.name === "string" && node.name.trim()) keys.push("name:" + node.name.trim().toLowerCase());
    if (typeof node.url === "string" && node.url.trim()) keys.push("url:" + normalizeUrl(node.url));
    for (const type of schemaTypes(node)) {
      if (WEB_PAGE_TYPES.indexOf(type) >= 0) continue;
      for (const key of keys) {
        const slot = type + "|" + key;
        const first = seen[slot];
        if (!first) {
          seen[slot] = { id, path };
          continue;
        }
        if (id !== undefined && first.id === id) continue;
        const pair = type + "|" + first.path + "|" + path;
        if (reported[pair]) continue;
        reported[pair] = true;
        warnings.push({
          code: "duplicate-entity",
          path,
          type,
          message: `This ${type} has the same ${key.slice(0, key.indexOf(":"))} as the one at ${first.path}, under a different @id. If they describe the same ${type}, give them one @id so they merge (for the site's Organization, use the @id from site settings).`,
        });
      }
    }
  }

  return result();
}
