import type { DotValidationResult } from "./types";
import type { Viz } from "@viz-js/viz";

let vizInstance: Promise<Viz> | null = null;

/** Lazily instantiate the Graphviz WASM instance (shared app-wide). */
export function getViz(): Promise<Viz> {
  if (!vizInstance) {
    vizInstance = import("@viz-js/viz").then((m) => m.instance());
  }
  return vizInstance;
}

/**
 * Validate DOT source using the real Graphviz parser compiled to WebAssembly.
 * Returns syntax errors and warnings without throwing.
 */
export async function validateDot(dot: string): Promise<DotValidationResult> {
  const result: DotValidationResult = { valid: false, errors: [], warnings: [] };
  if (!dot.trim()) {
    result.errors.push("DOT source is empty.");
    return result;
  }
  try {
    const viz = await getViz();
    const rendered = viz.render(dot, { format: "svg" });
    if (rendered.status === "success") {
      result.valid = true;
      for (const err of rendered.errors) {
        if (err.level === "warning") result.warnings.push(err.message);
      }
    } else {
      for (const err of rendered.errors) {
        result.errors.push(err.message);
      }
      if (result.errors.length === 0) {
        result.errors.push("Graphviz failed to parse the DOT source.");
      }
    }
  } catch (err) {
    result.errors.push(
      err instanceof Error ? err.message : "Unknown Graphviz error.",
    );
  }
  return result;
}

/** Render DOT to an SVG string; throws with Graphviz messages on failure. */
export async function renderDotToSvg(dot: string): Promise<string> {
  const viz = await getViz();
  const rendered = viz.render(dot, { format: "svg" });
  if (rendered.status !== "success") {
    const messages = rendered.errors.map((e) => e.message).join("; ");
    throw new Error(messages || "Graphviz render failed.");
  }
  return rendered.output;
}
