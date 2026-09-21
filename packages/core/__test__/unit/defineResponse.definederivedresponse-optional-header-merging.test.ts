import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  ResponseDefinitionMergeError,
  defineDerivedResponse,
  defineResponse,
} from "../../src/defineResponse.js";
import { HttpStatusCode } from "../../src/HttpStatusCode.js";

describe("defineDerivedResponse optional header merging", () => {
  test("derived responses merge optional object header schemas", () => {
    const base = defineResponse({
      name: "BaseError",
      statusCode: HttpStatusCode.BAD_REQUEST,
      description: "Base error",
      header: z.object({ "x-request-id": z.string().optional() }).optional(),
    });

    const child = defineDerivedResponse(base, {
      name: "ChildError",
      header: z.object({ "x-trace-id": z.string().optional() }),
    });

    const headerSchema = child.header;

    expect(headerSchema?.safeParse(undefined).success).toBe(true);
    expect(headerSchema?.safeParse({}).success).toBe(true);
    expect(
      headerSchema?.safeParse({
        "x-request-id": "request-1",
        "x-trace-id": "trace-1",
      }).success
    ).toBe(true);
    expect(
      headerSchema?.safeParse({
        "x-request-id": 123,
        "x-trace-id": "trace-1",
      }).success
    ).toBe(false);
    expect(
      headerSchema?.safeParse({
        "x-request-id": "request-1",
        "x-trace-id": 123,
      }).success
    ).toBe(false);
  });

  test("derived responses require merged headers when an optional parent adds a required child field", () => {
    const base = defineResponse({
      name: "BaseError",
      statusCode: HttpStatusCode.BAD_REQUEST,
      description: "Base error",
      header: z.object({ "x-request-id": z.string().optional() }).optional(),
    });

    const child = defineDerivedResponse(base, {
      name: "ChildError",
      header: z.object({ "x-trace-id": z.string() }),
    });

    const headerSchema = child.header;

    expect(headerSchema?.safeParse(undefined).success).toBe(false);
    expect(headerSchema?.safeParse({}).success).toBe(false);
    expect(
      headerSchema?.safeParse({
        "x-trace-id": "trace-1",
      }).success
    ).toBe(true);
    expect(
      headerSchema?.safeParse({
        "x-request-id": "request-1",
        "x-trace-id": "trace-1",
      }).success
    ).toBe(true);
  });
});

describe("defineDerivedResponse required header merging", () => {
  test("derived responses merge required object header schemas", () => {
    const base = defineResponse({
      name: "BaseError",
      statusCode: HttpStatusCode.BAD_REQUEST,
      description: "Base error",
      header: z.object({ "x-request-id": z.string() }),
    });

    const child = defineDerivedResponse(base, {
      name: "ChildError",
      header: z.object({ "x-trace-id": z.string() }),
    });

    const headerSchema = child.header;

    expect(
      headerSchema?.safeParse({
        "x-request-id": "request-1",
        "x-trace-id": "trace-1",
      }).success
    ).toBe(true);
    expect(
      headerSchema?.safeParse({
        "x-trace-id": "trace-1",
      }).success
    ).toBe(false);
    expect(
      headerSchema?.safeParse({
        "x-request-id": "request-1",
      }).success
    ).toBe(false);
  });

  test("derived responses preserve required parent headers when the child header is optional", () => {
    const base = defineResponse({
      name: "BaseError",
      statusCode: HttpStatusCode.BAD_REQUEST,
      description: "Base error",
      header: z.object({ "x-request-id": z.string() }),
    });

    const child = defineDerivedResponse(base, {
      name: "ChildError",
      header: z.object({ "x-trace-id": z.string().optional() }).optional(),
    });

    const headerSchema = child.header;

    expect(headerSchema?.safeParse(undefined).success).toBe(false);
    expect(headerSchema?.safeParse({}).success).toBe(false);
    expect(
      headerSchema?.safeParse({
        "x-request-id": "request-1",
      }).success
    ).toBe(true);
    expect(
      headerSchema?.safeParse({
        "x-request-id": "request-1",
        "x-trace-id": "trace-1",
      }).success
    ).toBe(true);
  });
});

