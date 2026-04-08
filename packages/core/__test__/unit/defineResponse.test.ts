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
  test("returns the definition with correct properties", () => {
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

  test("attaches non-enumerable metadata with source define-response", () => {
    const response = defineResponse({
      name: "MetadataResponse",
      statusCode: HttpStatusCode.CREATED,
      description: "Created",
    });

    const metadata = getResponseDefinitionMetadata(response);

    expect(metadata).toEqual({ source: "define-response" });
    expect(Object.keys(response)).not.toContain(
      responseDefinitionMetadataSymbol
    );
  });

  test("is recognized by isNamedResponseDefinition", () => {
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
      statusCode: 200,
      description: "test",
    };

    expect(isNamedResponseDefinition(plainObj as any)).toBe(false);
  });
});

describe("defineDerivedResponse", () => {
  test("merges object headers and bodies while preserving lineage", () => {
    const baseResponse = defineResponse({
      name: "BaseError",
      statusCode: HttpStatusCode.BAD_REQUEST,
      description: "Base error",
      header: z
        .object({
          "x-request-id": z.string().optional(),
        })
        .optional(),
      body: z.object({
        code: z.string(),
      }),
    });

    const derivedResponse = defineDerivedResponse(baseResponse, {
      name: "ValidationError",
      description: "Validation failed",
      body: z.object({
        field: z.string(),
      }),
      header: z.object({
        "x-trace-id": z.string().optional(),
      }),
    });

    const deeplyDerivedResponse = defineDerivedResponse(derivedResponse, {
      name: "SignupValidationError",
      statusCode: HttpStatusCode.UNPROCESSABLE_ENTITY,
      body: z.object({
        form: z.string(),
      }),
    });

    expect(deeplyDerivedResponse.statusCode).toBe(
      HttpStatusCode.UNPROCESSABLE_ENTITY
    );
    expect(deeplyDerivedResponse.description).toBe("Validation failed");
    expect(deeplyDerivedResponse.derived).toEqual({
      parentName: "ValidationError",
      lineage: ["ValidationError", "SignupValidationError"],
      depth: 2,
    });

    expect(deeplyDerivedResponse.header).toBeInstanceOf(z.ZodOptional);
    expect(deeplyDerivedResponse.body).toBeInstanceOf(z.ZodObject);

    const optionalHeader = deeplyDerivedResponse.header as
      | z.ZodOptional<z.ZodObject<any>>
      | undefined;
    const headerShape = optionalHeader?.unwrap().shape;
    const bodyShape =
      deeplyDerivedResponse.body instanceof z.ZodObject
        ? deeplyDerivedResponse.body.shape
        : undefined;

    expect(headerShape).toMatchObject({
      "x-request-id": expect.any(z.ZodOptional),
      "x-trace-id": expect.any(z.ZodOptional),
    });
    expect(bodyShape).toMatchObject({
      code: expect.any(z.ZodString),
      field: expect.any(z.ZodString),
      form: expect.any(z.ZodString),
    });
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

    expect(child.body).toBeInstanceOf(z.ZodString);
  });

  test("fails fast when headers cannot be merged", () => {
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
});
