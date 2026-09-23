import { FileClient } from "test-utils";
import { createRawMockFetch } from "../../helpers.js";

export function createFileClient(
  mockFetch: typeof globalThis.fetch,
  baseUrl = "http://localhost:3000"
) {
  return new FileClient({
    fetchFn: mockFetch,
    baseUrl,
  });
}

export function createJsonMockFetch(
  status: number,
  body: unknown,
  headers: Record<string, string> = { "content-type": "application/json" }
): typeof globalThis.fetch {
  return createRawMockFetch(status, JSON.stringify(body), headers);
}
