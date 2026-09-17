import { motion } from "framer-motion";
import { Link } from "react-router";
import { ArrowRight, GitBranch, Workflow, ShieldCheck, Sparkles, FileDown, Boxes, MousePointerClick } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

const PIPELINE = [
  { icon: MousePointerClick, label: "Describe", detail: "Plain language system description" },
  { icon: Sparkles, label: "AI analysis", detail: "Entities & relationships extracted" },
  { icon: Boxes, label: "Structured graph", detail: "Typed nodes, labeled edges, groups" },
  { icon: Workflow, label: "DOT generation", detail: "Sanitized GraphViz source" },
  { icon: ShieldCheck, label: "Validation", detail: "Real Graphviz WASM parser" },
  { icon: FileDown, label: "Export", detail: "SVG · PNG · .dot" },
];

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI agent, not templates",
    body: "A language-model agent reads your description and extracts the actual entities and relationships you wrote — nothing pre-baked.",
  },
  {
    icon: Workflow,
    title: "Real GraphViz rendering",
    body: "Generated DOT is compiled and laid out by Graphviz running as WebAssembly in your browser. If Graphviz can't parse it, you don't see it.",
  },
  {
    icon: ShieldCheck,
    title: "Validated & sanitized",
    body: "Identifiers are normalized, dangling edges dropped, and the JSON from the model is parsed and checked before anything renders.",
  },
  {
    icon: GitBranch,
    title: "Refine by chatting",
    body: "“Add a Redis cache in front of the database.” The agent rewrites the structured graph and re-renders instantly.",
  },
  {
    icon: Boxes,
    title: "14 node types",
    body: "Actors, clients, servers, databases, queues, caches, gateways, networks and more — each with distinct shape and color.",
  },
  {
    icon: FileDown,
    title: "Own your output",
    body: "Copy the DOT, download SVG or PNG, or save the diagram to your workspace and reopen it anytime.",
  },
];

const SAMPLE_INPUT =
  "A customer accesses the web application through the internet. The web server communicates with an API server. The API server reads and writes data to a PostgreSQL database.";

const DEMO_NODES = [
  { x: 6, y: 8, w: 150, label: "Customer", sub: "actor", cls: "demo-node-actor" },
  { x: 26, y: 4, w: 130, label: "Internet", sub: "network", cls: "demo-node-network" },
  { x: 46, y: 10, w: 160, label: "Web App", sub: "client", cls: "demo-node-client" },
  { x: 46, y: 55, w: 160, label: "API Server", sub: "server", cls: "demo-node-server" },
  { x: 78, y: 50, w: 165, label: "PostgreSQL", sub: "database", cls: "demo-node-db" },
];

const DEMO_EDGES = [
  { x1: 19, y1: 16, x2: 26.5, y2: 12 },
  { x1: 39, y1: 12, x2: 46.5, y2: 17 },
  { x1: 56, y1: 26, x2: 56, y2: 55 },
  { x1: 70, y1: 19, x2: 79, y2: 50 },
];

function HeroDiagram() {
  return (
    <div className="demo-canvas relative aspect-[16/10] w-full overflow-hidden rounded-xl border bg-card/70 shadow-sm">
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="demo-edge-arrow" />
          </marker>
        </defs>
        {DEMO_EDGES.map((e, i) => (
          <line
            key={i}
            x1={`${e.x1}%`}
            y1={`${e.y1}%`}
            x2={`${e.x2}%`}
            y2={`${e.y2}%`}
            className="demo-edge"
            markerEnd="url(#arrow)"
          />
        ))}
      </svg>
      {DEMO_NODES.map((n, i) => (
        <motion.div
          key={n.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 + i * 0.15, duration: 0.45 }}
          style={{ left: `${n.x}%`, top: `${n.y}%`, width: n.w }}
          className={`demo-node absolute rounded-lg border px-3 py-2 text-left shadow-sm ${n.cls}`}
        >
          <div className="text-xs font-semibold leading-tight">{n.label}</div>
          <div className="text-[10px] opacity-70">{n.sub}</div>
        </motion.div>
      ))}
    </div>
  );
}

