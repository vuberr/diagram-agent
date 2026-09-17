import type { Graph } from "@/lib/graph/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles,
  Trash2,
  Copy,
  Check,
  FileDown,
  Layers,
  CheckCircle2,
  XCircle,
  Save,
  History,
  PenLine,
  Wand2,
  RefreshCw,
  GitBranch,
  ImageDown,
  FileCode2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAction, useMutation, useQuery } from "convex/react";
import { generateDot } from "@/lib/graph/dot-generator";
import { api } from "@/convex/_generated/api";
import { parseDot } from "@/lib/graph/dot-parser";
import { renderDotToSvg, validateDot } from "@/lib/graph/validator";
import { parseAiGraphResponse } from "@/lib/graph/ai-response";
import { EXAMPLES } from "@/lib/graph/examples";
import { NODE_TYPE_OPTIONS } from "@/lib/graph/styles";
import {
  NODE_TYPES,
  type GraphDirection,
  type GraphEdge,
  type GraphNode,
  type NodeType,
} from "@/lib/graph/types";

const DIRECTIONS: { value: GraphDirection; label: string }[] = [
  { value: "LR", label: "Left → Right" },
  { value: "TB", label: "Top → Bottom" },
  { value: "BT", label: "Bottom → Top" },
  { value: "RL", label: "Right → Left" },
];

const DOC_SECTIONS = [
  {
    title: "1. Describe",
    body: "Write a plain-language description of your system, network, or process. Entities become nodes; every “X does Y to Z” becomes a directed edge.",
  },
  {
    title: "2. Generate",
    body: "The AI agent extracts a structured graph (nodes, types, groups, relationships) — the app compiles sanitized GraphViz DOT and validates it with a real Graphviz WASM parser.",
  },
  {
    title: "3. Refine",
    body: "Iterate with the refinement chat (“add a Redis cache between…”) or edit nodes, edges and layout directly in the inspector panel.",
  },
  {
    title: "4. Export",
    body: "Download the validated DOT source or a rendered SVG/PNG. Diagrams are saved to your workspace and re-openable from the history.",
  },
];

