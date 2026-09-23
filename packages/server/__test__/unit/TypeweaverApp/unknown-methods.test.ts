import {
  methodNotAllowedDefaultError,
  notFoundDefaultError,
} from "@rexeus/typeweaver-core";
import { describe, expect, test, vi } from "vitest";
import { defineMiddleware } from "../../../src/lib/TypedMiddleware.js";
import { BASE_URL, expectErrorResponse } from "../../helpers.js";
import { createApp } from "./fixtures.js";

const propfind = (path: string): Request =>
  new Request(BASE_URL + path, { method: "PROPFIND" });

describe("TypeweaverApp unknown request methods", () => {
  test("answers 405 with the allowed methods on a registered path", async () => {
    const app = createApp();

    const res = await app.fetch(propfind("/todos"));

    await expectErrorResponse(
      res,
      methodNotAllowedDefaultError.statusCode,
      methodNotAllowedDefaultError.code
    );
    expect(res.headers.get("allow")).toBe("GET, HEAD, POST");
  });

  test("answers 404 on an unknown path", async () => {
    const app = createApp();

    const res = await app.fetch(propfind("/missing"));

    await expectErrorResponse(
      res,
      notFoundDefaultError.statusCode,
      notFoundDefaultError.code
    );
  });

  test("does not run middleware with a method outside HttpMethod", async () => {
    const seen = vi.fn<(method: string) => void>();
    const app = createApp().use(
      defineMiddleware(async (ctx, next) => {
        seen(ctx.request.method);
        return next();
      })
    );

    await app.fetch(propfind("/todos"));

    expect(seen).not.toHaveBeenCalled();
  });
});
