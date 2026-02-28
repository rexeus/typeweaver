import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { defineMiddleware } from "../TypedMiddleware";
import type { ServerContext } from "../ServerContext";

export type BasicAuthOptions = {
  readonly verifyCredentials: (
    username: string,
    password: string,
    ctx: ServerContext,
  ) => boolean | Promise<boolean>;
  readonly realm?: string;
  readonly unauthorizedMessage?: string;
  readonly onUnauthorized?: (ctx: ServerContext) => IHttpResponse;
};

const BASIC_PREFIX = "Basic ";

export function basicAuth(options: BasicAuthOptions) {
  const realm = options.realm ?? "Secure Area";
  const message = options.unauthorizedMessage ?? "Unauthorized";

  const defaultResponse: IHttpResponse = {
    statusCode: 401,
    header: { "www-authenticate": `Basic realm="${realm}"` },
    body: { code: "UNAUTHORIZED", message },
  };

  const deny = (ctx: ServerContext): IHttpResponse =>
    options.onUnauthorized?.(ctx) ?? defaultResponse;

  return defineMiddleware<{ username: string }>(async (ctx, next) => {
    const authorization = ctx.request.header?.["authorization"];
    if (typeof authorization !== "string") return deny(ctx);

    if (!authorization.startsWith(BASIC_PREFIX)) return deny(ctx);

    const encoded = authorization.slice(BASIC_PREFIX.length);
    if (encoded.length === 0) return deny(ctx);

    let decoded: string;
    try {
      decoded = atob(encoded);
    } catch {
      return deny(ctx);
    }

    const colonIndex = decoded.indexOf(":");
    if (colonIndex <= 0) return deny(ctx);

    const username = decoded.slice(0, colonIndex);
    const password = decoded.slice(colonIndex + 1);

    let valid: boolean;
    try {
      valid = await options.verifyCredentials(username, password, ctx);
    } catch {
      return deny(ctx);
    }

    if (!valid) return deny(ctx);

    return next({ username });
  });
}