type Validation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export default function Dashboard() {
  const { user } = useAuth();

  // ------------------------------------------------------------------
  // Graph pipeline state
  // ------------------------------------------------------------------
  const [description, setDescription] = useState("");
  const [graph, setGraph] = useState<Graph | null>(null);
  const [dot, setDot] = useState("");
  const [svg, setSvg] = useState<string | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [activeTab, setActiveTab] = useState<"diagram" | "dot">("diagram");
  const [copied, setCopied] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [showDoc, setShowDoc] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [savedGraphId, setSavedGraphId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null);

  const svgHostRef = useRef<HTMLDivElement>(null);

  // ------------------------------------------------------------------
  // Saved diagrams (Convex)
  // ------------------------------------------------------------------
  const graphs = useQuery(api.graphs.list, {}) ?? [];
  const createGraph = useMutation(api.graphs.create);
  const updateGraph = useMutation(api.graphs.update);
  const removeGraph = useMutation(api.graphs.remove);
  const generateAiGraph = useAction(api.graphsAi.generateGraph);
  const refineAiGraph = useAction(api.graphsAi.refineGraph);

  // Restore persisted theme preference
  useEffect(() => {
    try {
      if (localStorage.getItem("graphviz-theme") === "dark") {
        document.documentElement.classList.add("dark");
      }
    } catch {
      // ignore
    }
  }, []);

  const hasGraph = graph !== null;

  /** Compile + validate + render a structured graph, updating all state. */
  const regenerateDot = (g: Graph) => {
    const next = generateDot(g);
    setGraph(g);
    setDot(next);
    setDirty(true);
    setRendering(true);
    void (async () => {
      try {
        const result = await validateDot(next);
        setValidation(result);
        if (result.valid) {
          setSvg(await renderDotToSvg(next));
        } else {
          setSvg(null);
        }
      } catch (err) {
        setValidation({
          valid: false,
          errors: [err instanceof Error ? err.message : "Render failed"],
          warnings: [],
        });
        setSvg(null);
      } finally {
        setRendering(false);
      }
    })();
  };

  // ------------------------------------------------------------------
  // AI generation + refinement (Convex actions, server-side AI call)
  // ------------------------------------------------------------------

  const handleGenerate = async () => {
    const text = description.trim();
    if (!text) {
      toast.error("Please describe your system first.");
      return;
    }
    setGenerating(true);
    setRendering(true);
    try {
      const content = await generateAiGraph({ description: text });
      const parsed = parseAiGraphResponse(content);
      setGraph(parsed);
      setDirty(false);
      const compiled = generateDot(parsed);
      setDot(compiled);
      const result = await validateDot(compiled);
      setValidation(result);
      if (result.valid) {
        setSvg(await renderDotToSvg(compiled));
        setActiveTab("diagram");
      } else {
        setSvg(null);
        setActiveTab("dot");
      }
      try {
        const id = await createGraph({
          title: parsed.title,
          description: text,
          graph: parsed,
          dot: compiled,
        });
        setSavedGraphId(id);
      } catch {
        // Persistence is best-effort; workspace still works fully local.
      }
      toast.success(
        `Generated ${parsed.nodes.length} nodes and ${parsed.edges.length} edges.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI generation failed.");
      setRendering(false);
    } finally {
      setGenerating(false);
    }
  };

  const handleRefine = async () => {
    const instruction = refineInstruction.trim();
    if (!instruction || !graph) return;
    setRefining(true);
    try {
      const content = await refineAiGraph({
        graphJson: JSON.stringify(graph),
        instruction,
      });
      const parsed = parseAiGraphResponse(content);
      // Preserve manual edits where possible: keep richer node metadata.
      const merged: Graph = {
        ...parsed,
        nodes: parsed.nodes.map((n) => {
          const prev = graph.nodes.find((p) => p.id === n.id);
          return prev
            ? {
                ...n,
                type:
                  n.type === "generic" && prev.type !== "generic"
                    ? prev.type
                    : n.type,
                group: n.group ?? prev.group,
              }
            : n;
        }),
      };
      regenerateDot(merged);
      setRefineInstruction("");
      toast.success("Diagram refined.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "AI refinement failed.",
      );
    } finally {
      setRefining(false);
    }
  };

  const handleValidate = async () => {
    setRendering(true);
    try {
      const result = await validateDot(dot);
      setValidation(result);
      if (result.valid) {
        setSvg(await renderDotToSvg(dot));
        toast.success("DOT is valid — diagram re-rendered.");
      } else {
        setSvg(null);
        toast.error("DOT validation failed — see the error list.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Validation failed.");
    } finally {
      setRendering(false);
    }
  };

  const commitDot = async () => {
    const result = await validateDot(dot);
    setValidation(result);
    if (!result.valid) {
      toast.error("Fix DOT errors before applying to the graph.");
      return;
    }
    const parsed = parseDot(dot);
    if (!parsed) {
      toast.error("Could not parse DOT back into the graph structure.");
      return;
    }
    setGraph(parsed);
    setSvg(await renderDotToSvg(dot));
    setDirty(true);
    toast.success("DOT applied — graph structure updated.");
  };

  // ------------------------------------------------------------------
  // Node / edge editing
  // ------------------------------------------------------------------
  const addNode = () => {
    if (!graph) return;
    const taken = new Set(graph.nodes.map((n) => n.id));
    let i = 1;
    while (taken.has(`new_node_${i}`)) i += 1;
    const node: GraphNode = {
      id: `new_node_${i}`,
      label: `New Node ${i}`,
      type: "generic",
    };
    regenerateDot({ ...graph, nodes: [...graph.nodes, node] });
    setSelectedNodeId(node.id);
  };

  const addEdge = () => {
    if (!graph || graph.nodes.length < 2) {
      toast.error("Add at least two nodes before creating an edge.");
      return;
    }
    const a = graph.nodes[0].id;
    const b = graph.nodes[1].id;
    const key = `${a}->${b}`;
    if (graph.edges.some((e) => e.source === a && e.target === b)) {
      toast.error("That edge already exists.");
      return;
    }
    const edge: GraphEdge = { source: a, target: b };
    regenerateDot({ ...graph, edges: [...graph.edges, edge] });
    setSelectedEdgeKey(key);
  };

  const updateNode = (id: string, patch: Partial<GraphNode>) => {
    if (!graph) return;
    regenerateDot({
      ...graph,
      nodes: graph.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    });
  };

  const deleteNode = (id: string) => {
    if (!graph) return;
    regenerateDot({
      ...graph,
      nodes: graph.nodes.filter((n) => n.id !== id),
      edges: graph.edges.filter((e) => e.source !== id && e.target !== id),
    });
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const updateEdge = (key: string, patch: Partial<GraphEdge>) => {
    if (!graph) return;
    regenerateDot({
      ...graph,
      edges: graph.edges.map((e) =>
        `${e.source}->${e.target}` === key ? { ...e, ...patch } : e,
      ),
    });
  };

  const deleteEdge = (key: string) => {
    if (!graph) return;
    regenerateDot({
      ...graph,
      edges: graph.edges.filter((e) => `${e.source}->${e.target}` !== key),
    });
    if (selectedEdgeKey === key) setSelectedEdgeKey(null);
  };

  // ------------------------------------------------------------------
  // Export helpers
  // ------------------------------------------------------------------
  const copyDot = async () => {
    try {
      await navigator.clipboard.writeText(dot);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Clipboard unavailable in this browser.");
    }
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadDot = () => {
    if (!dot) return;
    triggerDownload(new Blob([dot], { type: "text/vnd.graphviz" }), "diagram.dot");
  };

  const downloadSvg = () => {
    if (!svg) return;
    triggerDownload(new Blob([svg], { type: "image/svg+xml" }), "diagram.svg");
  };

  const exportPng = async () => {
    const target = svgHostRef.current?.querySelector("svg");
    if (!svg || !target) return;
    try {
      const mod = (await import(
        /* @vite-ignore */ "@zumer/snapdom"
      )) as unknown as {
        snapdom: (el: Element, opts?: unknown) => {
          toPng: (opts?: unknown) => Promise<HTMLCanvasElement>;
        };
      };
      const capture = mod.snapdom(target, { scale: 2 });
      const canvas = await capture.toPng({ scale: 2 });
      canvas.toBlob((blob) => {
        if (blob) triggerDownload(blob, "diagram.png");
      });
      toast.success("PNG exported.");
    } catch {
      toast.error("PNG export failed in this browser.");
    }
  };

  // ------------------------------------------------------------------
  // Save / reset / history
  // ------------------------------------------------------------------
  const saveCurrent = async () => {
    if (!graph) return;
    try {
      if (savedGraphId && dirty) {
        await updateGraph({ id: savedGraphId as never, graph, dot });
        toast.success("Diagram updated.");
      } else if (!savedGraphId) {
        const id = await createGraph({
          title: graph.title,
          description: description || graph.title,
          graph,
          dot,
        });
        setSavedGraphId(id);
        toast.success("Diagram saved to your workspace.");
      } else {
        toast.info("No unsaved changes.");
        return;
      }
      setDirty(false);
    } catch {
      toast.error("Could not save — is your session still active?");
    }
  };

  const loadSaved = (doc: (typeof graphs)[number]) => {
    const g = doc.graph as Graph;
    setGraph(g);
    setDot(doc.dot);
    setDescription(doc.description);
    setSavedGraphId(doc._id);
    setDirty(false);
    setSelectedNodeId(null);
    setSelectedEdgeKey(null);
    setShowExamples(false);
    setRendering(true);
    void (async () => {
      const result = await validateDot(doc.dot);
      setValidation(result);
      if (result.valid) setSvg(await renderDotToSvg(doc.dot));
      else setSvg(null);
      setRendering(false);
    })();
    setActiveTab("diagram");
  };

  const deleteSaved = async (id: string) => {
    try {
      await removeGraph({ id: id as never });
      if (savedGraphId === id) setSavedGraphId(null);
      toast.success("Diagram deleted.");
    } catch {
      toast.error("Delete failed.");
    }
  };

  const resetWorkspace = () => {
    setGraph(null);
    setDot("");
    setSvg(null);
    setValidation(null);
    setDescription("");
    setSavedGraphId(null);
    setDirty(false);
    setSelectedNodeId(null);
    setSelectedEdgeKey(null);
    setZoom(1);
  };

  // ------------------------------------------------------------------
  // Derived data
  // ------------------------------------------------------------------
  const typeCounts = useMemo(() => {
    if (!graph) return [] as [NodeType, number][];
    const counts = new Map<NodeType, number>();
    for (const n of graph.nodes) {
      counts.set(n.type, (counts.get(n.type) ?? 0) + 1);
    }
    return Array.from(counts.entries());
  }, [graph]);

  const selectedNode = graph?.nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedEdge =
    graph?.edges.find((e) => `${e.source}->${e.target}` === selectedEdgeKey) ??
    null;

  const svgElement = useMemo(() => (svg ? { __html: svg } : null), [svg]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* ============================= HEADER ============================= */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-card/60 px-3 backdrop-blur sm:px-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GitBranch className="size-4" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-tight">
              Text-to-GraphViz Agent
            </div>
            <div className="hidden text-[10px] text-muted-foreground sm:block">
              NL → structured graph → DOT → rendered diagram
            </div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            onClick={() => {
              resetWorkspace();
              toast.success("Workspace cleared.");
            }}
          >
            <Trash2 className="size-3.5" /> Clear
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            onClick={() => setShowExamples((s) => !s)}
          >
            <History className="size-3.5" /> Examples
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            onClick={() => setShowDoc((s) => !s)}
          >
            <FileCode2 className="size-3.5" /> Docs
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={!hasGraph}
            onClick={() => void saveCurrent()}
          >
            <Save className="size-3.5" /> Save
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              resetWorkspace();
              toast.info("New diagram started.");
            }}
          >
            <Sparkles className="size-3.5" /> New Diagram
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {/* ============================ WORKSPACE =========================== */}
      <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
        {/* ------------------------- LEFT: INPUT ------------------------- */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={55}>
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-4 p-4">
              <div>
                <h2 className="text-sm font-semibold tracking-tight">
                  Describe Your System
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Natural language in, validated GraphViz DOT out.
                </p>
              </div>

              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void handleGenerate();
                  }
                }}
                placeholder="Describe your system, architecture, workflow, network, or process in natural language..."
                className="min-h-[140px] resize-y leading-relaxed"
                disabled={generating}
              />

              <div>
                <Button
                  className="w-full gap-2"
                  onClick={() => void handleGenerate()}
                  disabled={generating || !description.trim()}
                >
                  {generating ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      Generate Diagram
                    </>
                  )}
                </Button>
                <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                  ⌘/Ctrl + Enter to generate
                </p>
              </div>

              {/* Example prompts */}
              <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold">Example prompts</span>
                  <span className="text-[10px] text-muted-foreground">
                    click to fill
                  </span>
                </div>
                <div className="grid gap-1.5">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => setDescription(ex.description)}
                      className="group rounded-md border border-transparent bg-background/60 px-2.5 py-2 text-left transition-colors hover:border-border hover:bg-background"
                    >
                      <div className="text-xs font-medium group-hover:text-primary">
                        {ex.title}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {ex.blurb}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Node type legend */}
              {typeCounts.length > 0 && (
                <div className="rounded-lg border border-border/60 p-3">
                  <div className="mb-2 text-xs font-semibold">Node types</div>
                  <div className="flex flex-wrap gap-1">
                    {typeCounts.map(([type, count]) => (
                      <Badge
                        key={type}
                        variant="secondary"
                        className="text-[10px]"
                      >
                        {type} × {count}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ------------------------- MIDDLE: RENDER ------------------------- */}
        <ResizablePanel defaultSize={45} minSize={25}>
          <div className="flex h-full flex-col">
            {/* Toolbar */}
            <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border/70 bg-card/40 px-2">
              <Button
                size="sm"
                variant={activeTab === "diagram" ? "secondary" : "ghost"}
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={() => setActiveTab("diagram")}
              >
                <Layers className="size-3.5" /> Diagram
              </Button>
              <Button
                size="sm"
                variant={activeTab === "dot" ? "secondary" : "ghost"}
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={() => setActiveTab("dot")}
              >
                <FileCode2 className="size-3.5" /> DOT
              </Button>
              <div className="mx-1 h-4 w-px bg-border" />
              {activeTab === "diagram" ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={!svg}
                    onClick={downloadSvg}
                  >
                    <ImageDown className="size-3.5" /> SVG
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={!svg}
                    onClick={() => void exportPng()}
                  >
                    <ImageDown className="size-3.5" /> PNG
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={!dot}
                    onClick={downloadDot}
                  >
                    <FileDown className="size-3.5" /> .dot
                  </Button>
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
                    >
                      −
                    </Button>
                    <span className="w-10 text-center text-[10px] text-muted-foreground">
                      {Math.round(zoom * 100)}%
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))}
                    >
                      +
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => void copyDot()}
                    disabled={!dot}
                  >
                    {copied ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={!dot}
                    onClick={downloadDot}
                  >
                    <FileDown className="size-3.5" /> .dot
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={!dot || rendering}
                    onClick={() => void handleValidate()}
                  >
                    {rendering ? (
                      <RefreshCw className="size-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3.5" />
                    )}
                    Validate & Render
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={!dot}
                    onClick={() => void commitDot()}
                  >
                    Apply to graph
                  </Button>
                </>
              )}
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-auto bg-muted/20">
              {activeTab === "diagram" ? (
                <div className="flex min-h-full w-full items-start justify-center p-4">
                  {generating || rendering ? (
                    <div className="mt-10 flex flex-col items-center gap-3">
                      <Skeleton className="h-10 w-56" />
                      <Skeleton className="h-40 w-72" />
                      <Skeleton className="h-40 w-64" />
                      <span className="text-xs text-muted-foreground">
                        Analyzing description → building graph → rendering…
                      </span>
                    </div>
                  ) : svg && svgElement ? (
                    <div
                      ref={svgHostRef}
                      style={{
                        transform: `scale(${zoom})`,
                        transformOrigin: "top center",
                      }}
                      className="w-full max-w-full [&_svg]:h-auto [&_svg]:max-w-full"
                      dangerouslySetInnerHTML={svgElement}
                    />
                  ) : validation && !validation.valid ? (
                    <div className="m-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                        <XCircle className="size-4" /> Diagram failed validation
                      </div>
                      <ul className="mt-2 list-disc pl-5 text-xs text-destructive/80">
                        {validation.errors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="mt-16 flex flex-col items-center gap-3 px-6 text-center text-muted-foreground">
                      <GitBranch className="size-10 opacity-30" />
                      <p className="max-w-xs text-sm">
                        Describe a system on the left and press{" "}
                        <span className="font-semibold text-foreground">
                          Generate Diagram
                        </span>{" "}
                        — the AI agent will extract the entities and
                        relationships for you.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-full flex-col">
                  <textarea
                    value={dot}
                    onChange={(e) => {
                      setDot(e.target.value);
                      setDirty(true);
                    }}
                    spellCheck={false}
                    className="h-full w-full flex-1 resize-none bg-background p-4 font-mono text-xs leading-relaxed outline-none"
                    placeholder="digraph { … } — generated DOT will appear here"
                  />
                  {validation && (
                    <div
                      className={`shrink-0 border-t px-4 py-2 text-xs ${
                        validation.valid
                          ? "border-border/70 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "border-destructive/40 bg-destructive/10 text-destructive"
                      }`}
                    >
                      {validation.valid
                        ? `✓ Valid DOT (${validation.warnings.length} warning${
                            validation.warnings.length === 1 ? "" : "s"
                          })`
                        : `✗ ${validation.errors.length} error${
                            validation.errors.length === 1 ? "" : "s"
                          }: ${validation.errors[0] ?? ""}`}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Pipeline status bar */}
            <div className="flex h-8 shrink-0 items-center gap-3 border-t border-border/70 bg-card/40 px-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                {validation?.valid ? (
                  <CheckCircle2 className="size-3 text-emerald-500" />
                ) : validation && !validation.valid ? (
                  <XCircle className="size-3 text-destructive" />
                ) : (
                  <span className="inline-block size-2 rounded-full bg-muted-foreground/40" />
                )}
                {validation
                  ? validation.valid
                    ? "DOT valid"
                    : "DOT invalid"
                  : "not validated"}
              </span>
              <span className="h-3 w-px bg-border" />
              <span>{graph ? `${graph.nodes.length} nodes` : "no graph"}</span>
              <span className="h-3 w-px bg-border" />
              <span>{graph ? `${graph.edges.length} edges` : "—"}</span>
              <span className="ml-auto">{dirty ? "unsaved changes" : ""}</span>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ------------------------- RIGHT: INSPECTOR ------------------------- */}
        <ResizablePanel defaultSize={25} minSize={18} maxSize={45}>
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-3 p-4">
              <h2 className="text-sm font-semibold tracking-tight">Inspector</h2>

              {!hasGraph ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Generate or load a diagram to inspect and edit its structured
                  graph — nodes, typed styling, groups, edges and layout
                  direction.
                </p>
              ) : (
                <>
                  {/* Refinement chat */}
                  <div className="rounded-lg border border-border/60 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                      <Wand2 className="size-3.5 text-primary" />
                      Refine with AI
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        value={refineInstruction}
                        onChange={(e) => setRefineInstruction(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleRefine();
                        }}
                        placeholder="e.g. add a Redis cache in front of the database"
                        className="h-8 text-xs"
                        disabled={refining}
                      />
                      <Button
                        size="sm"
                        className="h-8 px-2"
                        disabled={refining || !refineInstruction.trim()}
                        onClick={() => void handleRefine()}
                      >
                        {refining ? (
                          <RefreshCw className="size-3.5 animate-spin" />
                        ) : (
                          <PenLine className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Title + direction */}
                  <div className="rounded-lg border border-border/60 p-3">
                    <div className="mb-2 text-xs font-semibold">
                      Graph settings
                    </div>
                    <label className="text-[10px] text-muted-foreground">
                      Title
                    </label>
                    <Input
                      value={graph?.title ?? ""}
                      onChange={(e) =>
                        graph && setGraph({ ...graph, title: e.target.value })
                      }
                      className="mb-2 h-8 text-xs"
                    />
                    <label className="text-[10px] text-muted-foreground">
                      Direction
                    </label>
                    <div className="mt-1 grid grid-cols-2 gap-1">
                      {DIRECTIONS.map((d) => (
                        <Button
                          key={d.value}
                          size="sm"
                          variant={
                            graph?.direction === d.value ? "default" : "outline"
                          }
                          className="h-7 text-[10px]"
                          onClick={() =>
                            graph && regenerateDot({ ...graph, direction: d.value })
                          }
                        >
                          {d.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Nodes */}
                  <div className="rounded-lg border border-border/60 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold">
                        Nodes ({graph?.nodes.length ?? 0})
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 gap-1 px-1.5 text-[10px]"
                        onClick={addNode}
                      >
                        + Add
                      </Button>
                    </div>
                    <div className="flex flex-col gap-1">
                      {graph?.nodes.map((n) => (
                        <div
                          key={n.id}
                          className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                            selectedNodeId === n.id
                              ? "border-primary/60 bg-primary/5"
                              : "border-transparent hover:bg-muted/60"
                          }`}
                        >
                          <button
                            type="button"
                            className="flex-1 truncate text-left text-[11px]"
                            onClick={() => {
                              setSelectedNodeId(
                                selectedNodeId === n.id ? null : n.id,
                              );
                              setSelectedEdgeKey(null);
                            }}
                          >
                            {n.label}
                          </button>
                          <button
                            type="button"
                            aria-label="Delete node"
                            className="text-muted-foreground/50 hover:text-destructive"
                            onClick={() => deleteNode(n.id)}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {selectedNode && (
                      <div className="mt-2 rounded-md bg-muted/50 p-2">
                        <label className="text-[10px] text-muted-foreground">
                          Label
                        </label>
                        <Input
                          value={selectedNode.label}
                          onChange={(e) =>
                            updateNode(selectedNode.id, {
                              label: e.target.value,
                            })
                          }
                          className="mb-1.5 h-7 text-xs"
                        />
                        <label className="text-[10px] text-muted-foreground">
                          Type
                        </label>
                        <select
                          value={selectedNode.type}
                          onChange={(e) =>
                            updateNode(selectedNode.id, {
                              type: e.target.value as NodeType,
                            })
                          }
                          className="mb-1.5 h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
                        >
                          {NODE_TYPE_OPTIONS.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.glyph} {t.label}
                            </option>
                          ))}
                        </select>
                        <label className="text-[10px] text-muted-foreground">
                          Group (optional)
                        </label>
                        <Input
                          value={selectedNode.group ?? ""}
                          onChange={(e) =>
                            updateNode(selectedNode.id, {
                              group: e.target.value || undefined,
                            })
                          }
                          placeholder="e.g. Data Layer"
                          className="h-7 text-xs"
                        />
                      </div>
                    )}
                  </div>

                  {/* Edges */}
                  <div className="rounded-lg border border-border/60 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold">
                        Edges ({graph?.edges.length ?? 0})
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 gap-1 px-1.5 text-[10px]"
                        onClick={addEdge}
                      >
                        + Add
                      </Button>
                    </div>
                    <div className="flex flex-col gap-1">
                      {graph?.edges.map((e) => {
                        const key = `${e.source}->${e.target}`;
                        const src =
                          graph.nodes.find((n) => n.id === e.source)?.label ??
                          e.source;
                        const tgt =
                          graph.nodes.find((n) => n.id === e.target)?.label ??
                          e.target;
                        return (
                          <div
                            key={key}
                            className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                              selectedEdgeKey === key
                                ? "border-primary/60 bg-primary/5"
                                : "border-transparent hover:bg-muted/60"
                            }`}
                          >
                            <button
                              type="button"
                              className="flex-1 truncate text-left text-[11px]"
                              onClick={() => {
                                setSelectedEdgeKey(
                                  selectedEdgeKey === key ? null : key,
                                );
                                setSelectedNodeId(null);
                              }}
                            >
                              <span className="font-medium">{src}</span>
                              <span className="mx-1 text-muted-foreground">
                                →
                              </span>
                              <span className="font-medium">{tgt}</span>
                            </button>
                            <button
                              type="button"
                              aria-label="Delete edge"
                              className="text-muted-foreground/50 hover:text-destructive"
                              onClick={() => deleteEdge(key)}
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {selectedEdge && (
                      <div className="mt-2 rounded-md bg-muted/50 p-2">
                        <label className="text-[10px] text-muted-foreground">
                          Label
                        </label>
                        <Input
                          value={selectedEdge.label ?? ""}
                          onChange={(e) =>
                            updateEdge(
                              `${selectedEdge.source}->${selectedEdge.target}`,
                              { label: e.target.value || undefined },
                            )
                          }
                          placeholder="e.g. queries"
                          className="mb-1.5 h-7 text-xs"
                        />
                        <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={!!selectedEdge.dashed}
                            onChange={(e) =>
                              updateEdge(
                                `${selectedEdge.source}->${selectedEdge.target}`,
                                { dashed: e.target.checked },
                              )
                            }
                          />
                          dashed line
                        </label>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* ====================== EXAMPLES / HISTORY DRAWER ====================== */}
      {showExamples && (
        <div
          className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
          onClick={() => setShowExamples(false)}
        >
          <div
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
              <span className="text-sm font-semibold">
                Saved diagrams & starter examples
              </span>
              <Button size="sm" variant="ghost" onClick={() => setShowExamples(false)}>
                ✕
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-2 p-4">
                {graphs.length > 0 && (
                  <div className="mb-1 text-xs font-semibold text-muted-foreground">
                    Your saved diagrams
                  </div>
                )}
                {graphs.map((g) => (
                  <div
                    key={g._id}
                    className="flex items-center gap-2 rounded-lg border p-2.5"
                  >
                    <button
                      type="button"
                      className="flex-1 text-left"
                      onClick={() => loadSaved(g)}
                    >
                      <div className="text-xs font-medium">{g.title}</div>
                      <div className="line-clamp-1 text-[10px] text-muted-foreground">
                        {g.description}
                      </div>
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-1.5"
                      onClick={() => void deleteSaved(g._id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="mb-1 mt-3 text-xs font-semibold text-muted-foreground">
                  Starter descriptions
                </div>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    className="rounded-lg border p-2.5 text-left transition-colors hover:bg-muted/50"
                    onClick={() => {
                      setDescription(ex.description);
                      setShowExamples(false);
                      toast.success("Example loaded into the input panel.");
                    }}
                  >
                    <div className="text-xs font-medium">{ex.title}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {ex.blurb}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}

      {/* ============================ DOCS DRAWER ============================ */}
      {showDoc && (
        <div
          className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
          onClick={() => setShowDoc(false)}
        >
          <div
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
              <span className="text-sm font-semibold">Documentation</span>
              <Button size="sm" variant="ghost" onClick={() => setShowDoc(false)}>
                ✕
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-4 p-4">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Text-to-GraphViz Agent converts plain-language descriptions
                  into structured node-edge graphs, compiles sanitized DOT, and
                  validates it with a real Graphviz (WASM) parser before
                  rendering. {user?.email ? `Signed in as ${user.email}.` : ""}
                </p>
                {DOC_SECTIONS.map((s) => (
                  <div key={s.title}>
                    <div className="text-xs font-semibold">{s.title}</div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {s.body}
                    </p>
                  </div>
                ))}
                <div className="rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed">
                  <div className="mb-1 font-semibold">Pipeline guarantees</div>
                  <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                    <li>AI output is JSON-parsed and sanitized before use.</li>
                    <li>
                      Node ids are restricted to [A-Za-z0-9_], never raw user
                      text.
                    </li>
                    <li>
                      Dangling edges are dropped; duplicate ids are
                      de-duplicated.
                    </li>
                    <li>Rendering only happens after Graphviz accepts the DOT.</li>
                  </ul>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}
