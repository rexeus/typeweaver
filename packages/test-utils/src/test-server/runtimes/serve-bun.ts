import { createTestApp } from "../createTestApp.ts";

const port = Number(process.argv[2]);
const app = createTestApp({ validateRequests: false });

Bun.serve({ fetch: app.fetch, port });
console.log("READY");
