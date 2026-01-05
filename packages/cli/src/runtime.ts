declare const Deno: unknown;
declare const Bun: unknown;

export type Runtime = "node" | "deno" | "bun";

export const detectRuntime = (): Runtime => {
  if (typeof Deno !== "undefined") return "deno";
  if (typeof Bun !== "undefined") return "bun";
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
