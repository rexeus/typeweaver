import { createRuntimeTestApp } from "../createTestApp.ts";

const port = Number(Deno.args[0]);
const app = createRuntimeTestApp();

Deno.serve({ port, onListen: () => console.log("READY") }, app.fetch);
