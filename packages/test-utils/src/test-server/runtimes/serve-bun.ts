import { createTestApp } from "../createTestApp.ts";

const port = Number(process.argv[2]);
const app = createTestApp({
  maxBodySize: 64,
  validateRequests: false,
  validateResponses: false,
});

Bun.serve({ fetch: app.fetch, port });
console.log("READY");
