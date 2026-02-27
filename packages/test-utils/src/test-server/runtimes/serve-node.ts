import { createServer } from "node:http";
import { nodeAdapter } from "../../test-project/output/lib/server/NodeAdapter.ts";
import { createTestApp } from "../createTestApp.ts";

const port = Number(process.argv[2]);
const app = createTestApp({ validateRequests: false });

const server = createServer(nodeAdapter(app));
server.listen(port, () => console.log("READY"));
