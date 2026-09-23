import { createTestServer, TodoClient } from "test-utils";
import type { CreateTestServerResult } from "test-utils";
import type { ApiClientProps } from "test-utils/src/test-project/output/lib/clients/index.js";

const cleanupFunctions: (() => void | Promise<void>)[] = [];

async function closeTestServer(
  testServer: CreateTestServerResult
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    testServer.server.close((error?: Error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export async function setupClientTest(
  serverConfig: Parameters<typeof createTestServer>[0] = {},
  clientConfig: Omit<ApiClientProps, "baseUrl"> = {}
) {
  const testServer = await createTestServer(serverConfig);
  const client = new TodoClient({
    baseUrl: testServer.baseUrl,
    ...clientConfig,
  });

  // Auto-register cleanup function
  cleanupFunctions.push(() => closeTestServer(testServer));

  return { client };
}

export async function runClientCleanup() {
  const pendingCleanupFunctions = cleanupFunctions.splice(0);
  const cleanupErrors: unknown[] = [];

  for (const cleanup of pendingCleanupFunctions) {
    try {
      await cleanup();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }

  if (cleanupErrors.length === 1) {
    throw cleanupErrors[0];
  }

  if (cleanupErrors.length > 1) {
    throw new AggregateError(
      cleanupErrors,
      "Multiple client cleanup functions failed"
    );
  }
}
