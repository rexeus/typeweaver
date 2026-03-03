import {
  HttpMethod,
  HttpOperationDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";

export function createOperationHelper(operationId: string) {
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

export function createResponseHelper(name: string) {
  return {
    name,
    statusCode: HttpStatusCode.OK,
    description: "Test response",
  };
}
