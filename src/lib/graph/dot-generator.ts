import type { Graph, GraphEdge, GraphNode } from "./types";
import { NODE_STYLES } from "./styles";
import {
  escapeDotString,
  escapeHtmlLike,
  sanitizeDirection,
  sanitizeId,
  sanitizeNodeType,
} from "./sanitizer";

/**
 * Compile a validated structured graph into GraphViz DOT source. Node
 * identifiers are sanitized and HTML-like labels are escaped — the compiler
 * never interpolates raw user text into DOT.
 */
export function generateDot(input: unknown): string {
  const raw = (input ?? {}) as Partial<Graph>;

  const direction = sanitizeDirection(raw.direction);
  const seen = new Set<string>();
  const nodes: GraphNode[] = (Array.isArray(raw.nodes) ? raw.nodes : [])
    .map((n) => normalizeNode(n, seen))
    .filter((n): n is GraphNode => n !== null);

  const edges: GraphEdge[] = (Array.isArray(raw.edges) ? raw.edges : [])
    .map((e) => normalizeEdge(e))
    .filter((e): e is GraphEdge => e !== null)
    .filter((e) => seen.has(e.source) && seen.has(e.target));

  if (nodes.length === 0) return "";

  const title = typeof raw.title === "string" ? raw.title : "System Diagram";

  const lines: string[] = [
    `digraph ${JSON.stringify(escapeDotString(title))} {`,
    `  graph [rankdir=${direction}, bgcolor="transparent", pad="0.4", nodesep="0.7", ranksep="0.9", fontname="Helvetica"];`,
    `  node [fontname="Helvetica", fontsize=11, style="filled", margin="0.18,0.12"];`,
    `  edge [fontname="Helvetica", fontsize=9, color="#94a3b8", fontcolor="#64748b", arrowsize=0.8];`,
    "",
  ];

  // Cluster nodes by group when a group is present.
  const grouped = nodes.filter((n) => n.group);
  const ungrouped = nodes.filter((n) => !n.group);

  for (const node of ungrouped) lines.push(...nodeLines(node));

  const clusters = new Map<string, GraphNode[]>();
  for (const node of grouped) {
    const key = node.group!;
    const list = clusters.get(key) ?? [];
    list.push(node);
    clusters.set(key, list);
  }
  let clusterIndex = 0;
  for (const [group, members] of clusters) {
    clusterIndex += 1;
    const clusterId = sanitizeId(`cluster_${group}`);
    lines.push(`  subgraph ${clusterId} {`);
    lines.push(
      `    label=${JSON.stringify(escapeDotString(group))}; style="rounded,dashed"; color="#94a3b8"; fontname="Helvetica"; fontsize=10;`,
    );
    for (const node of members) {
      lines.push(...nodeLines(node, "    "));
    }
    lines.push("  }");
  }
  void clusterIndex;

  lines.push("");
  for (const edge of edges) {
    const attrs: string[] = [];
    if (edge.label) attrs.push(`label=${JSON.stringify(escapeDotString(edge.label))}`);
    if (edge.dashed) attrs.push(`style=dashed`);
    lines.push(`  ${edge.source} -> ${edge.target}${attrs.length ? ` [${attrs.join(", ")}]` : ""};`);
  }

  lines.push("}");
  return lines.join("\n");
}

function nodeLines(node: GraphNode, indent = "  "): string[] {
  const style = NODE_STYLES[node.type] ?? NODE_STYLES.generic;
  const label = escapeHtmlLike(node.label);
  const dot = [
    `${indent}${node.id} [`,
    `${indent}  label=<<table border="0" cellborder="0" cellspacing="0" cellpadding="0"><tr><td>${style.glyph} </td><td>${label}</td></tr></table>>,`,
    `${indent}  shape="${style.shape}",`,
    `${indent}  fillcolor="${style.fill}",`,
    `${indent}  fontcolor="${style.fontColor}",`,
    `${indent}  color="${style.fill}88",`,
    `${indent}  penwidth=1.4`,
    `${indent}];`,
  ];
  return dot;
}

function normalizeNode(input: unknown, taken: Set<string>): GraphNode | null {
  if (typeof input !== "object" || input === null) return null;
  const obj = input as Record<string, unknown>;
  const label =
    typeof obj.label === "string" && obj.label.trim()
      ? obj.label.trim().slice(0, 60)
      : "";
  if (!label) return null;
  const type = sanitizeNodeType(obj.type);
  const id = sanitizeId(typeof obj.id === "string" && obj.id ? obj.id : label);
  const unique = dedupeId(id, taken);
  const group =
    typeof obj.group === "string" && obj.group.trim()
      ? obj.group.trim().slice(0, 40)
      : undefined;
  return { id: unique, label, type, group };
}

function normalizeEdge(input: unknown): GraphEdge | null {
  if (typeof input !== "object" || input === null) return null;
  const obj = input as Record<string, unknown>;
  const source = typeof obj.source === "string" ? sanitizeId(obj.source) : "";
  const target = typeof obj.target === "string" ? sanitizeId(obj.target) : "";
  if (!source || !target) return null;
  const label =
    typeof obj.label === "string" && obj.label.trim()
      ? obj.label.trim().slice(0, 40)
      : undefined;
  return {
    source,
    target,
    label,
    dashed: obj.dashed === true,
  };
}

function dedupeId(id: string, taken: Set<string>): string {
  if (!taken.has(id)) {
    taken.add(id);
    return id;
  }
  let n = 2;
  while (taken.has(`${id}_${n}`)) n += 1;
  const unique = `${id}_${n}`;
  taken.add(unique);
  return unique;
}
