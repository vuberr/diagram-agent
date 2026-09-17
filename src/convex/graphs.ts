import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** List the current user's diagrams, newest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("graphs")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/** Fetch one diagram owned by the current user. */
export const get = query({
  args: { id: v.id("graphs") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const doc = await ctx.db.get(id);
    if (!doc || doc.userId !== userId) return null;
    return doc;
  },
});

/** Create a diagram after successful AI generation. */
export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    graph: v.any(),
    dot: v.string(),
  },
  handler: async (ctx, { title, description, graph, dot }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated.");
    const now = Date.now();
    return await ctx.db.insert("graphs", {
      userId,
      title: title.slice(0, 80),
      description: description.slice(0, 4000),
      graph,
      dot,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Overwrite title / graph / dot for an owned diagram. */
export const update = mutation({
  args: {
    id: v.id("graphs"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    graph: v.optional(v.any()),
    dot: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated.");
    const doc = await ctx.db.get(id);
    if (!doc || doc.userId !== userId) throw new Error("Diagram not found.");
    const clean: Record<string, unknown> = { updatedAt: Date.now() };
    if (patch.title !== undefined) clean.title = patch.title.slice(0, 80);
    if (patch.description !== undefined)
      clean.description = patch.description.slice(0, 4000);
    if (patch.graph !== undefined) clean.graph = patch.graph;
    if (patch.dot !== undefined) clean.dot = patch.dot;
    await ctx.db.patch(id, clean);
  },
});

/** Delete an owned diagram. */
export const remove = mutation({
  args: { id: v.id("graphs") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated.");
    const doc = await ctx.db.get(id);
    if (!doc || doc.userId !== userId) throw new Error("Diagram not found.");
    await ctx.db.delete(id);
  },
});
