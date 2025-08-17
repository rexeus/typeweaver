import { createTestServer, TodoClient } from "test-utils";
import type { ApiClientProps } from "test-utils/src/test-project/output/lib/clients";

const cleanupFunctions: (() => void | Promise<void>)[] = [];

export async function setupClientTest(
  serverConfig: Parameters<typeof createTestServer>[0] = {},
  clientConfig: ApiClientProps = {}
) {
  const testServer = await createTestServer(serverConfig);
  const client = new TodoClient({
    baseUrl: testServer.baseUrl,
    ...clientConfig,
  });

  // Auto-register cleanup function
  cleanupFunctions.push(() => {
    testServer.server.close();
  });

  return { client };
}

export async function runClientCleanup() {
  for (const cleanup of cleanupFunctions) {
    await cleanup();
  }
  cleanupFunctions.length = 0;
}