describe("defineDerivedResponse omitted fields", () => {
  test("inherits parent statusCode and description when not overridden", () => {
    const base = defineResponse({
      name: "ParentResponse",
      statusCode: HttpStatusCode.NOT_FOUND,
      description: "Not found",
    });

    const child = defineDerivedResponse(base, {
      name: "ChildResponse",
    });

    expect(child.statusCode).toBe(HttpStatusCode.NOT_FOUND);
    expect(child.description).toBe("Not found");
  });

  test("inherits parent body when child omits body", () => {
    const body = z.object({ id: z.string() });
    const base = defineResponse({
      name: "ParentResponse",
      statusCode: HttpStatusCode.OK,
      description: "Ok",
      body,
    });

    const child = defineDerivedResponse(base, {
      name: "ChildResponse",
    });

    expect(child.body).toBe(body);
  });

  test("inherits parent header when child omits header", () => {
    const header = z.object({ "x-request-id": z.string() });
    const base = defineResponse({
      name: "ParentResponse",
      statusCode: HttpStatusCode.OK,
      description: "Ok",
      header,
    });

    const child = defineDerivedResponse(base, {
      name: "ChildResponse",
    });

    expect(child.header).toBe(header);
  });

  test("uses child body when parent omits body", () => {
    const body = z.object({ id: z.string() });
    const base = defineResponse({
      name: "ParentResponse",
      statusCode: HttpStatusCode.OK,
      description: "Ok",
    });

    const child = defineDerivedResponse(base, {
      name: "ChildResponse",
      body,
    });

    expect(child.body).toBe(body);
  });

  test("uses child header when parent omits header", () => {
    const header = z.object({ "x-request-id": z.string() });
    const base = defineResponse({
      name: "ParentResponse",
      statusCode: HttpStatusCode.OK,
      description: "Ok",
    });

    const child = defineDerivedResponse(base, {
      name: "ChildResponse",
      header,
    });

    expect(child.header).toBe(header);
  });
});

describe("defineDerivedResponse incompatible schema replacement", () => {
  test("replaces parent ZodObject body when child provides non-object schema", () => {
    const base = defineResponse({
      name: "ObjectBodyResponse",
      statusCode: HttpStatusCode.OK,
      description: "Ok",
      body: z.object({ code: z.string() }),
    });

    const child = defineDerivedResponse(base, {
      name: "StringBodyResponse",
      body: z.string(),
    });

    expect(child.body?.safeParse("ok").success).toBe(true);
    expect(child.body?.safeParse({ code: "ok" }).success).toBe(false);
  });

  test("child object body replaces a non-object parent body", () => {
    const base = defineResponse({
      name: "StringBodyResponse",
      statusCode: HttpStatusCode.OK,
      description: "Ok",
      body: z.string(),
    });

    const child = defineDerivedResponse(base, {
      name: "ObjectBodyResponse",
      body: z.object({ code: z.string() }),
    });

    expect(child.body?.safeParse({ code: "ok" }).success).toBe(true);
    expect(child.body?.safeParse("ok").success).toBe(false);
  });

  test("throws ResponseDefinitionMergeError when deriving from record headers", () => {
    const baseResponse = defineResponse({
      name: "BaseError",
      statusCode: HttpStatusCode.BAD_REQUEST,
      description: "Base error",
      header: z.record(z.string(), z.string()),
    });

    expect(() =>
      defineDerivedResponse(baseResponse, {
        name: "ChildError",
        header: z.object({
          "x-request-id": z.string(),
        }),
      })
    ).toThrowError(ResponseDefinitionMergeError);
  });

  test("throws ResponseDefinitionMergeError when deriving with record headers", () => {
    const baseResponse = defineResponse({
      name: "BaseError",
      statusCode: HttpStatusCode.BAD_REQUEST,
      description: "Base error",
      header: z.object({
        "x-request-id": z.string(),
      }),
    });

    expect(() =>
      defineDerivedResponse(baseResponse, {
        name: "ChildError",
        header: z.record(z.string(), z.string()),
      })
    ).toThrowError(ResponseDefinitionMergeError);
  });
});
