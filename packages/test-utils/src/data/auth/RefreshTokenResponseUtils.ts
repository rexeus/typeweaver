import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createData } from "../createData";
import { createJwtToken } from "../createJwtToken";
import type {
  IRefreshTokenSuccessResponseBody,
  IRefreshTokenSuccessResponseHeader,
  IRefreshTokenSuccessResponse,
} from "../..";

export function createRefreshTokenSuccessResponseHeaders(
  input: Partial<IRefreshTokenSuccessResponseHeader> = {}
): IRefreshTokenSuccessResponseHeader {
  const defaults: IRefreshTokenSuccessResponseHeader = {
    "Content-Type": "application/json",
  };

  return createData(defaults, input);
}

export function createRefreshTokenSuccessResponseBody(
  input: Partial<IRefreshTokenSuccessResponseBody> = {}
): IRefreshTokenSuccessResponseBody {
  const defaults: IRefreshTokenSuccessResponseBody = {
    accessToken: createJwtToken(),
    refreshToken: createJwtToken(),
  };

  return createData(defaults, input);
}

type RefreshTokenSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IRefreshTokenSuccessResponseHeader>;
  body?: Partial<IRefreshTokenSuccessResponseBody>;
};

export function createRefreshTokenSuccessResponse(
  input: RefreshTokenSuccessResponseInput = {}
): IRefreshTokenSuccessResponse {
  const defaults: IRefreshTokenSuccessResponse = {
    statusCode: HttpStatusCode.OK,
    header: createRefreshTokenSuccessResponseHeaders(),
    body: createRefreshTokenSuccessResponseBody(),
  };

  const overrides: Partial<IRefreshTokenSuccessResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createRefreshTokenSuccessResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createRefreshTokenSuccessResponseBody(input.body);

  return createData(defaults, overrides);
}
