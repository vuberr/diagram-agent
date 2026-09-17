import type {
  Graph,
  GraphDirection,
  GraphEdge,
  GraphNode,
  NodeType,
} from "./types";
import { sanitizeId, sanitizeNodeType } from "./sanitizer";
import { NODE_STYLES } from "./styles";

/** Map a Graphviz shape back to our closest node type. */
function typeFromShape(shape: string | undefined): NodeType {
  for (const [type, style] of Object.entries(NODE_STYLES)) {
    if (style.shape === shape) return type as NodeType;
  }
  return "generic";
}

/**
 * Parse GraphViz DOT back into the structured graph format so the editor and
 * the structured view stay in sync when the user edits DOT by hand. Supports
 * digraph/graph, node statements with label/shape attributes, edge statements
 * with optional labels, and `subgraph cluster_x { ... }` groups.
 */
export function parseDot(source: string): Graph | null {
  try {
    const text = String(source ?? "");
    if (!text.trim()) return null;

    const titleMatch = text.match(/digraph\s+(?:"([^"]*)"|([A-Za-z0-9_]+))/);
    const title = titleMatch
      ? (titleMatch[1] ?? titleMatch[2] ?? "System Diagram")
      : "System Diagram";

    const dirMatch = text.match(/rankdir\s*=\s*"?(\w{2})"?/);
    const direction: GraphDirection = ["TB", "LR", "BT", "RL"].includes(
      dirMatch?.[1] ?? "",
    )
      ? (dirMatch![1] as GraphDirection)
      : "LR";

    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    // Flatten cluster bodies: collect node ids per cluster for grouping.
    const clusterMembers = new Map<string, Set<string>>();
    const clusterOf = new Map<string, string>();

    const clusterRe =
      /subgraph\s+(?:cluster_\w+|"cluster_\w+")\s*\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = clusterRe.exec(text)) !== null) {
      const body = m[1];
      const nameMatch = m[0].match(/"(cluster_[A-Za-z0-9_]+)"|cluster_([A-Za-z0-9_]+)/);
      const groupName =
        nameMatch?.[1]?.replace(/^cluster_/, "") ??
        nameMatch?.[2] ??
        "group";
      const ids = new Set<string>();
      const idRe = /^\s*([A-Za-z0-9_]+)\s*\[/gm;
      let idm: RegExpExecArray | null;
      while ((idm = idRe.exec(body)) !== null) ids.add(idm[1]);
      clusterMembers.set(groupName, ids);
    }

    // Node statements: `id [label=..., shape=...]` — label may be HTML-like.
    const nodeRe =
      /(^|\n)\s*([A-Za-z0-9_]+)\s*\[([^\[\]]*label\s*=\s*(?:<<[\s\S]*?>>|"(?:[^"\\]|\\.)*")[^\[\]]*)\]/g;
    while ((m = nodeRe.exec(text)) !== null) {
      const id = m[2];
      const attrs = m[3];
      const label = extractLabel(attrs) ?? prettify(id);
      const shape = attrs.match(/shape\s*=\s*"?([a-z0-9_]+)"?/i)?.[1];
      const node: GraphNode = {
        id: sanitizeId(id),
        label,
        type: typeFromShape(shape),
      };
      const group = clusterOf.get(id);
      if (!group) {
        for (const [g, ids] of clusterMembers) {
          if (ids.has(id)) {
            node.group = g;
            break;
          }
        }
      } else {
        node.group = group;
      }
      nodes.set(node.id, node);
    }

    // Edge statements: `a -> b [label="..."]` (possibly chained `a -> b -> c`).
    const edgeRe =
      /([A-Za-z0-9_]+)\s*(?:->|--)\s*([A-Za-z0-9_]+)(?:\s*\[([^\]]*)\])?/g;
    while ((m = edgeRe.exec(text)) !== null) {
      const source = m[1];
      const target = m[2];
      if (source === "digraph" || target === "digraph") continue;
      const attrs = m[3] ?? "";
      const label = extractLabel(attrs) ?? undefined;
      edges.push({ source, target, label, dashed: /style\s*=\s*dashed/.test(attrs) });
    }

    if (nodes.size === 0) return null;

    return {
      title,
      direction,
      nodes: Array.from(nodes.values()),
      edges: edges.filter(
        (e) => nodes.has(e.source) && nodes.has(e.target),
      ),
    };
  } catch {
    return null;
  }
}

/** Extract the label attribute — HTML-like `<<...>>` or quoted `"..."`. */
function extractLabel(attrs: string): string | null {
  const html = attrs.match(/label\s*=\s*<<([\s\S]*?)>>/);
  if (html) {
    return decodeHtmlLike(html[1])
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  const quoted = attrs.match(/label\s*=\s*"((?:[^"\\]|\\.)*)"/);
  if (quoted) {
    return quoted[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\").trim();
  }
  return null;
}

function decodeHtmlLike(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

function prettify(id: string): string {
  return id
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
