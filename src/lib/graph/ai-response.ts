import type { Graph, GraphNode, NodeType } from "./types";
import { sanitizeId, sanitizeNodeType } from "./sanitizer";

export interface AiGraphResponse {
  title: string;
  direction: string;
  nodes: Array<{ id: string; label: string; type: string; group?: string }>;
  edges: Array<{ source: string; target: string; label?: string }>;
}

export const AI_SYSTEM_PROMPT = `You are a system-architecture analyst that converts natural-language descriptions into structured node-edge graphs for GraphViz diagrams.

Return ONLY a JSON object (no markdown fences, no commentary) with this exact shape:
{
  "title": "short diagram title",
  "direction": "LR" | "TB",
  "nodes": [{ "id": "snake_case_id", "label": "Human Label", "type": "<type>", "group": "optional group name" }],
  "edges": [{ "source": "source_id", "target": "target_id", "label": "optional verb phrase" }]
}

Rules:
- "type" must be one of: actor, client, server, database, queue, cache, external, network, gateway, storage, monitoring, security, process, generic.
- Use "actor" for people/roles (customer, user, admin, developer), "client" for browsers/apps/devices, "server" for services and application servers, "database" for databases, "queue" for message brokers, "cache" for caches, "external" for third-party services, "network" for the internet/VPN/VPC, "gateway" for load balancers and proxies, "storage" for file/object storage, "monitoring" for observability, "security" for firewalls/auth, "process" for pipelines and jobs.
- Every "source" and "target" in edges MUST be an id that appears exactly in "nodes".
- Create a node for EVERY entity mentioned, including mediating ones like "Internet" or a VPN.
- Edge labels are short lowercase verb phrases like "requests", "queries", "publishes to".
- Prefer direction "LR" for flows, "TB" for hierarchies. Aim for 3-14 nodes.`;

/**
 * Convert raw AI output (possibly fenced or wrapped in prose) into a
 * sanitized structured graph. Throws when nothing usable can be extracted.
 */
export function parseAiGraphResponse(raw: string): Graph {
  const json = extractJson(raw);
  if (!json) throw new Error("AI did not return a JSON graph.");

  const title =
    typeof json.title === "string" && json.title.trim()
      ? json.title.trim().slice(0, 80)
      : "System Diagram";

  const direction =
    json.direction === "TB" || json.direction === "tb"
      ? "TB"
      : json.direction === "BT"
        ? "BT"
        : json.direction === "RL"
          ? "RL"
          : "LR";

  const rawNodes = Array.isArray(json.nodes) ? json.nodes : [];
  const seen = new Set<string>();
  const nodes: GraphNode[] = [];
  const idRemap = new Map<string, string>();

  for (const rn of rawNodes) {
    if (typeof rn !== "object" || rn === null) continue;
    const obj = rn as Record<string, unknown>;
    const label =
      typeof obj.label === "string" && obj.label.trim()
        ? obj.label.trim().slice(0, 60)
        : "";
    if (!label) continue;
    const type = sanitizeNodeType(obj.type);
    const requestedId =
      typeof obj.id === "string" && obj.id.trim() ? obj.id.trim() : label;
    const sanitized = sanitizeId(requestedId);
    let unique = sanitized;
    let n = 2;
    while (seen.has(unique)) unique = `${sanitized}_${n++}`;
    seen.add(unique);
    idRemap.set(requestedId, unique);
    idRemap.set(sanitized, unique);
    const group =
      typeof obj.group === "string" && obj.group.trim()
        ? obj.group.trim().slice(0, 40)
        : undefined;
    nodes.push({ id: unique, label, type, group });
  }

  if (nodes.length === 0) throw new Error("AI returned no usable nodes.");

  const validIds = new Set(nodes.map((n) => n.id));
  const rawEdges = Array.isArray(json.edges) ? json.edges : [];
  const edges: Graph["edges"] = [];
  const seenEdges = new Set<string>();

  for (const re of rawEdges) {
    if (typeof re !== "object" || re === null) continue;
    const obj = re as Record<string, unknown>;
    const sourceKey = typeof obj.source === "string" ? obj.source.trim() : "";
    const targetKey = typeof obj.target === "string" ? obj.target.trim() : "";
    if (!sourceKey || !targetKey) continue;
    const source = idRemap.get(sourceKey) ?? idRemap.get(sanitizeId(sourceKey));
    const target = idRemap.get(targetKey) ?? idRemap.get(sanitizeId(targetKey));
    if (!source || !target || !validIds.has(source) || !validIds.has(target)) {
      continue;
    }
    const label =
      typeof obj.label === "string" && obj.label.trim()
        ? obj.label.trim().slice(0, 40)
        : undefined;
    const key = `${source}->${target}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    edges.push({ source, target, label });
  }

  return { title, direction, nodes, edges };
}

/** Pull the first JSON object out of a possibly fenced or chatty response. */
function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  if (start === -1) return null;
  // Walk the string tracking brace depth and string state.
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(candidate.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
