import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  ResponseDefinitionMergeError,
  defineDerivedResponse,
  defineResponse,
} from "../../src/defineResponse";
import { HttpStatusCode } from "../../src/HttpStatusCode";

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