export default function Landing() {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i += 1;
      setTyped(SAMPLE_INPUT.slice(0, i));
      if (i < SAMPLE_INPUT.length) {
        timer = setTimeout(tick, SAMPLE_INPUT[i - 1] === "." ? 700 : 24);
      }
    };
    timer = setTimeout(tick, 900);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="landing min-h-screen bg-background text-foreground">
      {/* ============================ NAV ============================ */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GitBranch className="size-4" />
            </div>
            <span className="text-sm font-bold tracking-tight">
              Text-to-GraphViz Agent
            </span>
          </div>
          <nav className="ml-auto flex items-center gap-1.5">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/auth">
                Get started <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* ============================ HERO ============================ */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-14 lg:grid-cols-2 lg:gap-14 lg:pt-20">
        <div>
          <Badge variant="outline" className="mb-5 gap-1.5 border-primary/40 text-primary">
            <Sparkles className="size-3" />
            AI-powered diagram generation
          </Badge>
          <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
            Describe your system.{" "}
            <span className="text-primary">Get a real diagram.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
            Type how your architecture, network, or process works in plain
            English. An AI agent extracts the entities and relationships,
            compiles validated GraphViz DOT, and renders a polished diagram you
            can refine and export.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link to="/auth">
                Start diagramming <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/dashboard">Open workspace</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Natural language → structured graph → DOT → SVG. No diagramming
            skills required.
          </p>
        </div>

        {/* Hero visual: typed description + animated diagram */}
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border bg-card/70 p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-red-400/70" />
              <span className="size-2 rounded-full bg-yellow-400/70" />
              <span className="size-2 rounded-full bg-green-400/70" />
              <span className="ml-2 text-[10px] text-muted-foreground">
                describe-your-system.txt
              </span>
            </div>
            <p className="min-h-[3.6rem] font-mono text-xs leading-relaxed text-foreground/85">
              {typed}
              <span className="ml-0.5 inline-block h-3.5 w-[7px] animate-pulse bg-primary align-middle" />
            </p>
          </div>
          <HeroDiagram />
        </div>
      </section>

      {/* ============================ PIPELINE ============================ */}
      <section className="border-y bg-muted/30 py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            One pipeline, every step real
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted-foreground">
            Nothing is simulated — each stage produces a genuine artifact you can
            inspect in the workspace.
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {PIPELINE.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
                className="relative rounded-lg border bg-card p-4"
              >
                <div className="mb-2 text-[10px] font-semibold text-muted-foreground">
                  STEP {i + 1}
                </div>
                <step.icon className="mb-2 size-5 text-primary" />
                <div className="text-sm font-semibold">{step.label}</div>
                <div className="mt-1 text-xs leading-snug text-muted-foreground">
                  {step.detail}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ FEATURES ============================ */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold tracking-tight">
          Built like a tool, not a demo
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 3) * 0.07, duration: 0.4 }}
              className="rounded-xl border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="size-4" />
              </div>
              <div className="text-sm font-semibold">{f.title}</div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {f.body}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ============================ CTA ============================ */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="rounded-2xl border bg-card p-8 text-center shadow-sm sm:p-12">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Your next architecture diagram is a sentence away
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Sign in, describe a system, and walk away with validated DOT and a
            rendered diagram in seconds.
          </p>
          <div className="mt-6 flex justify-center">
            <Button asChild size="lg" className="gap-2">
              <Link to="/auth">
                Create your first diagram <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 text-xs text-muted-foreground">
          <span>Text-to-GraphViz Agent</span>
          <span>Natural language diagrams, powered by Graphviz WASM</span>
        </div>
      </footer>
    </div>
  );
}
