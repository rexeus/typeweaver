import { describe, expect, test } from "vitest";
import { HttpStatusCode, isTypedHttpResponse } from "../../../src/index.js";
import { TestObjectTrapError } from "../../errors/index.js";

describe("isTypedHttpResponse property access failures", () => {
  test("propagates errors from a throwing statusCode getter", () => {
    const response = Object.defineProperty({ type: "Success" }, "statusCode", {
      enumerable: true,
      get() {
        throw new TestObjectTrapError("statusCode getter");
      },
    });

    expect(() => isTypedHttpResponse(response)).toThrow("statusCode getter");
  });

  test("propagates errors from a throwing header getter", () => {
    const response = Object.defineProperty(
      { type: "Success", statusCode: HttpStatusCode.OK },
      "header",
      {
        enumerable: true,
        get() {
          throw new TestObjectTrapError("header getter");
        },
      }
    );

    expect(() => isTypedHttpResponse(response)).toThrow("header getter");
  });

  test("propagates errors from a header Proxy that throws on iteration", () => {
    const header = new Proxy(
      {},
      {
        ownKeys() {
          throw new TestObjectTrapError("proxy ownKeys");
        },
      }
    );
    const response = {
      type: "Success",
      statusCode: HttpStatusCode.OK,
      header,
    };

    expect(() => isTypedHttpResponse(response)).toThrow("proxy ownKeys");
  });
});
