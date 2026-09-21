import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  defineDerivedResponse,
  defineResponse,
  getResponseDefinitionMetadata,
  isNamedResponseDefinition,
  responseDefinitionMetadataSymbol,
} from "../../src/defineResponse.js";
import { HttpStatusCode } from "../../src/HttpStatusCode.js";

describe("defineResponse authored metadata", () => {
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
});

describe("defineResponse object identity", () => {
  test("mutable authored responses receive metadata on the supplied object", () => {
    const definition = {
      name: "MutableResponse",
      statusCode: HttpStatusCode.OK,
      description: "Mutable",
    };

    const response = defineResponse(definition);

    expect(response).toBe(definition);
    expect(isNamedResponseDefinition(response)).toBe(true);
  });

  test("frozen authored responses receive metadata on a clone", () => {
    const body = z.object({ id: z.string() });
    const derived = {
      parentName: "ParentResponse",
      lineage: ["FrozenResponse"],
      depth: 1,
    } as const;
    const definition = Object.freeze({
      name: "FrozenResponse",
      statusCode: HttpStatusCode.OK,
      description: "Frozen",
      body,
      derived,
    });

    const response = defineResponse(definition);

    expect(response).not.toBe(definition);
    expect(isNamedResponseDefinition(response)).toBe(true);
    expect(isNamedResponseDefinition(definition)).toBe(false);
    expect(response.body).toBe(body);
    expect(response.derived).toBe(derived);
    expect(responseDefinitionMetadataSymbol in definition).toBe(false);
  });

  test.each([
    {
      scenario: "sealed",
      createDefinition: () =>
        Object.seal({
          name: "SealedResponse",
          statusCode: HttpStatusCode.OK,
          description: "Sealed",
        }),
    },
    {
      scenario: "non-extensible",
      createDefinition: () =>
        Object.preventExtensions({
          name: "NonExtensibleResponse",
          statusCode: HttpStatusCode.OK,
          description: "Non-extensible",
        }),
    },
  ])("$scenario authored responses receive metadata on a clone", scenario => {
    const definition = scenario.createDefinition();

    const response = defineResponse(definition);

    expect(response).not.toBe(definition);
    expect(isNamedResponseDefinition(response)).toBe(true);
    expect(isNamedResponseDefinition(definition)).toBe(false);
    expect(response.name).toBe(definition.name);
    expect(response.statusCode).toBe(definition.statusCode);
    expect(response.description).toBe(definition.description);
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

describe("defineDerivedResponse metadata and lineage", () => {
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
});

describe("defineDerivedResponse scalar inheritance", () => {
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
});

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
