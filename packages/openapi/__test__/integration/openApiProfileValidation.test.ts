import { Validator } from "@seriousme/openapi-schema-validator";
import { describe, expect, test } from "vitest";
import { buildOpenApiDocument } from "../../src/index.js";
import { aNormalizedSpecWith } from "../unit/buildOpenApiDocument.helpers.js";
import type { OpenApiTarget } from "../../src/index.js";

const targets = ["3.1.2", "3.2.0"] satisfies readonly OpenApiTarget[];

const matrixSpec = () =>
  aNormalizedSpecWith({
    metadata: {
      title: "Validator Matrix API",
      version: "1.0.0",
      description: "One normalized fixture for both declared profiles",
      tags: [{ name: "matrix", description: "Validator matrix operations" }],
    },
    securitySchemes: [
      {
        name: "bearerAuth",
        kind: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    ],
    security: {
      requirements: [{ bearerAuth: [] }],
      source: "spec",
    },
  });

describe("OpenAPI profile validator matrix", () => {
  test("uses a validator that explicitly supports OpenAPI 3.1 and 3.2", () => {
    expect(Validator.supportedVersions.has("3.1")).toBe(true);
    expect(Validator.supportedVersions.has("3.2")).toBe(true);
  });

  test.each(targets)(
    "validates the shared normalized fixture as OpenAPI %s against its official schema",
    async target => {
      const document = buildOpenApiDocument(matrixSpec(), { target }).document;
      const validator = new Validator();
      const externalDocument: Record<string, unknown> = { ...document };

      const result = await validator.validate(externalDocument);

      expect(result, JSON.stringify(result.errors, null, 2)).toEqual({
        valid: true,
      });
      expect(validator.version).toBe(target.slice(0, 3));
    }
  );
});
