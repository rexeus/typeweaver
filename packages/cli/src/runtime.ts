export type Runtime = "node" | "deno" | "bun";

export const detectRuntime = (): Runtime => {
  if ("Deno" in globalThis) return "deno";
  if ("Bun" in globalThis) return "bun";
  return "node";
};

export const getRuntimeDisplayName = (runtime: Runtime): string => {
  const names: Record<Runtime, string> = {
    node: "Node.js",
    deno: "Deno",
    bun: "Bun",
  };
  return names[runtime];
};
