import type { GraphDirection, GraphNode, NodeType } from "./types";

/**
 * Sanitize arbitrary text into a safe DOT identifier: `[A-Za-z0-9_]` only,
 * never starting with a digit, max 48 chars. Also accepts existing `cluster_*`
 * ids unchanged.
 */
export function sanitizeId(raw: string): string {
  const cleaned = String(raw ?? "")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  if (!cleaned) return "node";
  if (/^[0-9]/.test(cleaned)) return `n_${cleaned}`;
  return cleaned;
}

/** Escape a string for use inside a DOT double-quoted literal. */
export function escapeDotString(raw: string): string {
  return String(raw ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, " ")
    .slice(0, 200);
}

/** Escape text for interpolation into an HTML-like DOT label. */
export function escapeHtmlLike(raw: string): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 200);
}

const DIRECTIONS: GraphDirection[] = ["TB", "LR", "BT", "RL"];

export function sanitizeDirection(raw: unknown): GraphDirection {
  return DIRECTIONS.includes(raw as GraphDirection)
    ? (raw as GraphDirection)
    : "LR";
}

const TYPE_SET = new Set<NodeType>([
  "actor",
  "client",
  "server",
  "database",
  "queue",
  "cache",
  "external",
  "network",
  "gateway",
  "storage",
  "monitoring",
  "security",
  "process",
  "generic",
]);

export function sanitizeNodeType(raw: unknown): NodeType {
  return TYPE_SET.has(raw as NodeType) ? (raw as NodeType) : "generic";
}

/** Unique, collision-free node id derived from a label. */
export function uniqueNodeId(
  label: string,
  type: NodeType,
  taken: Set<string>,
): string {
  const base = sanitizeId(label) || sanitizeId(type);
  let id = base;
  let n = 2;
  while (taken.has(id)) {
    id = `${base}_${n++}`;
  }
  taken.add(id);
  return id;
}

/**
 * Enforce referential integrity: every edge endpoint must reference an
 * existing node id; dangling edges are dropped.
 */
export function enforceReferentialIntegrity(
  nodes: GraphNode[],
  edges: { source: string; target: string; label?: string; dashed?: boolean }[],
) {
  const ids = new Set(nodes.map((n) => n.id));
  return edges.filter((e) => ids.has(e.source) && ids.has(e.target));
}
