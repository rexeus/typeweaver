/**
 * Re-exports the generated Hono routers used by the runtime test server.
 *
 * Grouping the three generated modules here keeps `createTestServer` within the
 * repository dependency budget without importing the `test-utils` root barrel
 * (which would create an import cycle).
 */
export { AccountHono } from "../test-project/output/account/AccountHono.js";
export { AuthHono } from "../test-project/output/auth/AuthHono.js";
export { TodoHono } from "../test-project/output/todo/TodoHono.js";
