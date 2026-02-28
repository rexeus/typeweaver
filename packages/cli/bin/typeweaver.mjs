#!/usr/bin/env node

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const entry = resolve(__dirname, "../dist/entry.mjs");

if (!existsSync(entry)) {
  console.error(
    "TypeWeaver CLI has not been built yet.\n" +
      "Run 'pnpm build' in the project root first."
  );
  process.exit(1);
}

await import(entry);
