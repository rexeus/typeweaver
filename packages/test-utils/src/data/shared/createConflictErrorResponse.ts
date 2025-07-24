import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createData } from "../createData";
import { createErrorResponseHeaders } from "../createErrorResponseHeaders";
import type {
  IConflictErrorResponse,
  IConflictErrorResponseHeader,
  IConflictErrorResponseBody,
} from "../..";
type ConflictErrorResponseInput = {
  statusCode?: number;
  header?: Partial<IConflictErrorResponseHeader>;
  body?: Partial<IConflictErrorResponseBody>;
};

export function createConflictErrorResponse(
  input: ConflictErrorResponseInput = {}
): IConflictErrorResponse {
  const defaults: IConflictErrorResponse = {
    statusCode: HttpStatusCode.CONFLICT,
    header: createErrorResponseHeaders<IConflictErrorResponseHeader>(),
    body: {
      message: "Conflicted request",
      code: "CONFLICT_ERROR",
    },
  };

  const overrides: Partial<IConflictErrorResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createErrorResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createData(defaults.body, input.body);

  return createData(defaults, overrides);
}
