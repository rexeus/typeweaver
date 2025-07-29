import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createData } from "../createData";
import { createJwtToken } from "../createJwtToken";
import type {
  IAccessTokenSuccessResponseBody,
  IAccessTokenSuccessResponseHeader,
  IAccessTokenSuccessResponse,
} from "../..";

export function createAccessTokenSuccessResponseHeaders(
  input: Partial<IAccessTokenSuccessResponseHeader> = {}
): IAccessTokenSuccessResponseHeader {
  const defaults: IAccessTokenSuccessResponseHeader = {
    "Content-Type": "application/json",
  };

  return createData(defaults, input);
}

export function createAccessTokenSuccessResponseBody(
  input: Partial<IAccessTokenSuccessResponseBody> = {}
): IAccessTokenSuccessResponseBody {
  const defaults: IAccessTokenSuccessResponseBody = {
    accessToken: createJwtToken(),
    refreshToken: createJwtToken(),
  };

  return createData(defaults, input);
}

type AccessTokenSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IAccessTokenSuccessResponseHeader>;
  body?: Partial<IAccessTokenSuccessResponseBody>;
};

export function createAccessTokenSuccessResponse(
  input: AccessTokenSuccessResponseInput = {}
): IAccessTokenSuccessResponse {
  const defaults: IAccessTokenSuccessResponse = {
    statusCode: HttpStatusCode.OK,
    header: createAccessTokenSuccessResponseHeaders(),
    body: createAccessTokenSuccessResponseBody(),
  };

  const overrides: Partial<IAccessTokenSuccessResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createAccessTokenSuccessResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createAccessTokenSuccessResponseBody(input.body);

  return createData(defaults, overrides);
}