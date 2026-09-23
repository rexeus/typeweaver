import { describe, expect, test } from "vitest";
import { z } from "zod";
import { UnsupportedZodTypeError } from "../../../src/index.js";
import { captureError, toTs } from "./fixtures.js";

describe("unsupported schemas", () => {
  test.each([
    {
      scenario: "z.lazy()",
      schema: z.lazy(() => z.string()),
      schemaKind: "lazy",
      reason: "recursive schemas require named TypeScript declarations",
    },
    {
      scenario: "z.templateLiteral()",
      schema: z.templateLiteral(["hello ", z.string()]),
      schemaKind: "template-literal",
      reason: "template-literal schemas are not represented",
    },
    {
      scenario: "z.custom()",
      schema: z.custom(),
      schemaKind: "custom",
      reason: "custom validators do not expose",
    },
    {
      scenario: "z.transform()",
      schema: z.string().transform(value => value.length),
      schemaKind: "transform",
      reason: "transforms do not expose",
    },
  ])(
    "$scenario throws a stable actionable error",
    ({ schema, schemaKind, reason }) => {
      const error = captureError(() => toTs(schema));

      expect(error).toBeInstanceOf(UnsupportedZodTypeError);
      expect(error).toEqual(
        expect.objectContaining({
          code: "UNSUPPORTED_ZOD_TYPE",
          schemaKind,
          reason: expect.stringContaining(reason) as unknown,
        }) as unknown
      );
      if (!(error instanceof UnsupportedZodTypeError)) {
        throw new Error("Expected UnsupportedZodTypeError");
      }
      expect(error.message).toContain(
        "Restructure the schema to a supported shape"
      );
    }
  );

  test("continues to support intentional z.unknown()", () => {
    expect(toTs(z.unknown())).toBe("unknown");
  });
});
