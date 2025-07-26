import { HttpMethod } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  IRefreshTokenRequest,
  IRefreshTokenRequestBody,
  IRefreshTokenRequestHeader,
} from "../..";;
import { createData } from "../createData";
import { createJwtToken } from "../createJwtToken";

export function createRefreshTokenRequestHeaders(
  input: Partial<IRefreshTokenRequestHeader> = {}
): IRefreshTokenRequestHeader {
  const defaults: IRefreshTokenRequestHeader = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  return createData(defaults, input);
}

export function createRefreshTokenRequestBody(
  input: Partial<IRefreshTokenRequestBody> = {}
): IRefreshTokenRequestBody {
  const defaults: IRefreshTokenRequestBody = {
    refreshToken: createJwtToken(),
  };

  return createData(defaults, input);
}

type RefreshTokenRequestInput = {
  path?: string;
  header?: Partial<IRefreshTokenRequestHeader>;
  body?: Partial<IRefreshTokenRequestBody>;
};

export function createRefreshTokenRequest(
  input: RefreshTokenRequestInput = {}
): IRefreshTokenRequest {
  const defaults: IRefreshTokenRequest = {
    method: HttpMethod.POST,
    path: "/auth/refresh-token",
    header: createRefreshTokenRequestHeaders(),
    body: createRefreshTokenRequestBody(),
  };

  const overrides: Partial<IRefreshTokenRequest> = {};
  if (input.path !== undefined) overrides.path = input.path;
  if (input.header !== undefined)
    overrides.header = createRefreshTokenRequestHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createRefreshTokenRequestBody(input.body);

  return createData(defaults, overrides as IRefreshTokenRequest);
}