import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import { createErrorResponseHeaders } from "../createErrorResponseHeaders";
import type {
  IConflictErrorResponse,
  IConflictErrorResponseHeader,
  IConflictErrorResponseBody,
} from "../..";
import { ConflictErrorResponse } from "../..";

type ConflictErrorResponseInput = {
  statusCode?: number;
  header?: Partial<IConflictErrorResponseHeader>;
  body?: Partial<IConflictErrorResponseBody>;
};

const createConflictErrorResponseBody =
  createDataFactory<IConflictErrorResponseBody>(() => ({
    message: "Conflicted request",
    code: "CONFLICT_ERROR",
  }));

export function createConflictErrorResponse(
  input: ConflictErrorResponseInput = {}
): ConflictErrorResponse {
  const responseData = createResponse<
    IConflictErrorResponse,
    IConflictErrorResponseBody,
    IConflictErrorResponseHeader
  >(
    {
      statusCode: HttpStatusCode.CONFLICT,
    },
    {
      body: createConflictErrorResponseBody,
      header: createErrorResponseHeaders<IConflictErrorResponseHeader>(),
    },
    input
  );
  return new ConflictErrorResponse(responseData);
}
