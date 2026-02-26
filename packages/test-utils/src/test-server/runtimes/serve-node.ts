import { createServer } from "node:http";
import { createTestApp } from "../createTestApp.ts";

const port = Number(process.argv[2]);
const app = createTestApp({ validateRequests: false });

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const body = await new Promise<string>(resolve => {
    let data = "";
    req.on("data", (chunk: Buffer) => (data += chunk));
    req.on("end", () => resolve(data));
  });
  const request = new Request(url, {
    method: req.method,
    headers: req.headers as HeadersInit,
    body: ["GET", "HEAD"].includes(req.method!) ? undefined : body,
  });
  const response = await app.fetch(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(await response.text());
});

server.listen(port, () => console.log("READY"));
