"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { vly } from "../lib/vly-integrations";
import { AI_SYSTEM_PROMPT } from "../lib/graph/ai-response";
const MODEL = "gpt-4o-mini";

/**
 * Natural language → structured graph JSON. The response is returned raw for
 * client-side sanitization (parseAiGraphResponse); the client then compiles
 * DOT and validates it with the real Graphviz parser.
 */
export const generateGraph = action({
  args: { description: v.string() },
  handler: async (ctx, { description }) => {
    await requireUser(ctx);
    const text = description.trim().slice(0, 4000);
    if (!text) throw new Error("Description is empty.");

    const result = await vly.ai.completion({
      model: MODEL,
      messages: [
        { role: "system", content: AI_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Convert this description into a graph:\n\n${text}`,
        },
      ],
      temperature: 0.2,
      maxTokens: 2000,
    });

    if (!result.success || !result.data) {
      throw new Error(result.error || "AI generation failed.");
    }
    const content = result.data.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI returned an empty response.");
    return content;
  },
});

/**
 * Refinement chat: existing graph JSON + instruction → new structured graph
 * JSON. Same sanitization contract as generateGraph.
 */
export const refineGraph = action({
  args: {
    graphJson: v.string(),
    instruction: v.string(),
  },
  handler: async (ctx, { graphJson, instruction }) => {
    await requireUser(ctx);
    const instructionText = instruction.trim().slice(0, 1000);
    if (!instructionText) throw new Error("Instruction is empty.");

    const result = await vly.ai.completion({
      model: MODEL,
      messages: [
        { role: "system", content: AI_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Here is the current graph as JSON:\n\n${graphJson.slice(0, 8000)}\n\nApply this refinement and return the full updated graph JSON:\n${instructionText}`,
        },
      ],
      temperature: 0.2,
      maxTokens: 2000,
    });

    if (!result.success || !result.data) {
      throw new Error(result.error || "AI refinement failed.");
    }
    const content = result.data.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI returned an empty response.");
    return content;
  },
});

import type { ActionCtx } from "./_generated/server";

async function requireUser(ctx: ActionCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated.");
}
