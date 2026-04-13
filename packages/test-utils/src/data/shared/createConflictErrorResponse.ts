import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createConflictErrorResponse as generatedCreateConflictErrorResponse } from "../../test-project/output/shared/ConflictErrorResponse";
import { createDataFactory } from "../createDataFactory.js";
import { createErrorResponseHeader } from "../createErrorResponseHeader.js";
import { createResponse } from "../createResponse.js";
import type {
  IConflictErrorResponse,
  IConflictErrorResponseBody,
  IConflictErrorResponseHeader,
} from "../../index.js";

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
): IConflictErrorResponse {
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
  return generatedCreateConflictErrorResponse(responseData);
}
