import { vi } from "vitest";

type ResponseBody = ConstructorParameters<typeof Response>[0];

export function createRawMockFetch(
  status: number,
  body: ResponseBody,
  headers: Record<string, string> = {}
): typeof globalThis.fetch {
  return vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(new Response(body, { status, headers }));
}
