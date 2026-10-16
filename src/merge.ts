import type { JsonLdNode } from "./types";

const isObject = (value: unknown): value is { [key: string]: unknown } =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const SCHEMA_ORG_CONTEXT = /^https?:\/\/schema\.org\/?$/i;

/** Deep-copy JSON data, so the graph never shares objects with the caller's page. */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/**
 * Flatten JSON-LD as an editor supplies it (one node, an array of nodes or of documents, or a
 * document with `@graph`) into a list of nodes. A schema.org `@context` is dropped, because the
 * document carries it once; any other `@context` stays on its node. Non-objects are skipped.
 */
export function toNodes(input: unknown): JsonLdNode[] {
  if (Array.isArray(input)) {
    const nodes: JsonLdNode[] = [];
    for (const entry of input) nodes.push(...toNodes(entry));
    return nodes;
  }
  if (!isObject(input)) return [];

  const node = clone(input) as JsonLdNode;
  const context = node["@context"];
  if (typeof context === "string" && SCHEMA_ORG_CONTEXT.test(context)) delete node["@context"];

  if (Array.isArray(node["@graph"])) {
    const graphContext = node["@context"];
    const graph = (node["@graph"] as unknown[]).map((entry) =>
      // A non-schema.org context on the document applies to each of its nodes.
      graphContext !== undefined && isObject(entry) && entry["@context"] === undefined
        ? { "@context": graphContext, ...entry }
        : entry,
    );
    delete node["@graph"];
    delete node["@context"];
    const rest = Object.keys(node).length > 0 ? [node] : [];
    return [...rest, ...toNodes(graph)];
  }

  return Object.keys(node).length > 0 ? [node] : [];
}

/**
 * Merge nodes into a graph by `@id`. A node whose `@id` is already in the graph is merged into
 * that node: its properties replace the earlier ones, **arrays included** (they are replaced, not
 * concatenated). A node with a new `@id`, or with none, is appended.
 *
 * Returns a new array; the inputs are not changed.
 */
export function mergeNodes(graph: JsonLdNode[], additions: JsonLdNode[]): JsonLdNode[] {
  const result = graph.slice();
  const byId: { [id: string]: number } = {};
  result.forEach((node, index) => {
    const id = node["@id"];
    if (typeof id === "string" && !(id in byId)) byId[id] = index;
  });

  for (const node of additions) {
    const id = node["@id"];
    if (typeof id === "string" && id in byId) {
      result[byId[id]] = { ...result[byId[id]], ...node };
    } else {
      if (typeof id === "string") byId[id] = result.length;
      result.push(node);
    }
  }
  return result;
}
