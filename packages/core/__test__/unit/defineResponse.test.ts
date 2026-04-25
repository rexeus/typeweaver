import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  ResponseDefinitionMergeError,
  defineDerivedResponse,
  defineResponse,
  getResponseDefinitionMetadata,
  isNamedResponseDefinition,
  responseDefinitionMetadataSymbol,
} from "../../src/defineResponse.js";
import { HttpStatusCode } from "../../src/HttpStatusCode.js";

describe("defineResponse", () => {
  test("authored responses preserve supplied fields and schema identities", () => {
    const body = z.object({ id: z.string() });
    const header = z.object({ "x-request-id": z.string() });

    const response = defineResponse({
      name: "TestResponse",
      statusCode: HttpStatusCode.OK,
      description: "A test response",
      body,
      header,
    });

    expect(response.name).toBe("TestResponse");
    expect(response.statusCode).toBe(HttpStatusCode.OK);
    expect(response.description).toBe("A test response");
    expect(response.body).toBe(body);
    expect(response.header).toBe(header);
  });

  test("authored responses expose define-response metadata without leaking it to consumers", () => {
    const response = defineResponse({
      name: "MetadataResponse",
      statusCode: HttpStatusCode.CREATED,
      description: "Created",
    });

    const metadata = getResponseDefinitionMetadata(response);

    expect(metadata).toEqual({ source: "define-response" });
    expect(responseDefinitionMetadataSymbol in { ...response }).toBe(false);
    expect(
      responseDefinitionMetadataSymbol in Object.assign({}, response)
    ).toBe(false);
    expect(JSON.stringify(response)).toBe(
      JSON.stringify({
        name: "MetadataResponse",
        statusCode: HttpStatusCode.CREATED,
        description: "Created",
      })
    );
  });

  test("authored responses are recognized as named responses", () => {
    const response = defineResponse({
      name: "NamedResponse",
      statusCode: HttpStatusCode.OK,
      description: "Named",
    });

    expect(isNamedResponseDefinition(response)).toBe(true);
  });

  test("plain object literals are not recognized as named responses", () => {
    const plainObj = {
      name: "Foo",
      statusCode: HttpStatusCode.OK,
      description: "test",
    };

    expect(isNamedResponseDefinition(plainObj)).toBe(false);
  });
});

describe("defineDerivedResponse", () => {
  test("derived responses expose define-derived-response metadata", () => {
    const base = defineResponse({
      name: "BaseResponse",
      statusCode: HttpStatusCode.OK,
      description: "Base response",
    });

    const child = defineDerivedResponse(base, {
      name: "ChildResponse",
    });

    expect(getResponseDefinitionMetadata(child)).toEqual({
      source: "define-derived-response",
    });
  });

  test("derived responses are recognized as named responses", () => {
    const base = defineResponse({
      name: "BaseResponse",
      statusCode: HttpStatusCode.OK,
      description: "Base response",
    });

    const child = defineDerivedResponse(base, {
      name: "ChildResponse",
    });

    expect(isNamedResponseDefinition(child)).toBe(true);
  });

  test("first-level derived responses record parent name and lineage depth", () => {
    const base = defineResponse({
      name: "BaseError",
      statusCode: HttpStatusCode.BAD_REQUEST,
      description: "Base error",
    });

    const child = defineDerivedResponse(base, {
      name: "ValidationError",
    });

    expect(child.derived).toEqual({
      parentName: "BaseError",
      lineage: ["ValidationError"],
      depth: 1,
    });
  });

  test("nested derived responses record lineage through each derivation", () => {
    const base = defineResponse({
      name: "BaseError",
      statusCode: HttpStatusCode.BAD_REQUEST,
      description: "Base error",
    });
    const validationError = defineDerivedResponse(base, {
      name: "ValidationError",
    });

    const signupValidationError = defineDerivedResponse(validationError, {
      name: "SignupValidationError",
    });

    expect(signupValidationError.derived).toEqual({
      parentName: "ValidationError",
      lineage: ["ValidationError", "SignupValidationError"],
      depth: 2,
    });
  });

  test("derived responses inherit parent description when only status is overridden", () => {
    const base = defineResponse({
      name: "BaseError",
      statusCode: HttpStatusCode.BAD_REQUEST,
      description: "Base error",
    });

    const child = defineDerivedResponse(base, {
      name: "ValidationError",
      statusCode: HttpStatusCode.UNPROCESSABLE_ENTITY,
    });

    expect(child.description).toBe("Base error");
  });

  test("derived responses use supplied description over parent description", () => {
    const base = defineResponse({
      name: "BaseError",
      statusCode: HttpStatusCode.BAD_REQUEST,
      description: "Base error",
    });

    const child = defineDerivedResponse(base, {
      name: "ValidationError",
      description: "Validation error",
    });

    expect(child.description).toBe("Validation error");
  });

  test("derived responses use supplied status over parent status", () => {
    const base = defineResponse({
      name: "BaseError",
      statusCode: HttpStatusCode.BAD_REQUEST,
      description: "Base error",
    });

    const child = defineDerivedResponse(base, {
      name: "ValidationError",
      statusCode: HttpStatusCode.UNPROCESSABLE_ENTITY,
    });

    expect(child.statusCode).toBe(HttpStatusCode.UNPROCESSABLE_ENTITY);
  });

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
