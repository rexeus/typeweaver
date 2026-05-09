import type { NormalizedRequest } from "@rexeus/typeweaver-gen";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { getRequestHeaderDefaults } from "../../src/requestHeaderDefaults.js";

describe("getRequestHeaderDefaults", () => {
  test("extracts exact string literal header defaults", () => {
    const request: NormalizedRequest = {
      header: z.object({
        Accept: z.literal("application/json"),
        Authorization: z.string(),
        "Content-Type": z.literal("application/json"),
      }),
    };

    const defaults = getRequestHeaderDefaults(request);

    expect(defaults).toEqual({
      entries: [
        { key: "Accept", value: "application/json" },
        { key: "Content-Type", value: "application/json" },
      ],
      optionalHeaderKeys: ["Accept", "Content-Type"],
      isHeaderInputOptional: false,
    });
  });

  test("marks header input optional when all required headers have defaults", () => {
    const request: NormalizedRequest = {
      header: z.object({
        Accept: z.literal("application/json"),
        "X-Optional": z.string().optional(),
      }),
    };

    const defaults = getRequestHeaderDefaults(request);

    expect(defaults?.isHeaderInputOptional).toBe(true);
  });

  test("ignores optional-wrapped literals", () => {
    const request: NormalizedRequest = {
      header: z.object({ Accept: z.literal("application/json").optional() }),
    };

    const defaults = getRequestHeaderDefaults(request);

    expect(defaults).toBeUndefined();
  });

  test.each([
    {
      case: "union",
      schema: z.union([z.literal("application/json"), z.literal("text/plain")]),
    },
    {
      case: "multi-value literal",
      schema: z.literal(["application/json", "text/plain"]),
    },
    { case: "enum", schema: z.enum(["application/json", "text/plain"]) },
    { case: "non-string literal", schema: z.literal(42) },
  ])("ignores $case header schemas", ({ schema }) => {
    const request = {
      header: z.object({ Accept: schema }),
    } as NormalizedRequest;

    const defaults = getRequestHeaderDefaults(request);

    expect(defaults).toBeUndefined();
  });

  test("ignores non-object header schemas", () => {
    const request = {
      header: z.record(z.string(), z.string()),
    } as NormalizedRequest;

    const defaults = getRequestHeaderDefaults(request);

    expect(defaults).toBeUndefined();
  });
});
