import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  anOperation,
  aSpec,
  normalizeSpec,
  theOnlyOperationIn,
} from "./fixtures.js";

describe("normalizeSpec explicit media types and headers", () => {
  test("preserves custom explicit media types with raw transport", () => {
    const body = z.object({ event: z.string() });
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({
            request: {
              header: z.object({
                "content-type": z.literal("application/vnd.todo+custom"),
              }),
              body,
            },
          }),
        ],
      },
    });

    const normalizedSpec = normalizeSpec(spec);
    const operation = theOnlyOperationIn(normalizedSpec);

    expect(operation.request?.body).toEqual({
      schema: body,
      mediaType: "application/vnd.todo+custom",
      mediaTypeSource: "content-type-header",
      transport: "raw",
    });
    expect(normalizedSpec.warnings).toEqual([]);
  });

  test("does not mutate authored header schemas when Content-Type is inferred", () => {
    const header = z.object({ authorization: z.string() });
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({
            request: { header, body: z.object({ title: z.string() }) },
          }),
        ],
      },
    });

    const normalizedSpec = normalizeSpec(spec);
    const operation = theOnlyOperationIn(normalizedSpec);

    expect(operation.request?.header).toBe(header);
    expect(Object.keys(header.shape)).toEqual(["authorization"]);
    expect(operation.request?.body?.mediaType).toBe("application/json");
  });

  test("finds Content-Type headers case-insensitively", () => {
    const body = z.string();
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({
            request: {
              header: z.object({
                "cOnTeNt-TyPe": z.literal("text/markdown"),
              }),
              body,
            },
          }),
        ],
      },
    });

    const normalizedSpec = normalizeSpec(spec);
    const operation = theOnlyOperationIn(normalizedSpec);

    expect(operation.request?.body).toEqual({
      schema: body,
      mediaType: "text/markdown",
      mediaTypeSource: "content-type-header",
      transport: "text",
    });
  });
});

describe("normalizeSpec ambiguous Content-Type warnings", () => {
  test("warns and infers media type for ambiguous Content-Type headers", () => {
    const body = z.object({ title: z.string() });
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({
            request: {
              header: z.object({
                "Content-Type": z.enum(["application/json", "text/plain"]),
              }),
              body,
            },
          }),
        ],
      },
    });

    const normalizedSpec = normalizeSpec(spec);
    const operation = theOnlyOperationIn(normalizedSpec);

    expect(operation.request?.body?.mediaType).toBe("application/json");
    expect(normalizedSpec.warnings).toEqual([
      expect.objectContaining({
        code: "ambiguous-content-type-header",
      }) as unknown,
    ]);
  });
});

describe("normalizeSpec wrapped body schemas", () => {
  test.each([
    {
      scenario: "optional object",
      body: z.object({ title: z.string() }).optional(),
      mediaType: "application/json",
      transport: "json",
    },
    {
      scenario: "nullable object",
      body: z.object({ title: z.string() }).nullable(),
      mediaType: "application/json",
      transport: "json",
    },
    {
      scenario: "default object",
      body: z.object({ title: z.string() }).default({ title: "Untitled" }),
      mediaType: "application/json",
      transport: "json",
    },
    {
      scenario: "readonly object",
      body: z.object({ title: z.string() }).readonly(),
      mediaType: "application/json",
      transport: "json",
    },
    {
      scenario: "optional string",
      body: z.string().optional(),
      mediaType: "text/plain",
      transport: "text",
    },
    {
      scenario: "nullable string",
      body: z.string().nullable(),
      mediaType: "text/plain",
      transport: "text",
    },
    {
      scenario: "default string",
      body: z.string().default("Untitled"),
      mediaType: "text/plain",
      transport: "text",
    },
    {
      scenario: "catch string",
      body: z.string().catch("Untitled"),
      mediaType: "text/plain",
      transport: "text",
    },
    {
      scenario: "prefault string",
      body: z.string().prefault("Untitled"),
      mediaType: "text/plain",
      transport: "text",
    },
    {
      scenario: "typed pipe string",
      body: z.string().pipe(z.string()),
      mediaType: "text/plain",
      transport: "text",
    },
  ])(
    "infers $mediaType for $scenario bodies without replacing the schema",
    ({ body, mediaType, transport }) => {
      const spec = aSpec({
        todos: {
          operations: [anOperation({ request: { body } })],
        },
      });

      const normalizedSpec = normalizeSpec(spec);
      const operation = theOnlyOperationIn(normalizedSpec);

      expect(operation.request?.body).toEqual({
        schema: body,
        mediaType,
        mediaTypeSource: "body-schema",
        transport,
      });
      expect(operation.request?.body?.schema).toBe(body);
      expect(normalizedSpec.warnings).toEqual([
        expect.objectContaining({
          code: "missing-content-type-header",
        }) as unknown,
      ]);
    }
  );
});
