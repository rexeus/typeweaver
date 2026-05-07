import { createDefaultErrorBody, unauthorizedDefaultError } from "@rexeus/typeweaver-core";
import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { defineMiddleware } from "../TypedMiddleware.js";
import { readSingletonHeader } from "./header.js";
import type { ServerContext } from "../ServerContext.js";

export type BearerAuthOptions = {
  readonly verifyToken: (token: string, ctx: ServerContext) => boolean | Promise<boolean>;
  readonly realm?: string;
  readonly onUnauthorized?: (ctx: ServerContext) => IHttpResponse;
};

const BEARER_PREFIX = "Bearer ";

export function bearerAuth(options: BearerAuthOptions) {
  const realm = options.realm ?? "Secure Area";

  const defaultResponse: IHttpResponse = {
    statusCode: unauthorizedDefaultError.statusCode,
    header: { "www-authenticate": `Bearer realm="${realm}"` },
    body: createDefaultErrorBody(unauthorizedDefaultError),
  };

  const deny = (ctx: ServerContext): IHttpResponse =>
    options.onUnauthorized?.(ctx) ?? defaultResponse;

  return defineMiddleware<{ token: string }>(async (ctx, next) => {
    const authorization = readSingletonHeader(ctx.request.header, "authorization");
    if (typeof authorization !== "string") return deny(ctx);

    if (
      authorization.slice(0, BEARER_PREFIX.length).toLowerCase() !== BEARER_PREFIX.toLowerCase()
    ) {
      return deny(ctx);
    }

    const token = authorization.slice(BEARER_PREFIX.length);
    if (token.length === 0) return deny(ctx);

    let valid: boolean;
    try {
      valid = await options.verifyToken(token, ctx);
    } catch {
      return deny(ctx);
    }

    if (!valid) return deny(ctx);

    return next({ token });
  });
}
