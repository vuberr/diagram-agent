import { useState } from "react";

/**
 * Dark/light theme toggle for the workspace. Keeps a local class toggle on
 * document.documentElement ("dark") — the CSS custom-variant is class-based.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"),
  );

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("graphviz-theme", next ? "dark" : "light");
    } catch {
      // ignore storage failures
    }
  };

  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      onClick={toggle}
      className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {dark ? "☀" : "🌙"}
    </button>
  );
}
