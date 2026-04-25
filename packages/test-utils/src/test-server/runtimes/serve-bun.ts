import { createRuntimeTestApp } from "../createTestApp.ts";

const port = Number(process.argv[2]);
const app = createRuntimeTestApp();

Bun.serve({ fetch: app.fetch, port });
console.log("READY");
