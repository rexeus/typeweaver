import type {
  HttpQuerySchema,
  HttpRequestHeaderSchema,
} from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { Validator } from "../../src/lib/Validator.js";

class ProbeValidator extends Validator {
  public coerceQuery(query: unknown, schema: HttpQuerySchema): unknown {
    return this.coerceQueryToSchema(query, schema);
  }

  public coerceHeader(
    header: unknown,
    schema: HttpRequestHeaderSchema
  ): unknown {
    return this.coerceHeaderToSchema(header, schema, true);
  }

  public coerceResponseHeader(
    header: unknown,
    schema: HttpRequestHeaderSchema
  ): unknown {
    return this.coerceHeaderToSchema(header, schema);
  }

  public recordKeyIssues(
    data: unknown,
    schema: HttpRequestHeaderSchema
  ): readonly z.core.$ZodIssue[] {
    return this.findRecordKeyIdentityIssues(data, schema);
  }
}

describe("Validator record normalization", () => {
  const validator = new ProbeValidator();

  test("wraps singleton query values for an array-valued record", () => {
    const schema = z.record(z.string(), z.array(z.coerce.number()));
    const coerced = validator.coerceQuery({ p50: "1.5" }, schema);

    expect(schema.parse(coerced)).toEqual({ p50: [1.5] });
  });

  test("keeps repeated query values for an array-valued record", () => {
    const schema = z.record(z.string(), z.array(z.coerce.number()));
    const coerced = validator.coerceQuery({ p99: ["2", "3"] }, schema);

    expect(schema.parse(coerced)).toEqual({ p99: [2, 3] });
  });

  test("splits comma-delimited header values for an array-valued record", () => {
    const schema = z.record(z.string(), z.array(z.string()));
    const coerced = validator.coerceHeader(
      { "x-series": "alpha, beta" },
      schema
    );

    expect(schema.parse(coerced)).toEqual({
      "x-series": ["alpha", "beta"],
    });
  });

  test("keeps scalar comma-containing record headers scalar", () => {
    const schema = z.record(z.string(), z.string());
    const coerced = validator.coerceHeader(
      { "x-note": "first, second" },
      schema
    );

    expect(schema.parse(coerced)).toEqual({ "x-note": "first, second" });
  });

  test("restores finite record header keys to their declared casing", () => {
    const schema = z.record(z.literal("X-Flag"), z.string());
    const coerced = validator.coerceHeader({ "x-flag": "enabled" }, schema);

    expect(schema.parse(coerced)).toEqual({ "X-Flag": "enabled" });
    expect(validator.recordKeyIssues(coerced, schema)).toEqual([]);
  });

  test("deduplicates overlapping finite record key unions", () => {
    const schema = z.record(
      z.union([z.literal("X-Flag"), z.enum(["X-Flag", "Accept"])]),
      z.string()
    );
    const coerced = validator.coerceHeader(
      { "x-flag": "enabled", accept: "application/json" },
      schema
    );

    expect(schema.parse(coerced)).toEqual({
      "X-Flag": "enabled",
      Accept: "application/json",
    });
    expect(validator.recordKeyIssues(coerced, schema)).toEqual([]);
  });

  test("keeps transport casing for non-finite header record keys", () => {
    const schema = z.record(z.string().regex(/^x-/), z.string());
    const coerced = validator.coerceHeader({ "x-flag": "enabled" }, schema);

    expect(schema.parse(coerced)).toEqual({ "x-flag": "enabled" });
  });
});

describe("Validator strict object normalization", () => {
  const validator = new ProbeValidator();

  test("preserves undeclared query keys for strict-object rejection", () => {
    const schema = z.strictObject({ known: z.string() });
    const coerced = validator.coerceQuery(
      { known: "value", unexpected: "rejected" },
      schema
    );

    expect(schema.safeParse(coerced).success).toBe(false);
  });

  test("preserves undeclared header keys for strict-object rejection", () => {
    const schema = z.strictObject({ "X-Known": z.string() });
    const coerced = validator.coerceHeader(
      { "x-known": "value", "x-unexpected": "rejected" },
      schema
    );

    expect(schema.safeParse(coerced).success).toBe(false);
  });

  test("keeps response-header unknown-key filtering unchanged", () => {
    const schema = z.strictObject({ "X-Known": z.string() });
    const coerced = validator.coerceResponseHeader(
      { "x-known": "value", "x-unexpected": "ignored" },
      schema
    );

    expect(schema.parse(coerced)).toEqual({ "X-Known": "value" });
  });
});

