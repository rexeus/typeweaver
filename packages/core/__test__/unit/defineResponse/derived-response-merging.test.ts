import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  defineDerivedResponse,
  defineResponse,
} from "../../../src/defineResponse.js";
import { HttpStatusCode } from "../../../src/HttpStatusCode.js";
import { ResponseDefinitionMergeError } from "../../../src/responseDefinitionMetadata.js";

describe("defineDerivedResponse body and field merging", () => {
  test("derived responses merge object body schemas across derivation levels", () => {
    const base = defineResponse({
      name: "BaseError",
      statusCode: HttpStatusCode.BAD_REQUEST,
      description: "Base error",
      body: z.object({ code: z.string() }),
    });
    const validationError = defineDerivedResponse(base, {
      name: "ValidationError",
      body: z.object({ field: z.string() }),
    });

    const signupValidationError = defineDerivedResponse(validationError, {
      name: "SignupValidationError",
      body: z.object({ form: z.string() }),
    });

    const bodySchema = signupValidationError.body;

    expect(
      bodySchema?.safeParse({
        code: "invalid",
        field: "email",
        form: "signup",
      }).success
    ).toBe(true);
    expect(
      bodySchema?.safeParse({
        field: "email",
        form: "signup",
      }).success
    ).toBe(false);
    expect(
      bodySchema?.safeParse({
        code: 400,
        field: "email",
        form: "signup",
      }).success
    ).toBe(false);
    expect(
      bodySchema?.safeParse({
        code: "invalid",
        form: "signup",
      }).success
    ).toBe(false);
  });

  test("child body fields override parent fields with the same name", () => {
    const base = defineResponse({
      name: "BaseError",
      statusCode: HttpStatusCode.BAD_REQUEST,
      description: "Base error",
      body: z.object({ code: z.literal("parent") }),
    });

    const child = defineDerivedResponse(base, {
      name: "ChildError",
      body: z.object({ code: z.literal("child") }),
    });

    expect(child.body?.safeParse({ code: "child" }).success).toBe(true);
    expect(child.body?.safeParse({ code: "parent" }).success).toBe(false);
  });

  test("child header fields override parent header fields with the same name", () => {
    const base = defineResponse({
      name: "BaseError",
      statusCode: HttpStatusCode.BAD_REQUEST,
      description: "Base error",
      header: z.object({ "x-request-id": z.literal("parent") }),
    });

    const child = defineDerivedResponse(base, {
      name: "ChildError",
      header: z.object({ "x-request-id": z.literal("child") }),
    });

    expect(child.header?.safeParse({ "x-request-id": "child" }).success).toBe(
      true
    );
    expect(child.header?.safeParse({ "x-request-id": "parent" }).success).toBe(
      false
    );
  });
});

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
