import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";

export function createOperation(operationId: string) {
  return new HttpOperationDefinition({
    operationId,
    path: "/test",
    method: HttpMethod.GET,
    summary: "Test operation",
    request: {} as any,
    responses: [
      {
        name: "TestSuccess",
        statusCode: HttpStatusCode.OK,
        description: "Success",
      },
    ],
  });
}

export function createResponse(name: string) {
  return {
    name,
    statusCode: HttpStatusCode.OK,
    description: "Test response",
  };
}

export function catchError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("Expected function to throw");
}

export async function catchErrorAsync(
  fn: () => Promise<unknown>
): Promise<unknown> {
  try {
    await fn();
  } catch (error) {
    return error;
  }
  throw new Error("Expected function to throw");
}
