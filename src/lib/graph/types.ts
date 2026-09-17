export const NODE_TYPES = [
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
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

/** A single node in the structured graph. */
export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  group?: string;
}

/** A directed relationship between two nodes. */
export interface GraphEdge {
  source: string;
  target: string;
  label?: string;
  dashed?: boolean;
}

/** Layout direction for the rendered diagram. */
export type GraphDirection = "TB" | "LR" | "BT" | "RL";

/** Structured graph — the intermediate representation between NL and DOT. */
export interface Graph {
  title: string;
  direction: GraphDirection;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Result of validating a DOT string with the real Graphviz parser. */
export interface DotValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** A saved diagram document (Convex `graphs` table). */
export interface GraphDoc {
  _id: string;
  title: string;
  description: string;
  graph: Graph;
  dot: string;
  createdAt: number;
  updatedAt: number;
}

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  actor: "User / Actor",
  client: "Client",
  server: "Server / Service",
  database: "Database",
  queue: "Queue / Stream",
  cache: "Cache",
  external: "External Service",
  network: "Network",
  gateway: "Gateway / Proxy",
  storage: "Storage",
  monitoring: "Monitoring",
  security: "Security",
  process: "Process",
  generic: "Component",
};
