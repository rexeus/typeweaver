import { createTestApp } from "../createTestApp.ts";

const port = Number(Deno.args[0]);
const app = createTestApp({
  maxBodySize: 64,
  validateRequests: false,
  validateResponses: false,
});

Deno.serve({ port, onListen: () => console.log("READY") }, app.fetch);
