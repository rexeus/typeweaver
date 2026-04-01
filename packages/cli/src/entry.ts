import { detectRuntime, getRuntimeDisplayName } from "./runtime.js";

const main = async (): Promise<void> => {
  const runtime = detectRuntime();

  console.info(`Running on ${getRuntimeDisplayName(runtime)}`);

  await import("./cli.js");
};

main().catch((error: unknown) => {
  console.error("Failed to start TypeWeaver CLI:", error);
  process.exit(1);
});
