import { UnknownResponseError } from "@rexeus/typeweaver-core";
import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { vi } from "vitest";

type ResponseBody = ConstructorParameters<typeof Response>[0];

type Sendable = {
  send(command: unknown): Promise<IHttpResponse>;
};

export function createRawMockFetch(
  status: number,
  body: ResponseBody,
  headers: Record<string, string> = {}
): typeof globalThis.fetch {
  return vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(new Response(body, { status, headers }));
}

/**
 * Sends a command and silently catches UnknownResponseError.
 * Useful for transport-level tests (URL construction, headers)
 * where the mock response doesn't match any defined schema.
 */
export async function sendIgnoringValidation(
  client: Sendable,
  command: unknown
): Promise<void> {
  try {
    await client.send(command);
  } catch (error) {
    if (!(error instanceof UnknownResponseError)) {
      throw error;
    }
  }
}

/**
 * Sends a command and extracts the raw response regardless of validation outcome.
 * Returns statusCode, header, and body from either a valid response or an UnknownResponseError.
 */
export async function sendAndExtractRawResponse(
  client: Sendable,
  command: unknown
): Promise<{
  readonly statusCode: number;
  readonly header: Record<string, unknown>;
  readonly body: unknown;
}> {
  try {
    const result = await client.send(command);
    return {
      statusCode: result.statusCode,
      header: result.header ?? {},
      body: result.body,
    };
  } catch (error) {
    if (error instanceof UnknownResponseError) {
      return {
        statusCode: error.statusCode,
        header: error.header ?? {},
        body: error.body,
      };
    }
    throw error;
  }
}
