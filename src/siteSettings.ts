import type {
  GeoExtraProperties,
  GeoOrganizationSettings,
  GeoSiteSettings,
  GeoWebSiteSettings,
  JsonLdNode,
} from "./types";

const isObject = (value: unknown): value is { [key: string]: unknown } =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nonEmpty = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;

/** Read the extra-properties JSON defensively: an object, or a JSON string holding one. */
function readExtra(raw: GeoExtraProperties | undefined): { [property: string]: unknown } | undefined {
  let value: unknown = raw;
  if (typeof raw === "string") {
    const text = raw.trim();
    if (text === "" || text === "null") return undefined;
    try {
      value = JSON.parse(text);
    } catch {
      return undefined;
    }
  }
  if (!isObject(value)) return undefined;
  const copy: { [property: string]: unknown } = JSON.parse(JSON.stringify(value));
  // The node's @id is what every page references, so the extra JSON can't move it.
  delete copy["@id"];
  delete copy["@context"];
  return Object.keys(copy).length > 0 ? copy : undefined;
}

/** `https://example.com/` + `#organization` → `https://example.com/#organization`. */
const nodeId = (base: string, fragment: string) => base.replace(/[?#].*$/, "").replace(/\/+$/, "") + "/#" + fragment;

export interface SiteNodes {
  /** The nodes to put at the start of the graph. */
  nodes: JsonLdNode[];
  /** The Organization's `@id`, when settings define one (whether or not its node is emitted). */
  organizationId?: string;
  /** The WebSite's `@id`, when settings define one. */
  websiteId?: string;
}

/**
 * Build the Organization and WebSite nodes from a settings profile.
 *
 * - **Organization** is emitted when `organization` has a name or URL. Its `@id` is
 *   `<organization url>/#organization`, falling back to the website URL, then `origin`.
 *   With `includeOrganization: false` (`organization: "home-only"` on a page other than the home
 *   page) the node is left out, but its `@id` is still returned so other nodes can reference it.
 * - **WebSite** is emitted whenever there's an Organization or `website` has a name or URL. Its
 *   `@id` is `<website url>/#website`; its `name` falls back to the organization's name, and its
 *   `publisher` references the Organization.
 * - Each node's extra-properties JSON is merged in last, except `@id`.
 */
export function buildSiteNodes(
  settings: GeoSiteSettings | null | undefined,
  { origin, includeOrganization }: { origin: string; includeOrganization: boolean },
): SiteNodes {
  const result: SiteNodes = { nodes: [] };
  if (!isObject(settings)) return result;

  const org = isObject(settings.organization) ? (settings.organization as GeoOrganizationSettings) : undefined;
  const site = isObject(settings.website) ? (settings.website as GeoWebSiteSettings) : undefined;

  const orgName = nonEmpty(org?.name);
  const orgUrl = nonEmpty(org?.url);
  const siteName = nonEmpty(site?.name);
  const siteUrl = nonEmpty(site?.url);

  if (orgName || orgUrl) {
    const base = orgUrl ?? siteUrl ?? origin;
    result.organizationId = nodeId(base, "organization");
    if (includeOrganization) {
      const node: JsonLdNode = { "@type": "Organization", "@id": result.organizationId };
      if (orgName) node.name = orgName;
      if (orgUrl) node.url = orgUrl;
      const logo = nonEmpty(org?.logo);
      if (logo) node.logo = logo;
      const sameAs = Array.isArray(org?.sameAs) ? org!.sameAs!.map(nonEmpty).filter((url): url is string => !!url) : [];
      if (sameAs.length > 0) node.sameAs = sameAs;
      const email = nonEmpty(org?.email);
      if (email) node.email = email;
      const telephone = nonEmpty(org?.telephone);
      if (telephone) node.telephone = telephone;
      result.nodes.push({ ...node, ...readExtra(org?.properties) });
    }
  }

  if (result.organizationId || siteName || siteUrl) {
    const url = siteUrl ?? orgUrl ?? origin;
    result.websiteId = nodeId(url, "website");
    const node: JsonLdNode = { "@type": "WebSite", "@id": result.websiteId };
    if (url) node.url = url;
    const name = siteName ?? orgName;
    if (name) node.name = name;
    if (result.organizationId) node.publisher = { "@id": result.organizationId };
    const searchUrl = nonEmpty(site?.searchUrl);
    if (searchUrl && searchUrl.indexOf("{query}") >= 0) {
      node.potentialAction = {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: searchUrl.replace("{query}", "{search_term_string}") },
        "query-input": "required name=search_term_string",
      };
    }
    result.nodes.push({ ...node, ...readExtra(site?.properties) });
  }

  return result;
}
