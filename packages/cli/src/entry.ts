import { detectRuntime, getRuntimeDisplayName } from "./runtime.js";

const main = async (): Promise<void> => {
  const runtime = detectRuntime();

  console.info(`Running on ${getRuntimeDisplayName(runtime)}`);

  // Only load tsx in Node.js - Deno and Bun have native TypeScript support
  if (runtime === "node") {
    await import("./tsx-loader.js");
  }

  await import("./cli.js");
};

main().catch((error: unknown) => {
  console.error("Failed to start TypeWeaver CLI:", error);
  process.exit(1);
});
