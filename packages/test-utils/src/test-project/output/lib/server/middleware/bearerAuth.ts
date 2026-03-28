import { createDefaultErrorBody, unauthorizedDefaultError } from "@rexeus/typeweaver-core";
import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { defineMiddleware } from "../TypedMiddleware";
import type { ServerContext } from "../ServerContext";

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
    const authorization = ctx.request.header?.["authorization"];
    if (typeof authorization !== "string") return deny(ctx);

    if (!authorization.startsWith(BEARER_PREFIX)) return deny(ctx);

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
