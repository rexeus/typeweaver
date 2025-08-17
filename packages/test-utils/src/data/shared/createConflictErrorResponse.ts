import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { ConflictErrorResponse } from "../..";
import { createDataFactory } from "../createDataFactory";
import { createErrorResponseHeader } from "../createErrorResponseHeader";
import { createResponse } from "../createResponse";
import type {
  IConflictErrorResponse,
  IConflictErrorResponseBody,
  IConflictErrorResponseHeader,
} from "../..";

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
      header: createErrorResponseHeader<IConflictErrorResponseHeader>(),
    },
    input
  );
  return new ConflictErrorResponse(responseData);
}