describe("Validator array wrapper cardinality", () => {
  const validator = new ProbeValidator();

  test("wraps singleton values for a defaulted array schema", () => {
    const schema = z.object({
      samples: z.array(z.coerce.number()).default([]),
    });

    const coerced = validator.coerceQuery({ samples: "1.5" }, schema);

    expect(schema.parse(coerced)).toEqual({ samples: [1.5] });
  });

  test("wraps singleton values for a readonly array schema", () => {
    const schema = z.object({
      samples: z.readonly(z.array(z.coerce.number())),
    });

    const coerced = validator.coerceQuery({ samples: "1.5" }, schema);

    expect(schema.parse(coerced)).toEqual({ samples: [1.5] });
  });

  test("wraps singleton values for a caught array schema", () => {
    const schema = z.object({
      samples: z.array(z.coerce.number()).catch([]),
    });

    const coerced = validator.coerceQuery({ samples: "1.5" }, schema);

    expect(schema.parse(coerced)).toEqual({ samples: [1.5] });
  });

  test("wraps singleton values for a piped array schema", () => {
    const schema = z.object({
      samples: z.array(z.coerce.number()).pipe(z.array(z.number())),
    });

    const coerced = validator.coerceQuery({ samples: "1.5" }, schema);

    expect(schema.parse(coerced)).toEqual({ samples: [1.5] });
  });

  test("wraps singleton values for a nested optional array schema", () => {
    const schema = z.object({
      samples: z.optional(z.array(z.coerce.number())).nonoptional(),
    });

    const coerced = validator.coerceQuery({ samples: "1.5" }, schema);

    expect(schema.parse(coerced)).toEqual({ samples: [1.5] });
  });

  test("wraps singleton values for a defaulted record array value", () => {
    const schema = z.record(z.string(), z.array(z.coerce.number()).default([]));

    const coerced = validator.coerceQuery({ p50: "1.5" }, schema);

    expect(schema.parse(coerced)).toEqual({ p50: [1.5] });
  });

  test("wraps singleton header values for a readonly array field", () => {
    const schema = z.object({
      "x-series": z.readonly(z.array(z.coerce.number())),
    });

    const coerced = validator.coerceHeader({ "x-series": "1.5" }, schema);

    expect(schema.parse(coerced)).toEqual({ "x-series": [1.5] });
  });
});

describe("Validator wrapper-around-pipe cardinality", () => {
  const validator = new ProbeValidator();

  test("wraps singleton values for an optional-wrapped pipe field", () => {
    const schema = z.object({
      samples: z.optional(z.array(z.coerce.number()).pipe(z.array(z.number()))),
    });

    const coerced = validator.coerceQuery({ samples: "1.5" }, schema);

    expect(schema.parse(coerced)).toEqual({ samples: [1.5] });
  });

  test("wraps singleton values for a default-wrapped pipe field", () => {
    const schema = z.object({
      samples: z.array(z.coerce.number()).pipe(z.array(z.number())).default([]),
    });

    const coerced = validator.coerceQuery({ samples: "1.5" }, schema);

    expect(schema.parse(coerced)).toEqual({ samples: [1.5] });
  });

  test("wraps singleton values for an optional-wrapped pipe record value", () => {
    const schema = z.record(
      z.string(),
      z.optional(z.array(z.coerce.number()).pipe(z.array(z.number())))
    );

    const coerced = validator.coerceQuery({ p50: "1.5" }, schema);

    expect(schema.parse(coerced)).toEqual({ p50: [1.5] });
  });

  test("wraps singleton values for a default-wrapped pipe record value", () => {
    const schema = z.record(
      z.string(),
      z.array(z.coerce.number()).pipe(z.array(z.number())).default([])
    );

    const coerced = validator.coerceQuery({ p50: "1.5" }, schema);

    expect(schema.parse(coerced)).toEqual({ p50: [1.5] });
  });
});
