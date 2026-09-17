import type { NodeType } from "./types";

/**
 * Visual identity for each node type: Graphviz shape, fill color, font color,
 * and an emoji glyph embedded in the HTML-like label. The fill/font pairs are
 * tuned to stay legible on both light and dark diagram canvases.
 */
export interface NodeStyle {
  shape: string;
  fill: string;
  fontColor: string;
  glyph: string;
}

export const NODE_STYLES: Record<NodeType, NodeStyle> = {
  actor: { shape: "circle", fill: "#6366f1", fontColor: "#ffffff", glyph: "👤" },
  client: { shape: "box", fill: "#0ea5e9", fontColor: "#ffffff", glyph: "💻" },
  server: { shape: "component", fill: "#10b981", fontColor: "#062b1d", glyph: "🖥️" },
  database: { shape: "cylinder", fill: "#f59e0b", fontColor: "#3b2301", glyph: "🗄️" },
  queue: { shape: "parallelogram", fill: "#a855f7", fontColor: "#ffffff", glyph: "📨" },
  cache: { shape: "note", fill: "#f97316", fontColor: "#331200", glyph: "⚡" },
  external: { shape: "box3d", fill: "#64748b", fontColor: "#ffffff", glyph: "🌐" },
  network: { shape: "ellipse", fill: "#14b8a6", fontColor: "#032420", glyph: "🛰️" },
  gateway: { shape: "diamond", fill: "#ef4444", fontColor: "#ffffff", glyph: "🚪" },
  storage: { shape: "folder", fill: "#eab308", fontColor: "#302500", glyph: "📁" },
  monitoring: { shape: "hexagon", fill: "#22c55e", fontColor: "#052e12", glyph: "📈" },
  security: { shape: "pentagon", fill: "#ec4899", fontColor: "#ffffff", glyph: "🔒" },
  process: { shape: "rect", fill: "#8b5cf6", fontColor: "#ffffff", glyph: "⚙️" },
  generic: { shape: "ellipse", fill: "#71717a", fontColor: "#ffffff", glyph: "📦" },
};

export const NODE_TYPE_OPTIONS = Object.entries(NODE_STYLES).map(
  ([value, style]) => ({
    value: value as NodeType,
    label: value.charAt(0).toUpperCase() + value.slice(1),
    glyph: style.glyph,
  }),
);
