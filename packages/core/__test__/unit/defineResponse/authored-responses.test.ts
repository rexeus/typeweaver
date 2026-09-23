import { describe, expect, test } from "vitest";
import { z } from "zod";
import { defineResponse } from "../../../src/defineResponse.js";
import { HttpStatusCode } from "../../../src/HttpStatusCode.js";
import {
  getResponseDefinitionMetadata,
  isNamedResponseDefinition,
} from "../../../src/responseDefinitionMetadata.js";
import { responseDefinitionMetadataSymbol } from "../../../src/responseDefinitionTypes.js";

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
