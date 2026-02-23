import { vi } from "vitest";

export function createRawMockFetch(
  status: number,
  body: BodyInit | null,
  headers: Record<string, string> = {},
): typeof globalThis.fetch {
  return vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    new Response(body, { status, headers }),
  );
}
