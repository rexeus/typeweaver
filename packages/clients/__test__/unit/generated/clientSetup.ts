import { TodoClient, createTestServer } from "test-utils";

const cleanupFunctions: (() => void | Promise<void>)[] = [];

export async function setupClientTest(
  config: Parameters<typeof createTestServer>[0] = {}
) {
  const testServer = await createTestServer(config);
  const client = new TodoClient({ baseUrl: testServer.baseUrl });

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
