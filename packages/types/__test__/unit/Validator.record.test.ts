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
    return this.coerceHeaderToSchema(header, schema);
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
